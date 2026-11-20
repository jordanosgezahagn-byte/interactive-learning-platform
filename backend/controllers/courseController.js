import { getDbPool } from '../config/db.js';

function validId(value) {
  return typeof value === 'string' && /^\d+$/.test(value) && value !== '0';
}

function rejectInvalid(response, message) {
  response.status(400).json({ error: message });
}

export async function listPublishedCourses(_request, response, next) {
  try {
    const pool = getDbPool();
    const [courses] = await pool.execute(
      `SELECT c.id, c.title, c.description, c.difficulty, c.estimated_minutes,
              u.full_name AS instructor_name,
              COALESCE(
                (SELECT GROUP_CONCAT(category.name ORDER BY category.name SEPARATOR ', ')
                 FROM course_categories AS link
                 JOIN categories AS category ON category.id = link.category_id
                 WHERE link.course_id = c.id),
                'General'
              ) AS category,
              (SELECT COUNT(*) FROM course_modules AS m
               WHERE m.course_id = c.id) AS module_count,
              (SELECT COUNT(*) FROM lessons AS l
               JOIN course_modules AS m ON m.id = l.module_id
               WHERE m.course_id = c.id) AS lesson_count
       FROM courses AS c
       JOIN users AS u ON u.id = c.instructor_id
       WHERE c.status = 'published' AND u.status = 'active'
       ORDER BY c.published_at DESC, c.id DESC`,
    );
    response.json({
      courses: courses.map((course) => ({
        ...course,
        id: String(course.id),
        estimated_minutes: Number(course.estimated_minutes),
        module_count: Number(course.module_count),
        lesson_count: Number(course.lesson_count),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function getPublishedCourse(request, response, next) {
  const { courseId } = request.params;
  if (!validId(courseId)) {
    rejectInvalid(response, 'Invalid course ID.');
    return;
  }

  try {
    const pool = getDbPool();
    const [courses] = await pool.execute(
      `SELECT c.id, c.title, c.description, c.difficulty, c.estimated_minutes,
              u.full_name AS instructor_name,
              COALESCE(
                (SELECT GROUP_CONCAT(category.name ORDER BY category.name SEPARATOR ', ')
                 FROM course_categories AS link
                 JOIN categories AS category ON category.id = link.category_id
                 WHERE link.course_id = c.id),
                'General'
              ) AS category,
              (SELECT COUNT(*) FROM course_modules AS m
               WHERE m.course_id = c.id) AS module_count,
              (SELECT COUNT(*) FROM lessons AS l
               JOIN course_modules AS m ON m.id = l.module_id
               WHERE m.course_id = c.id) AS lesson_count
       FROM courses AS c
       JOIN users AS u ON u.id = c.instructor_id
       WHERE c.id = ? AND c.status = 'published' AND u.status = 'active'
       LIMIT 1`,
      [courseId],
    );
    if (!courses[0]) {
      response.status(404).json({ error: 'Published course not found.' });
      return;
    }
    response.json({
      course: {
        ...courses[0],
        id: String(courses[0].id),
        estimated_minutes: Number(courses[0].estimated_minutes),
        module_count: Number(courses[0].module_count),
        lesson_count: Number(courses[0].lesson_count),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function listStudentCourses(request, response, next) {
  try {
    const pool = getDbPool();
    const [courses] = await pool.execute(
      `SELECT c.id, c.title, c.description, c.difficulty, c.estimated_minutes, e.status AS enrollment_status,
              (SELECT COUNT(*) FROM course_modules AS m
               WHERE m.course_id = c.id) AS module_count,
              (SELECT COUNT(*) FROM lessons AS l
               JOIN course_modules AS m ON m.id = l.module_id
               WHERE m.course_id = c.id) AS lesson_count,
              (SELECT COUNT(*) FROM lesson_progress AS lp
               JOIN lessons AS l ON l.id = lp.lesson_id
               JOIN course_modules AS m ON m.id = l.module_id
               WHERE lp.enrollment_id = e.id AND m.course_id = c.id
                 AND lp.status = 'completed') AS completed_lessons,
              (SELECT COUNT(*) FROM lessons AS l
               JOIN course_modules AS m ON m.id = l.module_id
               WHERE m.course_id = c.id AND l.is_published = TRUE) AS certificate_required_lessons,
              (SELECT COUNT(*) FROM lesson_progress AS lp
               JOIN lessons AS l ON l.id = lp.lesson_id
               JOIN course_modules AS m ON m.id = l.module_id
               WHERE lp.enrollment_id = e.id AND m.course_id = c.id
                 AND l.is_published = TRUE AND lp.status = 'completed') AS certificate_completed_lessons,
              (SELECT COUNT(*) FROM exercises AS exercise
               JOIN lessons AS l ON l.id = exercise.lesson_id
               JOIN course_modules AS m ON m.id = l.module_id
               WHERE m.course_id = c.id AND l.is_published = TRUE) AS certificate_required_exercises,
              (SELECT COUNT(*) FROM exercises AS exercise
               JOIN lessons AS l ON l.id = exercise.lesson_id
               JOIN course_modules AS m ON m.id = l.module_id
               WHERE m.course_id = c.id AND l.is_published = TRUE
                 AND EXISTS (SELECT 1 FROM exercise_submissions AS submission
                             WHERE submission.enrollment_id = e.id
                               AND submission.exercise_id = exercise.id AND submission.status = 'passed'))
                AS certificate_passed_exercises,
              (SELECT COUNT(*) FROM quizzes AS quiz
               WHERE quiz.course_id = c.id AND quiz.is_published = TRUE) AS certificate_required_quizzes,
              (SELECT COUNT(*) FROM quizzes AS quiz
               WHERE quiz.course_id = c.id AND quiz.is_published = TRUE
                 AND EXISTS (SELECT 1 FROM quiz_attempts AS attempt
                             WHERE attempt.enrollment_id = e.id AND attempt.quiz_id = quiz.id
                               AND attempt.status IN ('submitted', 'graded') AND attempt.passed = TRUE))
                AS certificate_passed_quizzes,
              certificate.id AS certificate_id, certificate.certificate_code,
              certificate.status AS certificate_status, certificate.issued_at AS certificate_issued_at,
              certificate.instructor_note AS certificate_instructor_note,
              certificate.admin_note AS certificate_admin_note
       FROM enrollments AS e
       JOIN courses AS c ON c.id = e.course_id
       LEFT JOIN certificates AS certificate ON certificate.enrollment_id = e.id
       WHERE e.student_id = ? AND e.status IN ('active', 'completed')
       ORDER BY e.enrolled_at DESC`,
      [request.auth.userId],
    );
    response.json({
      courses: courses.map((course) => ({
        ...course,
        id: String(course.id),
        estimated_minutes: Number(course.estimated_minutes),
        module_count: Number(course.module_count),
        lesson_count: Number(course.lesson_count),
        completed_lessons: Number(course.completed_lessons),
        certificate_id: course.certificate_id === null ? null : String(course.certificate_id),
        certificate_code: course.certificate_status === 'issued' ? course.certificate_code : null,
        certificate_required_lessons: Number(course.certificate_required_lessons),
        certificate_completed_lessons: Number(course.certificate_completed_lessons),
        certificate_required_exercises: Number(course.certificate_required_exercises),
        certificate_passed_exercises: Number(course.certificate_passed_exercises),
        certificate_required_quizzes: Number(course.certificate_required_quizzes),
        certificate_passed_quizzes: Number(course.certificate_passed_quizzes),
        certificate_eligible: Number(course.certificate_required_lessons) > 0
          && Number(course.certificate_completed_lessons) === Number(course.certificate_required_lessons)
          && Number(course.certificate_passed_exercises) === Number(course.certificate_required_exercises)
          && Number(course.certificate_passed_quizzes) === Number(course.certificate_required_quizzes),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function enrollInCourse(request, response, next) {
  const { courseId } = request.params;
  if (!validId(courseId)) {
    rejectInvalid(response, 'Invalid course ID.');
    return;
  }

  try {
    const pool = getDbPool();
    const [courses] = await pool.execute(
      `SELECT id FROM courses WHERE id = ? AND status = 'published' LIMIT 1`,
      [courseId],
    );
    if (!courses[0]) {
      response.status(404).json({ error: 'Published course not found.' });
      return;
    }
    const [existingEnrollment] = await pool.execute(
      `SELECT id, status FROM enrollments WHERE student_id = ? AND course_id = ? LIMIT 1`,
      [request.auth.userId, courseId],
    );
    if (existingEnrollment[0]?.status === 'active' || existingEnrollment[0]?.status === 'completed') {
      response.json({ message: 'You are already enrolled in this course.', alreadyEnrolled: true });
      return;
    }
    await pool.execute(
      `INSERT INTO enrollments (student_id, course_id, status)
       VALUES (?, ?, 'active')
       ON DUPLICATE KEY UPDATE status = 'active'`,
      [request.auth.userId, courseId],
    );
    response.status(201).json({ message: 'You are enrolled in this course.' });
  } catch (error) {
    next(error);
  }
}

async function getActiveEnrollment(pool, courseId, userId) {
  const [rows] = await pool.execute(
    `SELECT id FROM enrollments
     WHERE course_id = ? AND student_id = ? AND status IN ('active', 'completed')
     LIMIT 1`,
    [courseId, userId],
  );
  return rows[0];
}

export async function getStudentCourse(request, response, next) {
  const { courseId } = request.params;
  if (!validId(courseId)) {
    rejectInvalid(response, 'Invalid course ID.');
    return;
  }

  try {
    // Course content is edited independently from the student workspace. Keep
    // intermediary/browser caches from serving a stale sidebar after changes.
    response.set('Cache-Control', 'no-store');
    const pool = getDbPool();
    const enrollment = await getActiveEnrollment(pool, courseId, request.auth.userId);
    if (!enrollment) {
      response.status(403).json({ error: 'Enroll in this published course to access its lessons.' });
      return;
    }
    const [courseRows] = await pool.execute(
      `SELECT c.id, c.title, c.description, c.difficulty, c.estimated_minutes,
              u.full_name AS instructor_name
       FROM courses AS c
       JOIN users AS u ON u.id = c.instructor_id
       WHERE c.id = ? AND c.status IN ('published', 'archived')
       LIMIT 1`,
      [courseId],
    );
    if (!courseRows[0]) {
      response.status(404).json({ error: 'Course not found.' });
      return;
    }
    const [modules] = await pool.execute(
      `SELECT module.id, module.title, module.description, module.position,
              COUNT(lesson.id) AS lesson_count
       FROM course_modules AS module
       LEFT JOIN lessons AS lesson ON lesson.module_id = module.id
       WHERE module.course_id = ?
       GROUP BY module.id, module.title, module.description, module.position
       ORDER BY module.position, module.id`,
      [courseId],
    );
    const [lessons] = await pool.execute(
      `SELECT l.id, l.module_id, l.title, l.content, l.code_example,
              l.estimated_minutes, l.position,
              EXISTS(
                SELECT 1 FROM lesson_progress AS lp
                WHERE lp.enrollment_id = ? AND lp.lesson_id = l.id AND lp.status = 'completed'
              ) AS is_completed
       FROM lessons AS l
       JOIN course_modules AS m ON m.id = l.module_id
       WHERE m.course_id = ?
       ORDER BY m.position, l.position, l.id`,
      [enrollment.id, courseId],
    );
    const [materials] = await pool.execute(
      `SELECT id, lesson_id, original_name, mime_type, file_size
       FROM course_materials WHERE course_id = ? ORDER BY created_at`,
      [courseId],
    );
    const [exercises] = await pool.execute(
      `SELECT e.id, e.lesson_id, e.title, e.instructions, e.exercise_type,
              e.starter_html, e.starter_css, e.starter_javascript
       FROM exercises AS e
       JOIN lessons AS l ON l.id = e.lesson_id
       JOIN course_modules AS m ON m.id = l.module_id
       WHERE m.course_id = ?
       ORDER BY e.position, e.id`,
      [courseId],
    );
    const [exerciseSubmissions] = await pool.execute(
      `SELECT s.exercise_id, s.submitted_html, s.submitted_css, s.submitted_javascript,
              s.answer_text, s.status, s.score, s.feedback, s.submitted_at
       FROM exercise_submissions s
       JOIN exercises e ON e.id = s.exercise_id
       JOIN lessons l ON l.id = e.lesson_id
       JOIN course_modules m ON m.id = l.module_id
       WHERE m.course_id = ? AND s.enrollment_id = ?
       ORDER BY s.submitted_at DESC, s.id DESC`,
      [courseId, enrollment.id],
    );
    const [quizzes] = await pool.execute(
      `SELECT id, lesson_id, title, description, pass_percentage
       FROM quizzes WHERE course_id = ? AND is_published = TRUE ORDER BY created_at, id`,
      [courseId],
    );
    const [questions] = await pool.execute(
      `SELECT question.id, question.quiz_id, question.prompt, question.position,
              option.id AS option_id, option.option_text, option.position AS option_position
       FROM questions AS question
       JOIN quizzes AS quiz ON quiz.id = question.quiz_id
       LEFT JOIN question_options AS option ON option.question_id = question.id
       WHERE quiz.course_id = ? AND quiz.is_published = TRUE
       ORDER BY quiz.id, question.position, option.position`,
      [courseId],
    );
    const [attempts] = await pool.execute(
      `SELECT quiz_id, MAX(score) AS best_score, MAX(passed) AS passed
       FROM quiz_attempts
       WHERE enrollment_id = ? AND status IN ('submitted', 'graded')
       GROUP BY quiz_id`,
      [enrollment.id],
    );
    const modulesById = new Map(modules.map((module) => [
      String(module.id),
      { ...module, id: String(module.id), lesson_count: Number(module.lesson_count), lessons: [] },
    ]));
    const lessonsById = new Map();
    for (const lesson of lessons) {
      const current = {
        ...lesson,
        id: String(lesson.id),
        module_id: String(lesson.module_id),
        is_completed: Boolean(lesson.is_completed),
        materials: [],
        exercises: [],
      };
      modulesById.get(String(lesson.module_id)).lessons.push(current);
      lessonsById.set(String(lesson.id), current);
    }
    for (const material of materials) {
      lessonsById.get(String(material.lesson_id))?.materials.push({
        ...material,
        id: String(material.id),
        lesson_id: String(material.lesson_id),
        url: `/api/materials/${material.id}`,
      });
    }
    for (const exercise of exercises) {
      lessonsById.get(String(exercise.lesson_id))?.exercises.push({
        ...exercise,
        id: String(exercise.id),
        lesson_id: String(exercise.lesson_id),
        submissions: [],
      });
    }
    const exercisesById = new Map([...lessonsById.values()].flatMap((lesson) => lesson.exercises.map((exercise) => [String(exercise.id), exercise])));
    for (const submission of exerciseSubmissions) {
      exercisesById.get(String(submission.exercise_id))?.submissions.push({
        ...submission,
        submitted_at: submission.submitted_at,
      });
    }
    const quizzesById = new Map(quizzes.map((quiz) => [
      String(quiz.id),
      {
        ...quiz,
        id: String(quiz.id),
        lesson_id: quiz.lesson_id === null ? null : String(quiz.lesson_id),
        pass_percentage: Number(quiz.pass_percentage),
        questions: [],
      },
    ]));
    for (const row of questions) {
      const quiz = quizzesById.get(String(row.quiz_id));
      if (!quiz) continue;
      let question = quiz.questions.find((item) => item.id === String(row.id));
      if (!question) {
        question = { id: String(row.id), prompt: row.prompt, options: [] };
        quiz.questions.push(question);
      }
      if (row.option_id !== null) {
        question.options.push({ id: String(row.option_id), text: row.option_text });
      }
    }
    const attemptsByQuizId = new Map(attempts.map((attempt) => [String(attempt.quiz_id), attempt]));

    const [certificateRows] = await pool.execute(
      `SELECT id, certificate_code, status, instructor_note, admin_note
       FROM certificates
       WHERE enrollment_id = ?
       LIMIT 1`,
      [enrollment.id],
    );

    response.json({
      course: {
        ...courseRows[0],
        id: String(courseRows[0].id),
        estimated_minutes: Number(courseRows[0].estimated_minutes),
        module_count: modulesById.size,
        lesson_count: lessons.length,
        enrollment_id: String(enrollment.id),
        certificate: certificateRows[0] ? {
          id: String(certificateRows[0].id),
          code: certificateRows[0].certificate_code,
          status: certificateRows[0].status,
          instructor_note: certificateRows[0].instructor_note,
          admin_note: certificateRows[0].admin_note,
        } : null,
        modules: [...modulesById.values()],
        quizzes: [...quizzesById.values()].map((quiz) => ({
          ...quiz,
          best_score: attemptsByQuizId.has(quiz.id) && attemptsByQuizId.get(quiz.id).best_score !== null
            ? Number(attemptsByQuizId.get(quiz.id).best_score)
            : null,
          passed: Boolean(attemptsByQuizId.get(quiz.id)?.passed),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function completeLesson(request, response, next) {
  const { lessonId } = request.params;
  if (!validId(lessonId)) {
    rejectInvalid(response, 'Invalid lesson ID.');
    return;
  }

  try {
    const pool = getDbPool();
    const [rows] = await pool.execute(
      `SELECT e.id AS enrollment_id
       FROM lessons AS l
       JOIN course_modules AS m ON m.id = l.module_id
       JOIN courses AS c ON c.id = m.course_id
       JOIN enrollments AS e ON e.course_id = c.id
       WHERE l.id = ? AND c.status IN ('published', 'archived')
         AND e.student_id = ? AND e.status IN ('active', 'completed')
       LIMIT 1`,
      [lessonId, request.auth.userId],
    );
    if (!rows[0]) {
      response.status(404).json({ error: 'Lesson not found in an enrolled course.' });
      return;
    }
    await pool.execute(
      `INSERT INTO lesson_progress (enrollment_id, lesson_id, status, completed_at, last_visited_at)
       VALUES (?, ?, 'completed', UTC_TIMESTAMP(), UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE status = 'completed',
         completed_at = COALESCE(completed_at, UTC_TIMESTAMP()),
         last_visited_at = UTC_TIMESTAMP()`,
      [rows[0].enrollment_id, lessonId],
    );
    response.json({ message: 'Lesson marked complete.' });
  } catch (error) {
    next(error);
  }
}

export async function submitQuizAttempt(request, response, next) {
  const { quizId } = request.params;
  const { answers } = request.body ?? {};
  if (!validId(quizId) || !Array.isArray(answers) || answers.length < 1 || answers.length > 100) {
    rejectInvalid(response, 'Submit answers for a valid quiz.');
    return;
  }
  const seenQuestions = new Set();
  for (const answer of answers) {
    if (
      !answer
      || !validId(String(answer.questionId))
      || !validId(String(answer.optionId))
      || seenQuestions.has(String(answer.questionId))
    ) {
      rejectInvalid(response, 'Each quiz question must have one valid answer.');
      return;
    }
    seenQuestions.add(String(answer.questionId));
  }

  let connection;
  try {
    const pool = getDbPool();
    const [quizzes] = await pool.execute(
      `SELECT q.id, q.course_id, q.pass_percentage
       FROM quizzes AS q
       JOIN courses AS c ON c.id = q.course_id
       JOIN enrollments AS e ON e.course_id = c.id
       WHERE q.id = ? AND q.is_published = TRUE AND c.status IN ('published', 'archived')
         AND e.student_id = ? AND e.status IN ('active', 'completed')
       LIMIT 1`,
      [quizId, request.auth.userId],
    );
    if (!quizzes[0]) {
      response.status(404).json({ error: 'Quiz not found in an enrolled course.' });
      return;
    }
    const enrollment = await getActiveEnrollment(pool, String(quizzes[0].course_id), request.auth.userId);
    if (!enrollment) {
      response.status(404).json({ error: 'Course enrollment not found.' });
      return;
    }
    const [questions] = await pool.execute(
      `SELECT question.id, question.points
       FROM questions AS question
       WHERE question.quiz_id = ? ORDER BY question.position`,
      [quizId],
    );
    if (
      questions.length === 0
      || answers.length !== questions.length
      || questions.some((question) => !seenQuestions.has(String(question.id)))
    ) {
      rejectInvalid(response, 'Answer every question in the quiz exactly once.');
      return;
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [previousAttempts] = await connection.execute(
      'SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_attempt FROM quiz_attempts WHERE quiz_id = ? AND enrollment_id = ?',
      [quizId, enrollment.id],
    );
    const [attemptResult] = await connection.execute(
      `INSERT INTO quiz_attempts (quiz_id, enrollment_id, attempt_number, status)
       VALUES (?, ?, ?, 'in_progress')`,
      [quizId, enrollment.id, previousAttempts[0].next_attempt],
    );
    let earnedPoints = 0;
    const possiblePoints = questions.reduce((total, question) => total + Number(question.points), 0);
    for (const answer of answers) {
      const [options] = await connection.execute(
        `SELECT option.id, option.is_correct, question.points
         FROM question_options AS option
         JOIN questions AS question ON question.id = option.question_id
         WHERE option.id = ? AND question.id = ? AND question.quiz_id = ?
         LIMIT 1`,
        [answer.optionId, answer.questionId, quizId],
      );
      if (!options[0]) {
        await connection.rollback();
        rejectInvalid(response, 'An answer option does not belong to this quiz question.');
        return;
      }
      const correct = Boolean(options[0].is_correct);
      const points = correct ? Number(options[0].points) : 0;
      earnedPoints += points;
      await connection.execute(
        `INSERT INTO quiz_answers
           (attempt_id, question_id, selected_option_id, is_correct, awarded_points)
         VALUES (?, ?, ?, ?, ?)`,
        [attemptResult.insertId, answer.questionId, answer.optionId, correct, points],
      );
    }
    const score = possiblePoints ? (earnedPoints / possiblePoints) * 100 : 0;
    const passed = score >= Number(quizzes[0].pass_percentage);
    await connection.execute(
      `UPDATE quiz_attempts
       SET status = 'submitted', score = ?, passed = ?, submitted_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [score, passed, attemptResult.insertId],
    );
    await connection.commit();
    response.status(201).json({ score: Number(score.toFixed(2)), passed });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
}

export async function submitExercise(request, response, next) {
  const { exerciseId } = request.params;
  const { html = '', css = '', javascript = '', answerText = '' } = request.body ?? {};
  if (
    !validId(exerciseId)
    || [html, css, javascript, answerText].some((value) => typeof value !== 'string' || value.length > 100000)
  ) {
    rejectInvalid(response, 'Exercise response is too long or invalid.');
    return;
  }

  try {
    const pool = getDbPool();
    const [rows] = await pool.execute(
      `SELECT e.id, en.id AS enrollment_id
       FROM exercises AS e
       JOIN lessons AS l ON l.id = e.lesson_id
       JOIN course_modules AS m ON m.id = l.module_id
       JOIN courses AS c ON c.id = m.course_id
       JOIN enrollments AS en ON en.course_id = c.id
       WHERE e.id = ? AND c.status IN ('published', 'archived')
         AND en.student_id = ? AND en.status IN ('active', 'completed')
       LIMIT 1`,
      [exerciseId, request.auth.userId],
    );
    if (!rows[0]) {
      response.status(404).json({ error: 'Exercise not found in an enrolled course.' });
      return;
    }
    await pool.execute(
      `INSERT INTO exercise_submissions
         (exercise_id, enrollment_id, submitted_html, submitted_css, submitted_javascript, answer_text)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [exerciseId, rows[0].enrollment_id, html || null, css || null, javascript || null, answerText || null],
    );
    response.status(201).json({ message: 'Your exercise response was submitted.' });
  } catch (error) {
    next(error);
  }
}
