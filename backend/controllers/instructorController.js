import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDbPool } from '../config/db.js';
import { getCertificateRequirements } from './certificateController.js';
import { starterCatalog, starterCode, starterExercise, starterLessonContent, starterQuizPair } from '../content/starterCatalog.js';

const STARTER_LESSON_LIMIT = 6;

const starterTitleAliases = {
  'HTML & CSS': ['HTML & CSS Foundations'],
  JavaScript: ['JavaScript Essentials'],
};

function validId(value) {
  return typeof value === 'string' && /^\d+$/.test(value) && value !== '0';
}

function slugPart(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 150);
}

function validText(value, maxLength, allowEmpty = false) {
  return typeof value === 'string'
    && value.length <= maxLength
    && (allowEmpty || value.trim().length > 0);
}

function rejectInvalid(response, message) {
  response.status(400).json({ error: message });
}

async function getOwnedCourse(pool, courseId, userId) {
  const [rows] = await pool.execute(
    'SELECT id FROM courses WHERE id = ? AND instructor_id = ? LIMIT 1',
    [courseId, userId],
  );
  return rows[0];
}

async function getOwnedLesson(pool, lessonId, userId) {
  const [rows] = await pool.execute(
    `SELECT l.id, m.course_id
     FROM lessons AS l
     JOIN course_modules AS m ON m.id = l.module_id
     JOIN courses AS c ON c.id = m.course_id
     WHERE l.id = ? AND c.instructor_id = ?
     LIMIT 1`,
    [lessonId, userId],
  );
  return rows[0];
}

async function getOwnedQuiz(pool, quizId, userId) {
  const [rows] = await pool.execute(
    `SELECT q.id, q.course_id,
            EXISTS(SELECT 1 FROM quiz_attempts AS attempt WHERE attempt.quiz_id = q.id) AS has_attempts
     FROM quizzes AS q JOIN courses AS c ON c.id = q.course_id
     WHERE q.id = ? AND c.instructor_id = ? LIMIT 1`,
    [quizId, userId],
  );
  return rows[0];
}

function validQuestionPayload(body) {
  return validText(body?.prompt, 2000)
    && Array.isArray(body.options)
    && body.options.length >= 2
    && body.options.length <= 6
    && body.options.every((option) => validText(option, 500))
    && Number.isInteger(body.correctOption)
    && body.correctOption >= 0
    && body.correctOption < body.options.length;
}

export async function listCourses(request, response, next) {
  try {
    const pool = getDbPool();
    const [courses] = await pool.execute(
      `SELECT c.id, c.title, c.slug, c.description, c.difficulty, c.estimated_minutes,
              c.status, c.created_at, c.updated_at,
              (SELECT COUNT(*) FROM course_modules AS m
               WHERE m.course_id = c.id) AS module_count,
              (SELECT COUNT(*) FROM lessons AS l
               JOIN course_modules AS m ON m.id = l.module_id
               WHERE m.course_id = c.id) AS lesson_count,
              (SELECT COUNT(*) FROM enrollments AS e
               WHERE e.course_id = c.id) AS student_count,
              (SELECT COUNT(*) FROM exercise_submissions AS submission
               JOIN exercises AS exercise ON exercise.id = submission.exercise_id
               JOIN lessons AS l ON l.id = exercise.lesson_id
               JOIN course_modules AS m ON m.id = l.module_id
               WHERE m.course_id = c.id) AS exercise_submission_count,
              (SELECT COUNT(*) FROM quiz_attempts AS attempt
               JOIN quizzes AS quiz ON quiz.id = attempt.quiz_id
               WHERE quiz.course_id = c.id AND attempt.status IN ('submitted', 'graded')) AS quiz_attempt_count,
              (SELECT COUNT(*) FROM certificates AS certificate
               JOIN enrollments AS enrollment ON enrollment.id = certificate.enrollment_id
               WHERE enrollment.course_id = c.id AND certificate.status = 'pending_instructor')
                AS pending_certificate_count
       FROM courses AS c
       WHERE c.instructor_id = ?
       ORDER BY c.updated_at DESC, c.id DESC`,
      [request.auth.userId],
    );
    response.json({
      courses: courses.map((course) => ({
        ...course,
        module_count: Number(course.module_count),
        lesson_count: Number(course.lesson_count),
        pending_certificate_count: Number(course.pending_certificate_count),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function createCourse(request, response, next) {
  const { title, description, difficulty = 'beginner', estimatedMinutes = 0 } = request.body ?? {};
  const minutes = Number(estimatedMinutes);
  if (
    !validText(title, 180)
    || !validText(description, 10000)
    || !['beginner', 'intermediate', 'advanced'].includes(difficulty)
    || !Number.isInteger(minutes)
    || minutes < 0
    || minutes > 100000
  ) {
    rejectInvalid(response, 'Enter a course title, description, valid difficulty, and non-negative estimated time.');
    return;
  }

  try {
    const pool = getDbPool();
    const slug = `${slugPart(title) || 'course'}-${randomUUID().slice(0, 8)}`;
    const [result] = await pool.execute(
      `INSERT INTO courses (instructor_id, title, slug, description, difficulty, estimated_minutes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [request.auth.userId, title.trim(), slug, description.trim(), difficulty, minutes],
    );
    response.status(201).json({ course: { id: String(result.insertId), title: title.trim(), status: 'draft' } });
  } catch (error) {
    next(error);
  }
}

export async function createStarterCourses(request, response, next) {
  let connection;
  try {
    connection = await getDbPool().getConnection();
    await connection.beginTransaction();
    const titlesToReplace = starterCatalog.flatMap((course) => [
      course.title,
      ...(starterTitleAliases[course.title] ?? []),
    ]);
    const titlePlaceholders = titlesToReplace.map(() => '?').join(', ');
    const [existing] = await connection.execute(
      `SELECT id, title FROM courses WHERE instructor_id = ? AND title IN (${titlePlaceholders}) FOR UPDATE`,
      [request.auth.userId, ...titlesToReplace],
    );
    const existingByTitle = new Map();
    for (const course of existing) {
      const matching = existingByTitle.get(course.title) ?? [];
      matching.push(course);
      existingByTitle.set(course.title, matching);
    }
    const createdCourses = [];
    const preservedCourses = [];

    for (const starter of starterCatalog) {
      const previousCourses = [
        starter.title,
        ...(starterTitleAliases[starter.title] ?? []),
      ].flatMap((title) => existingByTitle.get(title) ?? []);
      for (const previousCourse of previousCourses) {
        const [enrollments] = await connection.execute(
          'SELECT COUNT(*) AS enrollment_count FROM enrollments WHERE course_id = ?',
          [previousCourse.id],
        );
        if (Number(enrollments[0].enrollment_count) > 0) {
          // Keep records used by students, but move them aside so a fresh
          // course with the requested canonical title can be created below.
          const legacyTitle = `${starter.title} (previous version ${previousCourse.id})`;
          await connection.execute(
            "UPDATE courses SET title = ?, status = 'archived' WHERE id = ? AND instructor_id = ?",
            [legacyTitle, previousCourse.id, request.auth.userId],
          );
          preservedCourses.push(starter.title);
        } else {
          // Schema cascades remove the old modules, lessons, exercises, and quizzes.
          await connection.execute('DELETE FROM courses WHERE id = ? AND instructor_id = ?', [previousCourse.id, request.auth.userId]);
        }
      }
      const slug = `${slugPart(starter.title)}-${randomUUID().slice(0, 8)}`;
      const [courseResult] = await connection.execute(
        `INSERT INTO courses
           (instructor_id, title, slug, description, difficulty, estimated_minutes, status, published_at)
         VALUES (?, ?, ?, ?, ?, ?, 'published', CURRENT_TIMESTAMP)`,
        [
          request.auth.userId, starter.title, slug, starter.description,
          starter.difficulty, starter.estimatedMinutes,
        ],
      );
      let lessonPosition = 0;
      let moduleCount = 0;
      for (const [moduleIndex, group] of starter.groups.entries()) {
        if (lessonPosition >= STARTER_LESSON_LIMIT) break;
        const [moduleResult] = await connection.execute(
          `INSERT INTO course_modules (course_id, title, description, position)
           VALUES (?, ?, ?, ?)`,
          [courseResult.insertId, group.moduleTitle, `Lessons about ${group.moduleTitle.toLowerCase()}.`, moduleIndex + 1],
        );
        moduleCount += 1;
        for (const [topicIndex, lessonTitle] of group.lessons.entries()) {
          if (lessonPosition >= STARTER_LESSON_LIMIT) break;
          lessonPosition += 1;
          const exampleIndex = lessonPosition - 1;
          const example = starterCode(starter.title, exampleIndex, lessonTitle);
          const [lessonResult] = await connection.execute(
            `INSERT INTO lessons
               (module_id, title, slug, content, code_example, estimated_minutes, position, is_published)
             VALUES (?, ?, ?, ?, ?, 30, ?, TRUE)`,
            [moduleResult.insertId, lessonTitle, `${slugPart(lessonTitle)}-${randomUUID().slice(0, 8)}`, starterLessonContent(starter.title, group.moduleTitle, lessonTitle), example, topicIndex + 1],
          );
          const exercise = starterExercise(starter.title, lessonTitle, example);
          await connection.execute(
            `INSERT INTO exercises
               (lesson_id, title, instructions, exercise_type, starter_html, starter_css, starter_javascript, position)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [lessonResult.insertId, exercise.title, exercise.instructions, exercise.exerciseType, exercise.starterHtml || null, exercise.starterCss || null, exercise.starterJavascript || null],
          );
          const quizzes = starterQuizPair(starter.title, lessonTitle);
          for (const quiz of quizzes) {
            const [quizResult] = await connection.execute(
              `INSERT INTO quizzes (course_id, lesson_id, title, description, pass_percentage, is_published)
               VALUES (?, ?, ?, ?, 70, TRUE)`,
              [courseResult.insertId, lessonResult.insertId, quiz.title, `A quick check for ${lessonTitle.toLowerCase()}.`],
            );
            const [questionResult] = await connection.execute(
              `INSERT INTO questions (quiz_id, question_type, prompt, position)
               VALUES (?, 'multiple_choice', ?, 1)`,
              [quizResult.insertId, quiz.question],
            );
            for (const [position, optionText] of quiz.options.entries()) {
              await connection.execute(
                `INSERT INTO question_options (question_id, option_text, is_correct, position)
                 VALUES (?, ?, ?, ?)`,
                [questionResult.insertId, optionText, position === 0, position + 1],
              );
            }
          }
        }
      }
      createdCourses.push({ id: String(courseResult.insertId), title: starter.title, status: 'published', module_count: moduleCount, lesson_count: lessonPosition, exercise_count: lessonPosition, quiz_count: lessonPosition * 2 });
    }

    await connection.commit();
    response.status(201).json({
      courses: createdCourses,
      preservedCourses,
      message: createdCourses.length
        ? `Added and published all six new courses, each with ${createdCourses[0].module_count} modules, ${createdCourses[0].lesson_count} lessons, ${createdCourses[0].exercise_count} exercises, and ${createdCourses[0].quiz_count} quizzes. All content is editable.${preservedCourses.length ? ` Archived ${preservedCourses.length} previous course${preservedCourses.length === 1 ? '' : 's'} with student history so enrolled students keep access to their records.` : ''}`
        : 'The six courses could not be added.',
    });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
}

export async function getCourse(request, response, next) {
  const { courseId } = request.params;
  if (!validId(courseId)) {
    rejectInvalid(response, 'Invalid course ID.');
    return;
  }

  try {
    const pool = getDbPool();
    const [courseRows] = await pool.execute(
      `SELECT id, title, slug, description, difficulty, estimated_minutes, status, created_at, updated_at
       FROM courses WHERE id = ? AND instructor_id = ? LIMIT 1`,
      [courseId, request.auth.userId],
    );
    const course = courseRows[0];
    if (!course) {
      response.status(404).json({ error: 'Course not found.' });
      return;
    }

    const [modules] = await pool.execute(
      `SELECT id, title, description, position FROM course_modules
       WHERE course_id = ? ORDER BY position, id`,
      [courseId],
    );
    const [lessons] = await pool.execute(
      `SELECT l.id, l.module_id, l.title, l.content, l.code_example,
              l.estimated_minutes, l.position, l.is_published
       FROM lessons AS l
       JOIN course_modules AS m ON m.id = l.module_id
       WHERE m.course_id = ? ORDER BY m.position, l.position, l.id`,
      [courseId],
    );
    const [materials] = await pool.execute(
      `SELECT cm.id, cm.lesson_id, cm.original_name, cm.mime_type,
              cm.file_size, cm.created_at
       FROM course_materials AS cm
       WHERE cm.course_id = ? ORDER BY cm.created_at DESC`,
      [courseId],
    );
    const [exercises] = await pool.execute(
      `SELECT e.id, e.lesson_id, e.title, e.instructions, e.exercise_type,
              e.starter_html, e.starter_css, e.starter_javascript, e.position
       FROM exercises AS e
       JOIN lessons AS l ON l.id = e.lesson_id
       JOIN course_modules AS m ON m.id = l.module_id
       WHERE m.course_id = ? ORDER BY e.position, e.id`,
      [courseId],
    );
    const [quizzes] = await pool.execute(
      `SELECT q.id, q.title, q.description, q.pass_percentage, q.is_published,
              (SELECT COUNT(*) FROM questions AS question WHERE question.quiz_id = q.id) AS question_count
       FROM quizzes AS q WHERE q.course_id = ? ORDER BY q.created_at DESC`,
      [courseId],
    );
    const [quizQuestionRows] = await pool.execute(
      `SELECT question.id, question.quiz_id, question.prompt, question.position,
              answer.id AS option_id, answer.option_text, answer.is_correct, answer.position AS option_position
       FROM questions AS question JOIN quizzes AS quiz ON quiz.id = question.quiz_id
       LEFT JOIN question_options AS answer ON answer.question_id = question.id
       WHERE quiz.course_id = ? ORDER BY quiz.id, question.position, answer.position`,
      [courseId],
    );

    const modulesById = new Map(modules.map((module) => [
      String(module.id),
      { ...module, id: String(module.id), lessons: [] },
    ]));
    for (const lesson of lessons) {
      modulesById.get(String(lesson.module_id)).lessons.push({
        ...lesson,
        id: String(lesson.id),
        module_id: String(lesson.module_id),
        materials: [],
        exercises: [],
      });
    }
    const lessonsById = new Map(
      [...modulesById.values()].flatMap((module) => module.lessons.map((lesson) => [lesson.id, lesson])),
    );
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
      });
    }

    const quizzesById = new Map(quizzes.map((quiz) => [String(quiz.id), {
      ...quiz,
      id: String(quiz.id),
      question_count: Number(quiz.question_count),
      pass_percentage: Number(quiz.pass_percentage),
      is_published: Boolean(quiz.is_published),
      questions: [],
    }]));
    for (const row of quizQuestionRows) {
      const quiz = quizzesById.get(String(row.quiz_id));
      if (!quiz) continue;
      let question = quiz.questions.find((item) => item.id === String(row.id));
      if (!question) {
        question = { id: String(row.id), prompt: row.prompt, options: [] };
        quiz.questions.push(question);
      }
      if (row.option_id !== null) question.options.push({ id: String(row.option_id), text: row.option_text, is_correct: Boolean(row.is_correct) });
    }

    response.json({
      course: {
        ...course,
        id: String(course.id),
        estimated_minutes: Number(course.estimated_minutes),
        modules: [...modulesById.values()],
        quizzes: [...quizzesById.values()],
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCourse(request, response, next) {
  const { courseId } = request.params;
  if (!validId(courseId)) {
    rejectInvalid(response, 'Invalid course ID.');
    return;
  }
  const body = request.body ?? {};
  const allowedFields = ['title', 'description', 'difficulty', 'estimatedMinutes'];
  if (!allowedFields.some((field) => Object.hasOwn(body, field))) {
    rejectInvalid(response, 'Provide at least one course field to update.');
    return;
  }

  const updates = [];
  const values = [];
  if (Object.hasOwn(body, 'title')) {
    if (!validText(body.title, 180)) {
      rejectInvalid(response, 'Course title is required and must be 180 characters or fewer.');
      return;
    }
    updates.push('title = ?');
    values.push(body.title.trim());
  }
  if (Object.hasOwn(body, 'description')) {
    if (!validText(body.description, 10000)) {
      rejectInvalid(response, 'Course description is required and must be 10,000 characters or fewer.');
      return;
    }
    updates.push('description = ?');
    values.push(body.description.trim());
  }
  if (Object.hasOwn(body, 'difficulty')) {
    if (!['beginner', 'intermediate', 'advanced'].includes(body.difficulty)) {
      rejectInvalid(response, 'Choose a valid course difficulty.');
      return;
    }
    updates.push('difficulty = ?');
    values.push(body.difficulty);
  }
  if (Object.hasOwn(body, 'estimatedMinutes')) {
    const minutes = Number(body.estimatedMinutes);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 100000) {
      rejectInvalid(response, 'Estimated course time must be a non-negative whole number.');
      return;
    }
    updates.push('estimated_minutes = ?');
    values.push(minutes);
  }

  try {
    const pool = getDbPool();
    const owned = await getOwnedCourse(pool, courseId, request.auth.userId);
    if (!owned) {
      response.status(404).json({ error: 'Course not found.' });
      return;
    }
    if (Object.hasOwn(body, 'title')) {
      updates.push('slug = ?');
      values.push(`${slugPart(body.title) || 'course'}-${randomUUID().slice(0, 8)}`);
    }
    await pool.execute(
      `UPDATE courses SET ${updates.join(', ')} WHERE id = ? AND instructor_id = ?`,
      [...values, courseId, request.auth.userId],
    );
    response.json({ message: 'Course updated.' });
  } catch (error) {
    next(error);
  }
}

export async function updateCourseStatus(request, response, next) {
  const { courseId } = request.params;
  const { status } = request.body ?? {};
  if (!validId(courseId) || !['draft', 'published', 'archived'].includes(status)) {
    rejectInvalid(response, 'Choose a valid course and status.');
    return;
  }

  let connection;
  try {
    const pool = getDbPool();
    const owned = await getOwnedCourse(pool, courseId, request.auth.userId);
    if (!owned) {
      response.status(404).json({ error: 'Course not found.' });
      return;
    }
    if (status === 'published') {
      const [rows] = await pool.execute(
        `SELECT COUNT(*) AS lesson_count
         FROM lessons AS l JOIN course_modules AS m ON m.id = l.module_id
         WHERE m.course_id = ?`,
        [courseId],
      );
      if (Number(rows[0].lesson_count) === 0) {
        rejectInvalid(response, 'Add at least one lesson before publishing this course.');
        return;
      }
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE courses
       SET status = ?, published_at = CASE
         WHEN ? = 'published' THEN COALESCE(published_at, UTC_TIMESTAMP())
         ELSE published_at
       END
       WHERE id = ? AND instructor_id = ?`,
      [status, status, courseId, request.auth.userId],
    );
    await connection.execute(
      `UPDATE lessons AS l
       JOIN course_modules AS m ON m.id = l.module_id
       SET l.is_published = ?
       WHERE m.course_id = ?`,
      [status === 'published', courseId],
    );
    await connection.commit();
    response.json({ message: `Course ${status}.` });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
}

export async function deleteCourse(request, response, next) {
  const { courseId } = request.params;
  if (!validId(courseId)) return rejectInvalid(response, 'Invalid course ID.');
  try {
    const pool = getDbPool();
    const [result] = await pool.execute(
      `DELETE c FROM courses AS c
       WHERE c.id = ? AND c.instructor_id = ?
         AND NOT EXISTS (SELECT 1 FROM enrollments AS e WHERE e.course_id = c.id)`,
      [courseId, request.auth.userId],
    );
    if (!result.affectedRows) {
      const [owned] = await pool.execute('SELECT id FROM courses WHERE id = ? AND instructor_id = ?', [courseId, request.auth.userId]);
      if (!owned[0]) return response.status(404).json({ error: 'Course not found.' });
      return response.status(409).json({ error: 'This course has student records. Unpublish it to preserve their progress and submissions.' });
    }
    response.json({ message: 'Course deleted.' });
  } catch (error) { next(error); }
}

export async function createModule(request, response, next) {
  const { courseId } = request.params;
  const { title, description = '' } = request.body ?? {};
  if (!validId(courseId) || !validText(title, 180) || !validText(description, 5000, true)) {
    rejectInvalid(response, 'Enter a module title and a description of 5,000 characters or fewer.');
    return;
  }

  try {
    const pool = getDbPool();
    if (!await getOwnedCourse(pool, courseId, request.auth.userId)) {
      response.status(404).json({ error: 'Course not found.' });
      return;
    }
    const [positions] = await pool.execute(
      'SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM course_modules WHERE course_id = ?',
      [courseId],
    );
    const [result] = await pool.execute(
      `INSERT INTO course_modules (course_id, title, description, position)
       VALUES (?, ?, ?, ?)`,
      [courseId, title.trim(), description.trim() || null, positions[0].next_position],
    );
    response.status(201).json({
      module: { id: String(result.insertId), title: title.trim(), description: description.trim(), position: Number(positions[0].next_position), lessons: [] },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateModule(request, response, next) {
  const { moduleId } = request.params;
  const { title, description = '' } = request.body ?? {};
  if (!validId(moduleId) || !validText(title, 180) || !validText(description, 5000, true)) return rejectInvalid(response, 'Enter a module title and a description of 5,000 characters or fewer.');
  try {
    const pool = getDbPool();
    const [result] = await pool.execute(
      `UPDATE course_modules AS m JOIN courses AS c ON c.id = m.course_id
       SET m.title = ?, m.description = ? WHERE m.id = ? AND c.instructor_id = ?`,
      [title.trim(), description.trim() || null, moduleId, request.auth.userId],
    );
    if (!result.affectedRows) {
      const [rows] = await pool.execute('SELECT m.id FROM course_modules AS m JOIN courses AS c ON c.id = m.course_id WHERE m.id = ? AND c.instructor_id = ?', [moduleId, request.auth.userId]);
      if (!rows[0]) return response.status(404).json({ error: 'Module not found.' });
    }
    response.json({ message: 'Module updated.' });
  } catch (error) { next(error); }
}

export async function deleteModule(request, response, next) {
  const { moduleId } = request.params;
  if (!validId(moduleId)) return rejectInvalid(response, 'Invalid module ID.');
  try {
    const pool = getDbPool();
    const [rows] = await pool.execute(
      `SELECT m.id,
        EXISTS(SELECT 1 FROM lessons l LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id
          LEFT JOIN exercises e ON e.lesson_id = l.id LEFT JOIN exercise_submissions es ON es.exercise_id = e.id
          LEFT JOIN quizzes q ON q.lesson_id = l.id LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id
          WHERE l.module_id = m.id AND (lp.id IS NOT NULL OR es.id IS NOT NULL OR qa.id IS NOT NULL)) AS has_history
       FROM course_modules m JOIN courses c ON c.id = m.course_id
       WHERE m.id = ? AND c.instructor_id = ? LIMIT 1`,
      [moduleId, request.auth.userId],
    );
    if (!rows[0]) return response.status(404).json({ error: 'Module not found.' });
    if (rows[0].has_history) return response.status(409).json({ error: 'This module contains student progress or submissions. Keep it to preserve learning history.' });
    await pool.execute('DELETE FROM course_modules WHERE id = ?', [moduleId]);
    response.json({ message: 'Module deleted.' });
  } catch (error) { next(error); }
}

export async function createLesson(request, response, next) {
  const { moduleId } = request.params;
  const { title, content, codeExample = '', estimatedMinutes = 0 } = request.body ?? {};
  const minutes = Number(estimatedMinutes);
  if (
    !validId(moduleId)
    || !validText(title, 180)
    || !validText(content, 100000)
    || !validText(codeExample, 50000, true)
    || !Number.isInteger(minutes)
    || minutes < 0
    || minutes > 65535
  ) {
    rejectInvalid(response, 'Enter a lesson title, explanation, optional code example, and valid duration.');
    return;
  }

  try {
    const pool = getDbPool();
    const [modules] = await pool.execute(
      `SELECT m.id, c.status AS course_status FROM course_modules AS m
       JOIN courses AS c ON c.id = m.course_id
       WHERE m.id = ? AND c.instructor_id = ? LIMIT 1`,
      [moduleId, request.auth.userId],
    );
    if (!modules[0]) {
      response.status(404).json({ error: 'Module not found.' });
      return;
    }
    const [positions] = await pool.execute(
      'SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM lessons WHERE module_id = ?',
      [moduleId],
    );
    const slug = `${slugPart(title) || 'lesson'}-${randomUUID().slice(0, 8)}`;
    const [result] = await pool.execute(
      `INSERT INTO lessons
         (module_id, title, slug, content, code_example, estimated_minutes, position, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        moduleId, title.trim(), slug, content.trim(), codeExample.trim() || null,
        minutes, positions[0].next_position, ['published', 'archived'].includes(modules[0].course_status),
      ],
    );
    response.status(201).json({
      lesson: {
        id: String(result.insertId), module_id: moduleId, title: title.trim(), content: content.trim(),
        code_example: codeExample.trim(), estimated_minutes: minutes, position: Number(positions[0].next_position),
        is_published: Number(['published', 'archived'].includes(modules[0].course_status)), materials: [], exercises: [],
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateLesson(request, response, next) {
  const { lessonId } = request.params;
  const { title, content, codeExample = '', estimatedMinutes = 0 } = request.body ?? {};
  const minutes = Number(estimatedMinutes);
  if (!validId(lessonId) || !validText(title, 180) || !validText(content, 100000) || !validText(codeExample, 50000, true) || !Number.isInteger(minutes) || minutes < 0 || minutes > 65535) return rejectInvalid(response, 'Enter a lesson title, explanation, optional code example, and valid duration.');
  try {
    const pool = getDbPool();
    const [result] = await pool.execute(
      `UPDATE lessons l JOIN course_modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id
       SET l.title = ?, l.content = ?, l.code_example = ?, l.estimated_minutes = ?
       WHERE l.id = ? AND c.instructor_id = ?`,
      [title.trim(), content.trim(), codeExample.trim() || null, minutes, lessonId, request.auth.userId],
    );
    if (!result.affectedRows) {
      const [rows] = await pool.execute('SELECT l.id FROM lessons l JOIN course_modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id WHERE l.id = ? AND c.instructor_id = ?', [lessonId, request.auth.userId]);
      if (!rows[0]) return response.status(404).json({ error: 'Lesson not found.' });
    }
    response.json({ message: 'Lesson updated.' });
  } catch (error) { next(error); }
}

export async function deleteLesson(request, response, next) {
  const { lessonId } = request.params;
  if (!validId(lessonId)) return rejectInvalid(response, 'Invalid lesson ID.');
  try {
    const pool = getDbPool();
    const [rows] = await pool.execute(
      `SELECT l.id,
        (EXISTS(SELECT 1 FROM lesson_progress WHERE lesson_id = l.id)
         OR EXISTS(SELECT 1 FROM exercise_submissions es JOIN exercises e ON e.id = es.exercise_id WHERE e.lesson_id = l.id)
         OR EXISTS(SELECT 1 FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id WHERE q.lesson_id = l.id)) AS has_history
       FROM lessons l JOIN course_modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id
       WHERE l.id = ? AND c.instructor_id = ? LIMIT 1`,
      [lessonId, request.auth.userId],
    );
    if (!rows[0]) return response.status(404).json({ error: 'Lesson not found.' });
    if (rows[0].has_history) return response.status(409).json({ error: 'This lesson has student progress or submissions. Keep it to preserve learning history.' });
    await pool.execute('DELETE FROM lessons WHERE id = ?', [lessonId]);
    response.json({ message: 'Lesson deleted.' });
  } catch (error) { next(error); }
}

export async function createExercise(request, response, next) {
  const { lessonId } = request.params;
  const {
    title, instructions, exerciseType = 'code',
    starterHtml = '', starterCss = '', starterJavascript = '',
  } = request.body ?? {};
  if (
    !validId(lessonId)
    || !validText(title, 180)
    || !validText(instructions, 10000)
    || !['code', 'multiple_choice', 'short_answer'].includes(exerciseType)
    || !validText(starterHtml, 50000, true)
    || !validText(starterCss, 50000, true)
    || !validText(starterJavascript, 50000, true)
  ) {
    rejectInvalid(response, 'Enter a title, instructions, valid exercise type, and starter code within the size limits.');
    return;
  }

  try {
    const pool = getDbPool();
    if (!await getOwnedLesson(pool, lessonId, request.auth.userId)) {
      response.status(404).json({ error: 'Lesson not found.' });
      return;
    }
    const [positions] = await pool.execute(
      'SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM exercises WHERE lesson_id = ?',
      [lessonId],
    );
    const [result] = await pool.execute(
      `INSERT INTO exercises
         (lesson_id, title, instructions, exercise_type, starter_html, starter_css, starter_javascript, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lessonId, title.trim(), instructions.trim(), exerciseType,
        starterHtml || null, starterCss || null, starterJavascript || null, positions[0].next_position,
      ],
    );
    response.status(201).json({
      exercise: {
        id: String(result.insertId), lesson_id: lessonId, title: title.trim(),
        instructions: instructions.trim(), exercise_type: exerciseType,
        starter_html: starterHtml, starter_css: starterCss, starter_javascript: starterJavascript,
        position: Number(positions[0].next_position),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateExercise(request, response, next) {
  const { exerciseId } = request.params;
  const { title, instructions, exerciseType = 'code', starterHtml = '', starterCss = '', starterJavascript = '' } = request.body ?? {};
  if (!validId(exerciseId) || !validText(title, 180) || !validText(instructions, 10000) || !['code', 'multiple_choice', 'short_answer'].includes(exerciseType) || !validText(starterHtml, 50000, true) || !validText(starterCss, 50000, true) || !validText(starterJavascript, 50000, true)) return rejectInvalid(response, 'Enter valid exercise instructions, type, and starter code.');
  try {
    const pool = getDbPool();
    const [result] = await pool.execute(
      `UPDATE exercises e JOIN lessons l ON l.id = e.lesson_id JOIN course_modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id
       SET e.title = ?, e.instructions = ?, e.exercise_type = ?, e.starter_html = ?, e.starter_css = ?, e.starter_javascript = ?
       WHERE e.id = ? AND c.instructor_id = ?`,
      [title.trim(), instructions.trim(), exerciseType, starterHtml || null, starterCss || null, starterJavascript || null, exerciseId, request.auth.userId],
    );
    if (!result.affectedRows) {
      const [rows] = await pool.execute('SELECT e.id FROM exercises e JOIN lessons l ON l.id = e.lesson_id JOIN course_modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id WHERE e.id = ? AND c.instructor_id = ?', [exerciseId, request.auth.userId]);
      if (!rows[0]) return response.status(404).json({ error: 'Exercise not found.' });
    }
    response.json({ message: 'Exercise updated.' });
  } catch (error) { next(error); }
}

export async function deleteExercise(request, response, next) {
  const { exerciseId } = request.params;
  if (!validId(exerciseId)) return rejectInvalid(response, 'Invalid exercise ID.');
  try {
    const pool = getDbPool();
    const [rows] = await pool.execute(
      `SELECT e.id, EXISTS(SELECT 1 FROM exercise_submissions s WHERE s.exercise_id = e.id) AS has_history
       FROM exercises e JOIN lessons l ON l.id = e.lesson_id JOIN course_modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id
       WHERE e.id = ? AND c.instructor_id = ? LIMIT 1`,
      [exerciseId, request.auth.userId],
    );
    if (!rows[0]) return response.status(404).json({ error: 'Exercise not found.' });
    if (rows[0].has_history) return response.status(409).json({ error: 'This exercise has submissions. Keep it to preserve student work.' });
    await pool.execute('DELETE FROM exercises WHERE id = ?', [exerciseId]);
    response.json({ message: 'Exercise deleted.' });
  } catch (error) { next(error); }
}

export async function createQuiz(request, response, next) {
  const { courseId } = request.params;
  const { title, description = '', passPercentage = 70, question, options, correctOption } = request.body ?? {};
  const passMark = Number(passPercentage);
  if (
    !validId(courseId)
    || !validText(title, 180)
    || !validText(description, 5000, true)
    || !Number.isFinite(passMark)
    || passMark < 0
    || passMark > 100
    || !validText(question, 2000)
    || !Array.isArray(options)
    || options.length < 2
    || options.length > 6
    || options.some((option) => !validText(option, 500))
    || !Number.isInteger(correctOption)
    || correctOption < 0
    || correctOption >= options.length
  ) {
    rejectInvalid(response, 'Provide a quiz title, question, 2–6 answer options, valid correct answer, and pass mark from 0 to 100.');
    return;
  }

  let connection;
  try {
    const pool = getDbPool();
    if (!await getOwnedCourse(pool, courseId, request.auth.userId)) {
      response.status(404).json({ error: 'Course not found.' });
      return;
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [quizResult] = await connection.execute(
      `INSERT INTO quizzes (course_id, title, description, pass_percentage, is_published)
       VALUES (?, ?, ?, ?, TRUE)`,
      [courseId, title.trim(), description.trim() || null, passMark],
    );
    const [questionResult] = await connection.execute(
      `INSERT INTO questions (quiz_id, question_type, prompt, position)
       VALUES (?, 'multiple_choice', ?, 1)`,
      [quizResult.insertId, question.trim()],
    );
    for (const [position, optionText] of options.entries()) {
      await connection.execute(
        `INSERT INTO question_options (question_id, option_text, is_correct, position)
         VALUES (?, ?, ?, ?)`,
        [questionResult.insertId, optionText.trim(), position === correctOption, position + 1],
      );
    }
    await connection.commit();
    response.status(201).json({
      quiz: {
        id: String(quizResult.insertId), title: title.trim(), question_count: 1,
        pass_percentage: passMark, is_published: 1,
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
}

export async function updateQuiz(request, response, next) {
  const { quizId } = request.params;
  const { title, description = '', passPercentage = 70, isPublished = true } = request.body ?? {};
  const passMark = Number(passPercentage);
  if (!validId(quizId) || !validText(title, 180) || !validText(description, 5000, true) || !Number.isFinite(passMark) || passMark < 0 || passMark > 100 || typeof isPublished !== 'boolean') return rejectInvalid(response, 'Enter a quiz title, description, pass mark, and publication status.');
  try {
    const pool = getDbPool();
    const owned = await getOwnedQuiz(pool, quizId, request.auth.userId);
    if (!owned) return response.status(404).json({ error: 'Quiz not found.' });
    await pool.execute('UPDATE quizzes SET title = ?, description = ?, pass_percentage = ?, is_published = ? WHERE id = ?', [title.trim(), description.trim() || null, passMark, isPublished, quizId]);
    response.json({ message: 'Quiz updated.' });
  } catch (error) { next(error); }
}

export async function deleteQuiz(request, response, next) {
  const { quizId } = request.params;
  if (!validId(quizId)) return rejectInvalid(response, 'Invalid quiz ID.');
  try {
    const pool = getDbPool();
    const owned = await getOwnedQuiz(pool, quizId, request.auth.userId);
    if (!owned) return response.status(404).json({ error: 'Quiz not found.' });
    if (owned.has_attempts) return response.status(409).json({ error: 'This quiz has student attempts. Keep it to preserve their assessment history.' });
    await pool.execute('DELETE FROM quizzes WHERE id = ?', [quizId]);
    response.json({ message: 'Quiz deleted.' });
  } catch (error) { next(error); }
}

export async function createQuestion(request, response, next) {
  const { quizId } = request.params;
  const { prompt, options, correctOption } = request.body ?? {};
  if (!validId(quizId) || !validQuestionPayload({ prompt, options, correctOption })) return rejectInvalid(response, 'Enter a question and 2–6 answer options, then select the correct answer.');
  let connection;
  try {
    const pool = getDbPool();
    const owned = await getOwnedQuiz(pool, quizId, request.auth.userId);
    if (!owned) return response.status(404).json({ error: 'Quiz not found.' });
    if (owned.has_attempts) return response.status(409).json({ error: 'This quiz has student attempts. Add questions before students take it.' });
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [positions] = await connection.execute('SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM questions WHERE quiz_id = ?', [quizId]);
    const [result] = await connection.execute("INSERT INTO questions (quiz_id, question_type, prompt, position) VALUES (?, 'multiple_choice', ?, ?)", [quizId, prompt.trim(), positions[0].next_position]);
    for (const [position, option] of options.entries()) await connection.execute('INSERT INTO question_options (question_id, option_text, is_correct, position) VALUES (?, ?, ?, ?)', [result.insertId, option.trim(), position === correctOption, position + 1]);
    await connection.commit();
    response.status(201).json({ message: 'Question added.' });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally { connection?.release(); }
}

export async function updateQuestion(request, response, next) {
  const { questionId } = request.params;
  const { prompt, options, correctOption } = request.body ?? {};
  if (!validId(questionId) || !validQuestionPayload({ prompt, options, correctOption })) return rejectInvalid(response, 'Enter a question and 2–6 answer options, then select the correct answer.');
  let connection;
  try {
    const pool = getDbPool();
    const [rows] = await pool.execute(
      `SELECT qz.id AS quiz_id,
              EXISTS(SELECT 1 FROM quiz_attempts attempt WHERE attempt.quiz_id = qz.id) AS has_attempts
       FROM questions q JOIN quizzes qz ON qz.id = q.quiz_id JOIN courses c ON c.id = qz.course_id
       WHERE q.id = ? AND c.instructor_id = ? LIMIT 1`,
      [questionId, request.auth.userId],
    );
    if (!rows[0]) return response.status(404).json({ error: 'Question not found.' });
    if (rows[0].has_attempts) return response.status(409).json({ error: 'This quiz has student attempts. Keep its questions unchanged to preserve assessment history.' });
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.execute('UPDATE questions SET prompt = ? WHERE id = ?', [prompt.trim(), questionId]);
    await connection.execute('DELETE FROM question_options WHERE question_id = ?', [questionId]);
    for (const [position, option] of options.entries()) await connection.execute('INSERT INTO question_options (question_id, option_text, is_correct, position) VALUES (?, ?, ?, ?)', [questionId, option.trim(), position === correctOption, position + 1]);
    await connection.commit();
    response.json({ message: 'Question updated.' });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally { connection?.release(); }
}

export async function deleteQuestion(request, response, next) {
  const { questionId } = request.params;
  if (!validId(questionId)) return rejectInvalid(response, 'Invalid question ID.');
  try {
    const pool = getDbPool();
    const [rows] = await pool.execute(
      `SELECT qz.id AS quiz_id,
              EXISTS(SELECT 1 FROM quiz_attempts attempt WHERE attempt.quiz_id = qz.id) AS has_attempts
       FROM questions q JOIN quizzes qz ON qz.id = q.quiz_id JOIN courses c ON c.id = qz.course_id
       WHERE q.id = ? AND c.instructor_id = ? LIMIT 1`,
      [questionId, request.auth.userId],
    );
    if (!rows[0]) return response.status(404).json({ error: 'Question not found.' });
    if (rows[0].has_attempts) return response.status(409).json({ error: 'This quiz has student attempts. Keep its questions to preserve assessment history.' });
    const [counts] = await pool.execute('SELECT COUNT(*) AS question_count FROM questions WHERE quiz_id = ?', [rows[0].quiz_id]);
    if (Number(counts[0].question_count) <= 1) return response.status(409).json({ error: 'A quiz must keep at least one question. Delete the quiz if you no longer need it.' });
    await pool.execute('DELETE FROM questions WHERE id = ?', [questionId]);
    response.json({ message: 'Question deleted.' });
  } catch (error) { next(error); }
}

export async function listCourseEnrollments(request, response, next) {
  const { courseId } = request.params;
  if (!validId(courseId)) {
    rejectInvalid(response, 'Invalid course ID.');
    return;
  }

  try {
    const pool = getDbPool();
    if (!await getOwnedCourse(pool, courseId, request.auth.userId)) {
      response.status(404).json({ error: 'Course not found.' });
      return;
    }
    const [students] = await pool.execute(
      `SELECT u.id, e.id AS enrollment_id, e.status, e.enrolled_at, u.full_name, u.email,
              (SELECT COUNT(*) FROM lessons AS l
               JOIN course_modules AS m ON m.id = l.module_id
               WHERE m.course_id = e.course_id AND l.is_published = TRUE) AS total_lessons,
              (SELECT COUNT(*) FROM lesson_progress AS lp
               JOIN lessons AS l ON l.id = lp.lesson_id
               JOIN course_modules AS m ON m.id = l.module_id
               WHERE lp.enrollment_id = e.id AND m.course_id = e.course_id
                 AND l.is_published = TRUE AND lp.status = 'completed') AS completed_lessons,
              (SELECT COUNT(*) FROM exercise_submissions AS submission
               JOIN exercises AS exercise ON exercise.id = submission.exercise_id
               JOIN lessons AS l ON l.id = exercise.lesson_id
               JOIN course_modules AS m ON m.id = l.module_id
               WHERE submission.enrollment_id = e.id AND m.course_id = e.course_id) AS exercise_submissions,
              (SELECT AVG(
                 CASE
                   WHEN question_totals.total_points > 0
                     THEN COALESCE(answer_totals.earned_points, 0) / question_totals.total_points * 100
                   ELSE qa.score
                 END
               )
               FROM quiz_attempts AS qa
               JOIN quizzes AS q ON q.id = qa.quiz_id
               LEFT JOIN (
                 SELECT attempt_id, SUM(awarded_points) AS earned_points
                 FROM quiz_answers GROUP BY attempt_id
               ) AS answer_totals ON answer_totals.attempt_id = qa.id
               LEFT JOIN (
                 SELECT quiz_id, SUM(points) AS total_points
                 FROM questions GROUP BY quiz_id
               ) AS question_totals ON question_totals.quiz_id = q.id
               WHERE qa.enrollment_id = e.id AND q.course_id = e.course_id
                 AND qa.status IN ('submitted', 'graded')) AS average_quiz_score,
              certificate.id AS certificate_id, certificate.status AS certificate_status,
              certificate.requested_at AS certificate_requested_at
       FROM enrollments AS e
       JOIN users AS u ON u.id = e.student_id
       LEFT JOIN certificates AS certificate ON certificate.enrollment_id = e.id
       WHERE e.course_id = ?
       ORDER BY e.enrolled_at DESC`,
      [courseId],
    );
    response.json({
      students: students.map((student) => ({
        ...student,
        id: String(student.id),
        total_lessons: Number(student.total_lessons),
        completed_lessons: Number(student.completed_lessons),
        exercise_submissions: Number(student.exercise_submissions),
        average_quiz_score: student.average_quiz_score === null ? null : Number(student.average_quiz_score),
        certificate_id: student.certificate_id === null ? null : String(student.certificate_id),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function reviewCertificateRequest(request, response, next) {
  const { certificateId } = request.params;
  const { decision, note = '' } = request.body ?? {};
  if (
    !validId(certificateId)
    || !['approve', 'decline'].includes(decision)
    || typeof note !== 'string'
    || note.length > 2000
  ) {
    rejectInvalid(response, 'Choose approve or decline and provide an optional note up to 2,000 characters.');
    return;
  }

  try {
    const pool = getDbPool();
    const [certificates] = await pool.execute(
      `SELECT certificate.id, certificate.status, enrollment.id AS enrollment_id,
              course.id AS course_id
       FROM certificates AS certificate
       JOIN enrollments AS enrollment ON enrollment.id = certificate.enrollment_id
       JOIN courses AS course ON course.id = enrollment.course_id
       WHERE certificate.id = ? AND course.instructor_id = ?
       LIMIT 1`,
      [certificateId, request.auth.userId],
    );
    if (!certificates[0]) {
      response.status(404).json({ error: 'Certificate request not found for one of your courses.' });
      return;
    }
    if (certificates[0].status !== 'pending_instructor') {
      response.status(409).json({ error: 'This certificate request is no longer waiting for instructor review.' });
      return;
    }
    if (decision === 'approve') {
      const requirements = await getCertificateRequirements(
        pool,
        certificates[0].enrollment_id,
        certificates[0].course_id,
      );
      if (!requirements.eligible) {
        response.status(409).json({ error: 'The learner no longer meets the course lesson completion requirement.' });
        return;
      }
    }

    const nextStatus = decision === 'approve' ? 'pending_admin' : 'declined_instructor';
    const [result] = await pool.execute(
      `UPDATE certificates
       SET status = ?, instructor_reviewed_by = ?, instructor_reviewed_at = UTC_TIMESTAMP(),
           instructor_note = ?
       WHERE id = ? AND status = 'pending_instructor'`,
      [nextStatus, request.auth.userId, note.trim() || null, certificateId],
    );
    if (!result.affectedRows) {
      response.status(409).json({ error: 'This certificate request has already been reviewed.' });
      return;
    }
    response.json({
      message: decision === 'approve'
        ? 'Certificate request forwarded to the administrator for final approval.'
        : 'Certificate request declined.',
      status: nextStatus,
    });
  } catch (error) {
    next(error);
  }
}

export async function listStudentSubmissions(request, response, next) {
  const { courseId, studentId } = request.params;
  if (!validId(courseId) || !validId(studentId)) {
    rejectInvalid(response, 'Invalid course or student ID.');
    return;
  }

  try {
    const pool = getDbPool();
    if (!await getOwnedCourse(pool, courseId, request.auth.userId)) {
      response.status(404).json({ error: 'Course not found.' });
      return;
    }

    const [enrollments] = await pool.execute(
      'SELECT id FROM enrollments WHERE course_id = ? AND student_id = ? LIMIT 1',
      [courseId, studentId],
    );
    if (!enrollments[0]) {
      response.status(404).json({ error: 'Student enrollment not found.' });
      return;
    }
    const enrollmentId = String(enrollments[0].id);

    const [[exerciseSubmissions], [quizAttempts], [quizAnswers]] = await Promise.all([
      pool.execute(
        `SELECT submission.id, submission.submitted_html, submission.submitted_css,
                submission.submitted_javascript, submission.answer_text, submission.status,
                submission.score, submission.feedback, submission.submitted_at,
                exercise.title AS exercise_title, lesson.title AS lesson_title
         FROM exercise_submissions AS submission
         JOIN exercises AS exercise ON exercise.id = submission.exercise_id
         JOIN lessons AS lesson ON lesson.id = exercise.lesson_id
         JOIN course_modules AS module ON module.id = lesson.module_id
         WHERE submission.enrollment_id = ? AND module.course_id = ?
         ORDER BY submission.submitted_at DESC, submission.id DESC`,
        [enrollmentId, courseId],
      ),
      pool.execute(
        `SELECT attempt.id, attempt.quiz_id, quiz.title AS quiz_title,
                attempt.attempt_number, attempt.status, attempt.score, attempt.passed,
                attempt.started_at, attempt.submitted_at
         FROM quiz_attempts AS attempt
         JOIN quizzes AS quiz ON quiz.id = attempt.quiz_id
         WHERE attempt.enrollment_id = ? AND quiz.course_id = ?
         ORDER BY attempt.started_at DESC, attempt.id DESC`,
        [enrollmentId, courseId],
      ),
      pool.execute(
        `SELECT answer.attempt_id, question.id AS question_id, question.prompt,
                answer.answer_text, selected.option_text AS selected_option,
                answer.is_correct, answer.awarded_points, question.points AS possible_points
         FROM quiz_answers AS answer
         JOIN quiz_attempts AS attempt ON attempt.id = answer.attempt_id
         JOIN quizzes AS quiz ON quiz.id = attempt.quiz_id
         JOIN questions AS question ON question.id = answer.question_id
         LEFT JOIN question_options AS selected ON selected.id = answer.selected_option_id
         WHERE attempt.enrollment_id = ? AND quiz.course_id = ?
         ORDER BY attempt.id DESC, question.position`,
        [enrollmentId, courseId],
      ),
    ]);

    const answersByAttempt = new Map();
    for (const answer of quizAnswers) {
      const attemptId = String(answer.attempt_id);
      const answers = answersByAttempt.get(attemptId) ?? [];
      answers.push({
        question_id: String(answer.question_id),
        prompt: answer.prompt,
        answer_text: answer.answer_text,
        selected_option: answer.selected_option,
        is_correct: answer.is_correct === null ? null : Boolean(answer.is_correct),
        awarded_points: Number(answer.awarded_points),
        possible_points: Number(answer.possible_points),
      });
      answersByAttempt.set(attemptId, answers);
    }

    response.json({
      exercise_submissions: exerciseSubmissions.map((submission) => ({
        ...submission,
        id: String(submission.id),
        score: submission.score === null ? null : Number(submission.score),
      })),
      quiz_attempts: quizAttempts.map((attempt) => ({
        ...attempt,
        id: String(attempt.id),
        quiz_id: String(attempt.quiz_id),
        score: attempt.score === null ? null : Number(attempt.score),
        passed: attempt.passed === null ? null : Boolean(attempt.passed),
        answers: answersByAttempt.get(String(attempt.id)) ?? [],
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function gradeExerciseSubmission(request, response, next) {
  const { submissionId } = request.params;
  const { status, feedback = '' } = request.body ?? {};
  if (!validId(submissionId)
    || !['passed', 'needs_work'].includes(status)
    || typeof feedback !== 'string'
    || feedback.length > 5000) {
    rejectInvalid(response, 'Choose correct or needs work and enter feedback up to 5,000 characters.');
    return;
  }

  try {
    const pool = getDbPool();
    const [submissions] = await pool.execute(
      `SELECT submission.id
       FROM exercise_submissions AS submission
       JOIN exercises AS exercise ON exercise.id = submission.exercise_id
       JOIN lessons AS lesson ON lesson.id = exercise.lesson_id
       JOIN course_modules AS module ON module.id = lesson.module_id
       JOIN courses AS course ON course.id = module.course_id
       WHERE submission.id = ? AND course.instructor_id = ?
       LIMIT 1`,
      [submissionId, request.auth.userId],
    );
    if (!submissions[0]) {
      response.status(404).json({ error: 'Exercise submission not found.' });
      return;
    }

    await pool.execute(
      `UPDATE exercise_submissions
       SET status = ?, score = ?, feedback = ?
       WHERE id = ?`,
      [status, status === 'passed' ? 100 : 0, feedback.trim() || null, submissionId],
    );
    response.json({
      message: status === 'passed' ? 'Exercise marked correct.' : 'Exercise marked needs work.',
    });
  } catch (error) {
    next(error);
  }
}

export async function ensureOwnedLesson(request, response, next) {
  const { lessonId } = request.params;
  if (!validId(lessonId)) {
    rejectInvalid(response, 'Invalid lesson ID.');
    return;
  }
  try {
    const pool = getDbPool();
    const lesson = await getOwnedLesson(pool, lessonId, request.auth.userId);
    if (!lesson) {
      response.status(404).json({ error: 'Lesson not found.' });
      return;
    }
    request.courseId = String(lesson.course_id);
    next();
  } catch (error) {
    next(error);
  }
}

export async function createMaterial(request, response, next) {
  if (!request.file) {
    rejectInvalid(response, 'Choose a supported file to upload.');
    return;
  }
  const safeName = path.basename(request.file.originalname.replace(/\\/g, '/'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 255);
  try {
    const pool = getDbPool();
    const [result] = await pool.execute(
      `INSERT INTO course_materials
         (course_id, lesson_id, uploaded_by, original_name, stored_name, mime_type, file_size)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        request.courseId, request.params.lessonId, request.auth.userId, safeName || 'learning-material',
        request.file.filename, request.file.mimetype, request.file.size,
      ],
    );
    response.status(201).json({
      material: {
        id: String(result.insertId),
        lesson_id: request.params.lessonId,
        original_name: safeName || 'learning-material',
        mime_type: request.file.mimetype,
        file_size: request.file.size,
        url: `/api/materials/${result.insertId}`,
      },
    });
  } catch (error) {
    try {
      await unlink(request.file.path);
    } catch (cleanupError) {
      console.error('Unable to remove unregistered learning material:', cleanupError);
    }
    next(error);
  }
}

export async function deleteMaterial(request, response, next) {
  const { materialId } = request.params;
  if (!validId(materialId)) return rejectInvalid(response, 'Invalid learning material ID.');
  try {
    const pool = getDbPool();
    const [rows] = await pool.execute(
      `SELECT cm.stored_name FROM course_materials cm JOIN courses c ON c.id = cm.course_id
       WHERE cm.id = ? AND c.instructor_id = ? LIMIT 1`,
      [materialId, request.auth.userId],
    );
    if (!rows[0]) return response.status(404).json({ error: 'Learning material not found.' });
    await pool.execute('DELETE FROM course_materials WHERE id = ?', [materialId]);
    try { await unlink(path.join(fileURLToPath(new URL('../uploads/', import.meta.url)), rows[0].stored_name)); }
    catch (fileError) { if (fileError.code !== 'ENOENT') console.error('Unable to remove deleted learning material:', fileError); }
    response.json({ message: 'Learning material deleted.' });
  } catch (error) { next(error); }
}

export async function downloadMaterial(request, response, next) {
  const { materialId } = request.params;
  if (!validId(materialId)) {
    rejectInvalid(response, 'Invalid learning material ID.');
    return;
  }

  try {
    const pool = getDbPool();
    const [rows] = await pool.execute(
      `SELECT cm.stored_name, cm.original_name, c.instructor_id,
              EXISTS(
                SELECT 1 FROM enrollments AS e
                WHERE e.course_id = c.id AND e.student_id = ?
                  AND e.status IN ('active', 'completed')
              ) AS is_enrolled
       FROM course_materials AS cm
       JOIN courses AS c ON c.id = cm.course_id
       WHERE cm.id = ?
       LIMIT 1`,
      [request.auth.userId, materialId],
    );
    const material = rows[0];
    if (!material) {
      response.status(404).json({ error: 'Learning material not found.' });
      return;
    }
    if (
      String(material.instructor_id) !== request.auth.userId
      && !material.is_enrolled
    ) {
      response.status(403).json({ error: 'You do not have permission to access this material.' });
      return;
    }
    response.download(path.join(fileURLToPath(new URL('../uploads/', import.meta.url)), material.stored_name), material.original_name, (error) => {
      if (error) next(error);
    });
  } catch (error) {
    next(error);
  }
}
