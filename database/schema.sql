CREATE DATABASE IF NOT EXISTS interactive_learning_platform
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE interactive_learning_platform;

CREATE TABLE IF NOT EXISTS roles (
  id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(30) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB;

INSERT IGNORE INTO roles (name) VALUES
  ('admin'),
  ('instructor'),
  ('student');

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id TINYINT UNSIGNED NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified_at TIMESTAMP NULL DEFAULT NULL,
  bio TEXT NULL,
  avatar_url VARCHAR(2048) NULL,
  status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_status (role_id, status),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  last_sent_at DATETIME NOT NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_email_verification_token_hash (token_hash),
  CONSTRAINT fk_email_verification_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  parent_category_id BIGINT UNSIGNED NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_slug (slug),
  KEY idx_categories_parent (parent_category_id),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_category_id) REFERENCES categories (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS courses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  instructor_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  slug VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  thumbnail_url VARCHAR(2048) NULL,
  difficulty ENUM('beginner', 'intermediate', 'advanced') NOT NULL DEFAULT 'beginner',
  estimated_minutes INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  published_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_courses_slug (slug),
  KEY idx_courses_instructor_status (instructor_id, status),
  KEY idx_courses_status_created (status, created_at),
  CONSTRAINT fk_courses_instructor FOREIGN KEY (instructor_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS course_categories (
  course_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (course_id, category_id),
  KEY idx_course_categories_category (category_id),
  CONSTRAINT fk_course_categories_course FOREIGN KEY (course_id) REFERENCES courses (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_course_categories_category FOREIGN KEY (category_id) REFERENCES categories (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS course_modules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  position INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_course_modules_position (course_id, position),
  KEY idx_course_modules_course (course_id),
  CONSTRAINT fk_course_modules_course FOREIGN KEY (course_id) REFERENCES courses (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lessons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  module_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  slug VARCHAR(200) NOT NULL,
  content LONGTEXT NOT NULL,
  code_example LONGTEXT NULL,
  estimated_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  position INT UNSIGNED NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lessons_slug (slug),
  UNIQUE KEY uq_lessons_module_position (module_id, position),
  KEY idx_lessons_module_published (module_id, is_published),
  CONSTRAINT fk_lessons_module FOREIGN KEY (module_id) REFERENCES course_modules (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS course_materials (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id BIGINT UNSIGNED NOT NULL,
  lesson_id BIGINT UNSIGNED NOT NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(80) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_course_materials_lesson (lesson_id, created_at),
  CONSTRAINT fk_course_materials_course FOREIGN KEY (course_id) REFERENCES courses (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_course_materials_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_course_materials_uploader FOREIGN KEY (uploaded_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS enrollments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED NOT NULL,
  status ENUM('active', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_enrollments_student_course (student_id, course_id),
  KEY idx_enrollments_course_status (course_id, status),
  CONSTRAINT fk_enrollments_student FOREIGN KEY (student_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_enrollments_course FOREIGN KEY (course_id) REFERENCES courses (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lesson_progress (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  lesson_id BIGINT UNSIGNED NOT NULL,
  status ENUM('not_started', 'in_progress', 'completed') NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  last_visited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lesson_progress_enrollment_lesson (enrollment_id, lesson_id),
  KEY idx_lesson_progress_lesson (lesson_id),
  CONSTRAINT fk_lesson_progress_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_lesson_progress_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exercises (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lesson_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  instructions TEXT NOT NULL,
  exercise_type ENUM('code', 'multiple_choice', 'short_answer') NOT NULL DEFAULT 'code',
  starter_html LONGTEXT NULL,
  starter_css LONGTEXT NULL,
  starter_javascript LONGTEXT NULL,
  test_config JSON NULL,
  position INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exercises_lesson_position (lesson_id, position),
  CONSTRAINT fk_exercises_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exercise_submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  exercise_id BIGINT UNSIGNED NOT NULL,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  submitted_html LONGTEXT NULL,
  submitted_css LONGTEXT NULL,
  submitted_javascript LONGTEXT NULL,
  answer_text LONGTEXT NULL,
  status ENUM('submitted', 'passed', 'needs_work') NOT NULL DEFAULT 'submitted',
  score DECIMAL(5,2) NULL,
  feedback TEXT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_exercise_submissions_enrollment (enrollment_id, submitted_at),
  KEY idx_exercise_submissions_exercise (exercise_id, enrollment_id),
  CONSTRAINT fk_exercise_submissions_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_exercise_submissions_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS quizzes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id BIGINT UNSIGNED NOT NULL,
  lesson_id BIGINT UNSIGNED NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  pass_percentage DECIMAL(5,2) NOT NULL DEFAULT 70.00,
  time_limit_minutes SMALLINT UNSIGNED NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_quizzes_course_published (course_id, is_published),
  KEY idx_quizzes_lesson (lesson_id),
  CONSTRAINT fk_quizzes_course FOREIGN KEY (course_id) REFERENCES courses (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_quizzes_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  quiz_id BIGINT UNSIGNED NOT NULL,
  question_type ENUM('multiple_choice', 'true_false', 'short_answer') NOT NULL,
  prompt TEXT NOT NULL,
  explanation TEXT NULL,
  points DECIMAL(6,2) NOT NULL DEFAULT 1.00,
  position INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_questions_quiz_position (quiz_id, position),
  CONSTRAINT fk_questions_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS question_options (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  question_id BIGINT UNSIGNED NOT NULL,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  position INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_question_options_position (question_id, position),
  KEY idx_question_options_question (question_id),
  CONSTRAINT fk_question_options_question FOREIGN KEY (question_id) REFERENCES questions (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  quiz_id BIGINT UNSIGNED NOT NULL,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  attempt_number SMALLINT UNSIGNED NOT NULL,
  status ENUM('in_progress', 'submitted', 'graded') NOT NULL DEFAULT 'in_progress',
  score DECIMAL(7,2) NULL,
  passed BOOLEAN NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_quiz_attempt_number (quiz_id, enrollment_id, attempt_number),
  KEY idx_quiz_attempts_enrollment (enrollment_id, started_at),
  CONSTRAINT fk_quiz_attempts_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_quiz_attempts_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS quiz_answers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  attempt_id BIGINT UNSIGNED NOT NULL,
  question_id BIGINT UNSIGNED NOT NULL,
  selected_option_id BIGINT UNSIGNED NULL,
  answer_text TEXT NULL,
  is_correct BOOLEAN NULL,
  awarded_points DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  answered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_quiz_answers_attempt_question (attempt_id, question_id),
  KEY idx_quiz_answers_question (question_id),
  KEY idx_quiz_answers_option (selected_option_id),
  CONSTRAINT fk_quiz_answers_attempt FOREIGN KEY (attempt_id) REFERENCES quiz_attempts (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_quiz_answers_question FOREIGN KEY (question_id) REFERENCES questions (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_quiz_answers_option FOREIGN KEY (selected_option_id) REFERENCES question_options (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS certificates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  certificate_code CHAR(36) NOT NULL,
  status ENUM('pending_instructor', 'pending_admin', 'declined_instructor', 'declined_admin', 'issued')
    NOT NULL DEFAULT 'issued',
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  instructor_reviewed_by BIGINT UNSIGNED NULL,
  instructor_reviewed_at TIMESTAMP NULL,
  instructor_note TEXT NULL,
  admin_reviewed_by BIGINT UNSIGNED NULL,
  admin_reviewed_at TIMESTAMP NULL,
  admin_note TEXT NULL,
  issued_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_certificates_enrollment (enrollment_id),
  UNIQUE KEY uq_certificates_code (certificate_code),
  KEY idx_certificates_status_requested (status, requested_at),
  CONSTRAINT fk_certificates_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_certificates_instructor_reviewer FOREIGN KEY (instructor_reviewed_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_certificates_admin_reviewer FOREIGN KEY (admin_reviewed_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS course_reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  review_text TEXT NULL,
  status ENUM('published', 'hidden') NOT NULL DEFAULT 'published',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_course_reviews_student_course (student_id, course_id),
  KEY idx_course_reviews_course_status (course_id, status, created_at),
  CONSTRAINT fk_course_reviews_course FOREIGN KEY (course_id) REFERENCES courses (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_course_reviews_student FOREIGN KEY (student_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS content_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reporter_id BIGINT UNSIGNED NOT NULL,
  target_type ENUM('course', 'lesson') NOT NULL,
  course_id BIGINT UNSIGNED NULL,
  lesson_id BIGINT UNSIGNED NULL,
  target_title VARCHAR(180) NOT NULL,
  reason ENUM('inaccurate', 'inappropriate', 'broken', 'other') NOT NULL,
  details TEXT NULL,
  status ENUM('open', 'under_review', 'resolved', 'dismissed') NOT NULL DEFAULT 'open',
  admin_note TEXT NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_content_reports_status_created (status, created_at),
  KEY idx_content_reports_reporter (reporter_id, created_at),
  CONSTRAINT fk_content_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_content_reports_course FOREIGN KEY (course_id) REFERENCES courses (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_content_reports_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_content_reports_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;
