ALTER TABLE users
  ADD COLUMN email_verified_at TIMESTAMP NULL DEFAULT NULL;

UPDATE users
SET email_verified_at = UTC_TIMESTAMP()
WHERE email_verified_at IS NULL;

CREATE TABLE email_verification_tokens (
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  last_sent_at DATETIME NOT NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_email_verification_token_hash (token_hash),
  CONSTRAINT fk_email_verification_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
