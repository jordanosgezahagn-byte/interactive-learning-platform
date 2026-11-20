ALTER TABLE certificates
  ADD COLUMN status ENUM('pending_instructor', 'pending_admin', 'declined_instructor', 'declined_admin', 'issued')
    NOT NULL DEFAULT 'issued' AFTER certificate_code,
  ADD COLUMN requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER status,
  ADD COLUMN instructor_reviewed_by BIGINT UNSIGNED NULL AFTER requested_at,
  ADD COLUMN instructor_reviewed_at TIMESTAMP NULL AFTER instructor_reviewed_by,
  ADD COLUMN instructor_note TEXT NULL AFTER instructor_reviewed_at,
  ADD COLUMN admin_reviewed_by BIGINT UNSIGNED NULL AFTER instructor_note,
  ADD COLUMN admin_reviewed_at TIMESTAMP NULL AFTER admin_reviewed_by,
  ADD COLUMN admin_note TEXT NULL AFTER admin_reviewed_at,
  MODIFY COLUMN issued_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  ADD KEY idx_certificates_status_requested (status, requested_at),
  ADD CONSTRAINT fk_certificates_instructor_reviewer FOREIGN KEY (instructor_reviewed_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  ADD CONSTRAINT fk_certificates_admin_reviewer FOREIGN KEY (admin_reviewed_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL;
