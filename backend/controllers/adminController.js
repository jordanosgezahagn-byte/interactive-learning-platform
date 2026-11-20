import { getDbPool } from '../config/db.js';
import { getCertificateRequirements } from './certificateController.js';

const userRoles = new Set(['student', 'instructor', 'admin']);
const userStatuses = new Set(['active', 'disabled']);
const courseStatuses = new Set(['draft', 'published', 'archived']);
const reportStatuses = new Set(['open', 'under_review', 'resolved', 'dismissed']);

function validId(value) {
  return typeof value === 'string' && /^\d+$/.test(value) && value !== '0';
}

function sendInvalid(response, message) {
  response.status(400).json({ error: message });
}

function sendNotFound(response, message) {
  response.status(404).json({ error: message });
}

function sendConflict(response, message) {
  response.status(409).json({ error: message });
}

export async function getOverview(_request, response, next) {
  try {
    const pool = getDbPool();
    const [rows] = await pool.execute(
      `SELECT
         (SELECT COUNT(*) FROM users AS u JOIN roles AS r ON r.id = u.role_id WHERE r.name = 'student') AS students,
         (SELECT COUNT(*) FROM users AS u JOIN roles AS r ON r.id = u.role_id WHERE r.name = 'instructor') AS instructors,
         (SELECT COUNT(*) FROM courses) AS courses,
         (SELECT COUNT(*) FROM lessons) AS lessons,
         (SELECT COUNT(*) FROM enrollments) AS enrollments,
         (SELECT COUNT(*) FROM certificates) AS certificates,
         (SELECT COUNT(*) FROM content_reports WHERE status IN ('open', 'under_review')) AS open_reports`,
    );
    response.json({
      statistics: Object.fromEntries(
        Object.entries(rows[0]).map(([key, value]) => [key, Number(value)]),
      ),
    });
  } catch (error) {
    next(error);
  }
}

export async function listUsers(_request, response, next) {
  try {
    const pool = getDbPool();
    const [users] = await pool.execute(
      `SELECT u.id, u.full_name, u.email, u.status, u.created_at, u.email_verified_at,
              r.name AS role,
              (SELECT COUNT(*) FROM courses AS c WHERE c.instructor_id = u.id) AS course_count
       FROM users AS u
       JOIN roles AS r ON r.id = u.role_id
       ORDER BY u.created_at DESC, u.id DESC
       LIMIT 500`,
    );
    response.json({
      users: users.map((user) => ({
        ...user,
        id: String(user.id),
        course_count: Number(user.course_count),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(request, response, next) {
  const { userId } = request.params;
  const { role, status } = request.body ?? {};
  if (!validId(userId)) {
    sendInvalid(response, 'Invalid user ID.');
    return;
  }
  if (!userRoles.has(role) || !userStatuses.has(status)) {
    sendInvalid(response, 'Choose a supported role and account status.');
    return;
  }
  if (userId === request.auth.userId) {
    sendConflict(response, 'You cannot change your own administrator account.');
    return;
  }

  let connection;
  try {
    const pool = getDbPool();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [adminRole] = await connection.execute(
      "SELECT id FROM roles WHERE name = 'admin' FOR UPDATE",
    );
    const [roles] = await connection.execute(
      'SELECT id, name FROM roles WHERE name = ? LIMIT 1',
      [role],
    );
    if (!roles[0] || !adminRole[0]) {
      await connection.rollback();
      sendConflict(response, 'The requested role is not configured.');
      return;
    }

    const [users] = await connection.execute(
      'SELECT id, role_id, status FROM users WHERE id = ? FOR UPDATE',
      [userId],
    );
    const user = users[0];
    if (!user) {
      await connection.rollback();
      sendNotFound(response, 'User not found.');
      return;
    }

    const isAdmin = Number(user.role_id) === Number(adminRole[0].id);
    const remainsActiveAdmin = role === 'admin' && status === 'active';
    if (isAdmin && user.status === 'active' && !remainsActiveAdmin) {
      const [otherAdmins] = await connection.execute(
        `SELECT COUNT(*) AS count
         FROM users
         WHERE role_id = ? AND status = 'active' AND id <> ?`,
        [adminRole[0].id, userId],
      );
      if (Number(otherAdmins[0].count) === 0) {
        await connection.rollback();
        sendConflict(response, 'The last active administrator cannot be disabled or demoted.');
        return;
      }
    }

    await connection.execute(
      'UPDATE users SET role_id = ?, status = ? WHERE id = ?',
      [roles[0].id, status, userId],
    );
    await connection.commit();
    response.json({ message: 'User account updated.' });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
}

export async function listCourses(_request, response, next) {
  try {
    const pool = getDbPool();
    const [[courses], [instructors], [categories]] = await Promise.all([
      pool.execute(
        `SELECT c.id, c.title, c.status, c.difficulty, c.instructor_id,
                u.full_name AS instructor_name,
                COUNT(DISTINCT e.id) AS enrollment_count,
                GROUP_CONCAT(DISTINCT cc.category_id ORDER BY cc.category_id) AS category_ids,
                GROUP_CONCAT(DISTINCT category.name ORDER BY category.name SEPARATOR ', ') AS category_names
         FROM courses AS c
         JOIN users AS u ON u.id = c.instructor_id
         LEFT JOIN enrollments AS e ON e.course_id = c.id
         LEFT JOIN course_categories AS cc ON cc.course_id = c.id
         LEFT JOIN categories AS category ON category.id = cc.category_id
         GROUP BY c.id, c.title, c.status, c.difficulty, c.instructor_id, u.full_name
         ORDER BY c.updated_at DESC, c.id DESC
         LIMIT 500`,
      ),
      pool.execute(
        `SELECT u.id, u.full_name
         FROM users AS u
         JOIN roles AS r ON r.id = u.role_id
         WHERE r.name = 'instructor' AND u.status = 'active'
         ORDER BY u.full_name`,
      ),
      pool.execute('SELECT id, name, slug, description FROM categories ORDER BY name'),
    ]);
    response.json({
      courses: courses.map((course) => ({
        ...course,
        id: String(course.id),
        instructor_id: String(course.instructor_id),
        enrollment_count: Number(course.enrollment_count),
        category_ids: course.category_ids ? course.category_ids.split(',').map(String) : [],
      })),
      instructors: instructors.map((instructor) => ({ ...instructor, id: String(instructor.id) })),
      categories: categories.map((category) => ({ ...category, id: String(category.id) })),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCourse(request, response, next) {
  const { courseId } = request.params;
  const { status, instructorId, categoryIds } = request.body ?? {};
  if (!validId(courseId) || !courseStatuses.has(status) || !validId(instructorId)
    || !Array.isArray(categoryIds) || categoryIds.some((id) => !validId(id))) {
    sendInvalid(response, 'Choose a valid course status, instructor, and category list.');
    return;
  }

  let connection;
  try {
    const pool = getDbPool();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [courses] = await connection.execute('SELECT id FROM courses WHERE id = ? FOR UPDATE', [courseId]);
    if (!courses[0]) {
      await connection.rollback();
      sendNotFound(response, 'Course not found.');
      return;
    }
    const [instructors] = await connection.execute(
      `SELECT u.id
       FROM users AS u
       JOIN roles AS r ON r.id = u.role_id
       WHERE u.id = ? AND u.status = 'active' AND r.name = 'instructor'
       LIMIT 1`,
      [instructorId],
    );
    if (!instructors[0]) {
      await connection.rollback();
      sendInvalid(response, 'The selected instructor is not active.');
      return;
    }
    const uniqueCategoryIds = [...new Set(categoryIds)];
    if (uniqueCategoryIds.length) {
      const placeholders = uniqueCategoryIds.map(() => '?').join(', ');
      const [categories] = await connection.execute(
        `SELECT id FROM categories WHERE id IN (${placeholders})`,
        uniqueCategoryIds,
      );
      if (categories.length !== uniqueCategoryIds.length) {
        await connection.rollback();
        sendInvalid(response, 'One or more selected categories no longer exist.');
        return;
      }
    }

    await connection.execute(
      `UPDATE courses SET instructor_id = ?, status = ?,
       published_at = CASE WHEN ? = 'published' AND published_at IS NULL THEN UTC_TIMESTAMP()
                           ELSE published_at END
       WHERE id = ?`,
      [instructorId, status, status, courseId],
    );
    await connection.execute('DELETE FROM course_categories WHERE course_id = ?', [courseId]);
    for (const categoryId of uniqueCategoryIds) {
      await connection.execute(
        'INSERT INTO course_categories (course_id, category_id) VALUES (?, ?)',
        [courseId, categoryId],
      );
    }
    await connection.commit();
    response.json({ message: 'Course settings updated.' });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
}

export async function createCategory(request, response, next) {
  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
  const description = typeof request.body?.description === 'string' ? request.body.description.trim() : '';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!name || name.length > 100 || description.length > 5000 || !slug || slug.length > 120) {
    sendInvalid(response, 'Enter a category name (up to 100 characters) and a shorter description.');
    return;
  }
  try {
    const pool = getDbPool();
    const [result] = await pool.execute(
      'INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)',
      [name, slug, description || null],
    );
    response.status(201).json({ category: { id: String(result.insertId), name, slug, description } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      sendConflict(response, 'A category with this name already exists.');
      return;
    }
    next(error);
  }
}

export async function updateCategory(request, response, next) {
  const { categoryId } = request.params;
  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
  const description = typeof request.body?.description === 'string' ? request.body.description.trim() : '';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!validId(categoryId) || !name || name.length > 100 || description.length > 5000 || !slug || slug.length > 120) {
    sendInvalid(response, 'Enter a category name (up to 100 characters) and a shorter description.');
    return;
  }
  try {
    const pool = getDbPool();
    const [existing] = await pool.execute('SELECT id FROM categories WHERE id = ? LIMIT 1', [categoryId]);
    if (!existing[0]) {
      sendNotFound(response, 'Category not found.');
      return;
    }
    await pool.execute(
      'UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?',
      [name, slug, description || null, categoryId],
    );
    response.json({ message: 'Category updated.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      sendConflict(response, 'A category with this name already exists.');
      return;
    }
    next(error);
  }
}

export async function deleteCategory(request, response, next) {
  const { categoryId } = request.params;
  if (!validId(categoryId)) {
    sendInvalid(response, 'Invalid category ID.');
    return;
  }
  try {
    const pool = getDbPool();
    const [result] = await pool.execute('DELETE FROM categories WHERE id = ?', [categoryId]);
    if (!result.affectedRows) {
      sendNotFound(response, 'Category not found.');
      return;
    }
    response.json({ message: 'Category deleted.' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      sendConflict(response, 'Remove this category from courses before deleting it.');
      return;
    }
    next(error);
  }
}

export async function listCertificates(_request, response, next) {
  try {
    const pool = getDbPool();
    const [certificates] = await pool.execute(
      `SELECT certificate.id, certificate.certificate_code, certificate.status,
              certificate.requested_at, certificate.issued_at, certificate.revoked_at,
              certificate.instructor_note, certificate.admin_note,
              enrollment.status AS enrollment_status,
              student.id AS student_id, student.full_name AS student_name, student.email,
              course.id AS course_id, course.title AS course_title,
              (SELECT COUNT(*) FROM lessons AS lesson
               JOIN course_modules AS module ON module.id = lesson.module_id
               WHERE module.course_id = course.id AND lesson.is_published = TRUE) AS total_lessons,
              (SELECT COUNT(*) FROM lesson_progress AS progress
               JOIN lessons AS lesson ON lesson.id = progress.lesson_id
               JOIN course_modules AS module ON module.id = lesson.module_id
               WHERE progress.enrollment_id = enrollment.id AND module.course_id = course.id
                 AND lesson.is_published = TRUE AND progress.status = 'completed') AS completed_lessons,
              (SELECT COUNT(*) FROM exercises AS exercise
               JOIN lessons AS lesson ON lesson.id = exercise.lesson_id
               JOIN course_modules AS module ON module.id = lesson.module_id
               WHERE module.course_id = course.id AND lesson.is_published = TRUE) AS total_exercises,
              (SELECT COUNT(*) FROM exercises AS exercise
               JOIN lessons AS lesson ON lesson.id = exercise.lesson_id
               JOIN course_modules AS module ON module.id = lesson.module_id
               WHERE module.course_id = course.id AND lesson.is_published = TRUE
                 AND EXISTS (SELECT 1 FROM exercise_submissions AS submission
                             WHERE submission.enrollment_id = enrollment.id
                               AND submission.exercise_id = exercise.id AND submission.status = 'passed'))
                AS passed_exercises,
              (SELECT COUNT(*) FROM quizzes AS quiz
               WHERE quiz.course_id = course.id AND quiz.is_published = TRUE) AS total_quizzes,
              (SELECT COUNT(*) FROM quizzes AS quiz
               WHERE quiz.course_id = course.id AND quiz.is_published = TRUE
                 AND EXISTS (SELECT 1 FROM quiz_attempts AS attempt
                             WHERE attempt.enrollment_id = enrollment.id AND attempt.quiz_id = quiz.id
                               AND attempt.status IN ('submitted', 'graded') AND attempt.passed = TRUE))
                AS passed_quizzes
       FROM certificates AS certificate
       JOIN enrollments AS enrollment ON enrollment.id = certificate.enrollment_id
       JOIN users AS student ON student.id = enrollment.student_id
       JOIN courses AS course ON course.id = enrollment.course_id
       ORDER BY certificate.requested_at DESC, certificate.id DESC
       LIMIT 500`,
    );
    response.json({
      certificates: certificates.map((certificate) => ({
        ...certificate,
        id: String(certificate.id),
        student_id: String(certificate.student_id),
        course_id: String(certificate.course_id),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCertificate(request, response, next) {
  const { certificateId } = request.params;
  const { revoked, decision, note = '' } = request.body ?? {};
  if (!validId(certificateId)) {
    sendInvalid(response, 'Invalid certificate ID.');
    return;
  }
  try {
    const pool = getDbPool();
    const [existing] = await pool.execute(
      `SELECT certificate.id, certificate.status, enrollment.id AS enrollment_id,
              enrollment.course_id
       FROM certificates AS certificate
       JOIN enrollments AS enrollment ON enrollment.id = certificate.enrollment_id
       WHERE certificate.id = ? LIMIT 1`,
      [certificateId],
    );
    if (!existing[0]) {
      sendNotFound(response, 'Certificate not found.');
      return;
    }
    if (decision !== undefined) {
      if (!['approve', 'decline'].includes(decision) || typeof note !== 'string' || note.length > 2000) {
        sendInvalid(response, 'Choose approve or decline and provide an optional note up to 2,000 characters.');
        return;
      }
      if (existing[0].status !== 'pending_admin') {
        sendConflict(response, 'Only instructor-approved certificate requests can receive a final decision.');
        return;
      }
      const approved = decision === 'approve';
      if (approved) {
        const requirements = await getCertificateRequirements(
          pool,
          existing[0].enrollment_id,
          existing[0].course_id,
        );
        if (!requirements.eligible) {
          sendConflict(response, 'The learner no longer meets the course lesson completion requirement.');
          return;
        }
      }
      const [result] = await pool.execute(
        `UPDATE certificates
         SET status = ?, admin_reviewed_by = ?, admin_reviewed_at = UTC_TIMESTAMP(),
             admin_note = ?, issued_at = ?
         WHERE id = ? AND status = 'pending_admin'`,
        [
          approved ? 'issued' : 'declined_admin',
          request.auth.userId,
          note.trim() || null,
          approved ? new Date() : null,
          certificateId,
        ],
      );
      if (!result.affectedRows) {
        sendConflict(response, 'This certificate request has already been reviewed.');
        return;
      }
      response.json({
        message: approved ? 'Certificate approved and issued to the student.' : 'Certificate request declined.',
        status: approved ? 'issued' : 'declined_admin',
      });
      return;
    }

    if (typeof revoked !== 'boolean') {
      sendInvalid(response, 'Choose whether the certificate should be revoked.');
      return;
    }
    if (existing[0].status !== 'issued') {
      sendConflict(response, 'Only issued certificates can be revoked or restored.');
      return;
    }
    await pool.execute(
      'UPDATE certificates SET revoked_at = ? WHERE id = ?',
      [revoked ? new Date() : null, certificateId],
    );
    response.json({ message: revoked ? 'Certificate revoked.' : 'Certificate restored.' });
  } catch (error) {
    next(error);
  }
}

export async function listReports(_request, response, next) {
  try {
    const pool = getDbPool();
    const [reports] = await pool.execute(
      `SELECT report.id, report.target_type, report.target_title, report.reason, report.details,
              report.status, report.admin_note, report.created_at, report.reviewed_at,
              reporter.full_name AS reporter_name, reporter.email AS reporter_email,
              course.id AS course_id, course.status AS course_status,
              lesson.id AS lesson_id, lesson.title AS current_lesson_title,
              reviewer.full_name AS reviewer_name
       FROM content_reports AS report
       JOIN users AS reporter ON reporter.id = report.reporter_id
       LEFT JOIN courses AS course ON course.id = report.course_id
       LEFT JOIN lessons AS lesson ON lesson.id = report.lesson_id
       LEFT JOIN users AS reviewer ON reviewer.id = report.reviewed_by
       ORDER BY FIELD(report.status, 'open', 'under_review', 'resolved', 'dismissed'), report.created_at DESC
       LIMIT 500`,
    );
    response.json({
      reports: reports.map((report) => ({
        ...report,
        id: String(report.id),
        course_id: report.course_id === null ? null : String(report.course_id),
        lesson_id: report.lesson_id === null ? null : String(report.lesson_id),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateReport(request, response, next) {
  const { reportId } = request.params;
  const { status, adminNote } = request.body ?? {};
  if (!validId(reportId) || !reportStatuses.has(status)
    || typeof adminNote !== 'string' || adminNote.length > 5000) {
    sendInvalid(response, 'Choose a report status and enter a note of up to 5,000 characters.');
    return;
  }
  try {
    const pool = getDbPool();
    const [result] = await pool.execute(
      `UPDATE content_reports
       SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [status, adminNote.trim() || null, request.auth.userId, reportId],
    );
    if (!result.affectedRows) {
      sendNotFound(response, 'Report not found.');
      return;
    }
    response.json({ message: 'Report updated.' });
  } catch (error) {
    next(error);
  }
}

export async function submitContentReport(request, response, next) {
  const { targetType, courseId, lessonId, reason, details } = request.body ?? {};
  const validTarget = targetType === 'course'
    ? validId(courseId) && (lessonId === undefined || lessonId === null || lessonId === '')
    : targetType === 'lesson' && validId(courseId) && validId(lessonId);
  const validReasons = new Set(['inaccurate', 'inappropriate', 'broken', 'other']);
  const normalizedDetails = typeof details === 'string' ? details.trim() : '';
  if (!validTarget || !validReasons.has(reason)
    || (details !== undefined && details !== null && typeof details !== 'string')
    || normalizedDetails.length > 5000) {
    sendInvalid(response, 'Choose a report reason and provide valid content details.');
    return;
  }

  try {
    const pool = getDbPool();
    let targetTitle;
    if (targetType === 'course') {
      const [courses] = await pool.execute(
        "SELECT title FROM courses WHERE id = ? AND status = 'published' LIMIT 1",
        [courseId],
      );
      targetTitle = courses[0]?.title;
    } else {
      const [lessons] = await pool.execute(
        `SELECT lesson.title
         FROM lessons AS lesson
         JOIN course_modules AS module ON module.id = lesson.module_id
         JOIN courses AS course ON course.id = module.course_id
         WHERE lesson.id = ? AND course.id = ? AND lesson.is_published = TRUE
           AND course.status = 'published'
         LIMIT 1`,
        [lessonId, courseId],
      );
      targetTitle = lessons[0]?.title;
    }
    if (!targetTitle) {
      sendNotFound(response, 'Published course content not found.');
      return;
    }
    const [result] = await pool.execute(
      `INSERT INTO content_reports
         (reporter_id, target_type, course_id, lesson_id, target_title, reason, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        request.auth.userId,
        targetType,
        courseId,
        targetType === 'lesson' ? lessonId : null,
        targetTitle,
        reason,
        normalizedDetails || null,
      ],
    );
    response.status(201).json({ id: String(result.insertId), message: 'Thank you. Your report was sent to the platform administrators.' });
  } catch (error) {
    next(error);
  }
}
