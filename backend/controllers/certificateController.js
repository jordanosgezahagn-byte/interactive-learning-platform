import { randomUUID } from 'node:crypto';
import { getDbPool } from '../config/db.js';

function validId(value) {
  return typeof value === 'string' && /^\d+$/.test(value) && value !== '0';
}

export async function getCertificateRequirements(connection, enrollmentId, courseId) {
  const [lessonRows] = await connection.execute(
    `SELECT COUNT(*) AS required_count,
            SUM(CASE WHEN EXISTS (
              SELECT 1 FROM lesson_progress AS progress
              WHERE progress.enrollment_id = ? AND progress.lesson_id = lesson.id
                AND progress.status = 'completed'
            ) THEN 1 ELSE 0 END) AS completed_count
     FROM lessons AS lesson
     JOIN course_modules AS module ON module.id = lesson.module_id
     WHERE module.course_id = ? AND lesson.is_published = TRUE`,
    [enrollmentId, courseId],
  );
  const [exerciseRows] = await connection.execute(
    `SELECT COUNT(*) AS required_count,
            SUM(CASE WHEN EXISTS (
              SELECT 1 FROM exercise_submissions AS submission
              WHERE submission.enrollment_id = ? AND submission.exercise_id = exercise.id
                AND submission.status = 'passed'
            ) THEN 1 ELSE 0 END) AS passed_count
     FROM exercises AS exercise
     JOIN lessons AS lesson ON lesson.id = exercise.lesson_id
     JOIN course_modules AS module ON module.id = lesson.module_id
     WHERE module.course_id = ? AND lesson.is_published = TRUE`,
    [enrollmentId, courseId],
  );
  const [quizRows] = await connection.execute(
    `SELECT COUNT(*) AS required_count,
            SUM(CASE WHEN EXISTS (
              SELECT 1 FROM quiz_attempts AS attempt
              WHERE attempt.enrollment_id = ? AND attempt.quiz_id = quiz.id
                AND attempt.status IN ('submitted', 'graded') AND attempt.passed = TRUE
            ) THEN 1 ELSE 0 END) AS passed_count
     FROM quizzes AS quiz
     WHERE quiz.course_id = ? AND quiz.is_published = TRUE`,
    [enrollmentId, courseId],
  );

  const lessons = {
    required: Number(lessonRows[0].required_count),
    completed: Number(lessonRows[0].completed_count || 0),
  };
  const exercises = {
    required: Number(exerciseRows[0].required_count),
    passed: Number(exerciseRows[0].passed_count || 0),
  };
  const quizzes = {
    required: Number(quizRows[0].required_count),
    passed: Number(quizRows[0].passed_count || 0),
  };

  return {
    lessons,
    exercises,
    quizzes,
    eligible: lessons.required > 0 && lessons.completed === lessons.required,
  };
}

export async function requestCertificate(request, response, next) {
  const { courseId } = request.params;
  if (!validId(courseId)) {
    response.status(400).json({ error: 'Invalid course ID.' });
    return;
  }

  let connection;
  try {
    const pool = getDbPool();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [enrollments] = await connection.execute(
      `SELECT enrollment.id, enrollment.status
       FROM enrollments AS enrollment
       JOIN courses AS course ON course.id = enrollment.course_id
       WHERE enrollment.student_id = ? AND enrollment.course_id = ?
         AND enrollment.status IN ('active', 'completed')
         AND course.status IN ('published', 'archived')
       LIMIT 1 FOR UPDATE`,
      [request.auth.userId, courseId],
    );
    if (!enrollments[0]) {
      await connection.rollback();
      response.status(404).json({ error: 'You are not enrolled in this course.' });
      return;
    }

    const requirements = await getCertificateRequirements(connection, enrollments[0].id, courseId);
    if (!requirements.eligible) {
      await connection.rollback();
      response.status(409).json({
        error: 'Complete every published lesson before requesting a certificate.',
        requirements,
      });
      return;
    }

    const [existingRows] = await connection.execute(
      'SELECT id, status FROM certificates WHERE enrollment_id = ? LIMIT 1 FOR UPDATE',
      [enrollments[0].id],
    );
    let certificateId;
    if (existingRows[0]) {
      if (!['declined_instructor', 'declined_admin'].includes(existingRows[0].status)) {
        await connection.rollback();
        response.status(409).json({ error: 'A certificate request for this course is already in review or has been issued.' });
        return;
      }
      certificateId = existingRows[0].id;
      await connection.execute(
        `UPDATE certificates
         SET certificate_code = ?, status = 'pending_instructor', requested_at = UTC_TIMESTAMP(),
             instructor_reviewed_by = NULL, instructor_reviewed_at = NULL, instructor_note = NULL,
             admin_reviewed_by = NULL, admin_reviewed_at = NULL, admin_note = NULL,
             issued_at = NULL, revoked_at = NULL
         WHERE id = ?`,
        [randomUUID(), certificateId],
      );
    } else {
      const [result] = await connection.execute(
        `INSERT INTO certificates (enrollment_id, certificate_code, status, requested_at, issued_at)
         VALUES (?, ?, 'pending_instructor', UTC_TIMESTAMP(), NULL)`,
        [enrollments[0].id, randomUUID()],
      );
      certificateId = result.insertId;
    }

    await connection.execute(
      `UPDATE enrollments
       SET status = 'completed', completed_at = COALESCE(completed_at, UTC_TIMESTAMP())
       WHERE id = ?`,
      [enrollments[0].id],
    );
    await connection.commit();
    response.status(201).json({
      message: 'Certificate request sent to your course instructor for review.',
      certificate: { id: String(certificateId), status: 'pending_instructor' },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
}

export async function getPublicCertificate(request, response, next) {
  const { certificateCode } = request.params;
  if (!/^[\da-f-]{36}$/i.test(certificateCode)) {
    response.status(404).json({ error: 'Certificate not found.' });
    return;
  }

  try {
    response.set('Cache-Control', 'no-store');
    const pool = getDbPool();
    const [rows] = await pool.execute(
      `SELECT certificate.certificate_code, certificate.issued_at, certificate.revoked_at,
              student.full_name AS learner_name, course.title AS course_title,
              DATE_FORMAT(COALESCE(enrollment.completed_at,
                (SELECT MAX(progress.completed_at)
                 FROM lesson_progress AS progress
                 JOIN lessons AS lesson ON lesson.id = progress.lesson_id
                 JOIN course_modules AS module ON module.id = lesson.module_id
                 WHERE progress.enrollment_id = enrollment.id
                   AND module.course_id = course.id AND progress.status = 'completed'),
                certificate.issued_at), '%Y-%m-%d') AS completion_date
       FROM certificates AS certificate
       JOIN enrollments AS enrollment ON enrollment.id = certificate.enrollment_id
       JOIN users AS student ON student.id = enrollment.student_id
       JOIN courses AS course ON course.id = enrollment.course_id
       WHERE certificate.certificate_code = ? AND certificate.status = 'issued'
       LIMIT 1`,
      [certificateCode],
    );
    if (!rows[0]) {
      response.status(404).json({ error: 'Certificate not found.' });
      return;
    }
    response.json({
      certificate: {
        ...rows[0],
        is_valid: rows[0].revoked_at === null,
      },
    });
  } catch (error) {
    next(error);
  }
}
