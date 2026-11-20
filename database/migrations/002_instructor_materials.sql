ALTER TABLE lessons
  ADD COLUMN code_example LONGTEXT NULL AFTER content;

CREATE TABLE course_materials (
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
