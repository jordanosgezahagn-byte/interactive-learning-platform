CREATE TABLE content_reports (
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
