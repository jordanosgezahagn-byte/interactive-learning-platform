import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getDbPool } from '../config/db.js';
import { sendVerificationEmail } from '../config/email.js';
import {
  getJwtSecret,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  sessionCookieOptions,
} from '../config/auth.js';

function toPublicUser(row) {
  return {
    id: String(row.id),
    fullName: row.full_name,
    email: row.email,
    role: row.role_name,
  };
}

function setSessionCookie(response, user) {
  const token = jwt.sign(
    { sub: String(user.id), role: user.role_name },
    getJwtSecret(),
    { expiresIn: '7d' },
  );
  response.cookie(SESSION_COOKIE_NAME, token, {
    ...sessionCookieOptions(),
    maxAge: SESSION_DURATION_MS,
  });
}

function validEmail(value) {
  return typeof value === 'string'
    && value.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validGmail(value) {
  return validEmail(value) && value.toLowerCase().endsWith('@gmail.com');
}

function hashVerificationToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function createVerificationToken() {
  return randomBytes(32).toString('hex');
}

function handleEmailConfigurationError(error, response) {
  if (error.code === 'EMAIL_FRONTEND_CONFIG_MISSING') {
    response.status(503).json({
      error: 'FRONTEND_URL is required. Set a valid HTTP(S) frontend origin, then restart the backend.',
    });
    return true;
  }

  if (error.code === 'EMAIL_CONFIG_MISSING') {
    response.status(503).json({
      error: 'Set GMAIL_USER and GMAIL_APP_PASSWORD in backend/.env, then restart the backend.',
    });
    return true;
  }

  if (error.code === 'EMAIL_CONFIG_INVALID') {
    response.status(503).json({
      error: 'FRONTEND_URL is missing or malformed. Set a valid HTTP(S) frontend origin, then restart the backend.',
    });
    return true;
  }

  if (error.code !== 'EMAIL_DELIVERY_FAILED') {
    return false;
  }

  const cause = error.cause;
  const authenticationRejected = cause?.code === 'EAUTH'
    || Number(cause?.responseCode) === 535
    || Number(cause?.responseCode) === 534;
  response.status(503).json({
    error: authenticationRejected
      ? 'Gmail rejected the sender credentials. Use the Gmail address and a current Google App Password (not your regular Gmail password).'
      : 'Gmail could not send the verification email. Check the sender settings and internet connection.',
  });
  return true;
}

function validPassword(value) {
  return typeof value === 'string'
    && value.length >= 8
    && Buffer.byteLength(value, 'utf8') <= 72;
}

export async function register(request, response, next) {
  const { name, email, password } = request.body ?? {};
  const fullName = typeof name === 'string' ? name.trim() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const defaultRole = 'student';
  const nameParts = fullName.split(/\s+/);

  if (
    nameParts.length < 2
    || fullName.length > 150
    || !validGmail(normalizedEmail)
    || !validPassword(password)
  ) {
    response.status(400).json({
      error: 'Enter your first and last name, a valid Gmail address, and a password (8–72 bytes).',
    });
    return;
  }

  try {
    const pool = getDbPool();
    const passwordHash = await bcrypt.hash(password, 12);
    const token = createVerificationToken();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [roles] = await connection.execute(
        'SELECT id, name FROM roles WHERE name = ? LIMIT 1',
        [defaultRole],
      );
      if (roles.length === 0) {
        await connection.rollback();
        response.status(500).json({ error: 'The student role is not configured in the roles table.' });
        return;
      }

      const [result] = await connection.execute(
        `INSERT INTO users (role_id, full_name, email, password_hash, email_verified_at)
         VALUES (?, ?, ?, ?, NULL)`,
        [roles[0].id, fullName, normalizedEmail, passwordHash],
      );
      await connection.execute(
        `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, last_sent_at)
         VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR), UTC_TIMESTAMP())`,
        [result.insertId, hashVerificationToken(token)],
      );
      await sendVerificationEmail(normalizedEmail, fullName, token);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    response.status(201).json({
      message: 'Account created. Check your Gmail inbox to verify your email before signing in.',
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      response.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    if (handleEmailConfigurationError(error, response)) {
      return;
    }

    next(error);
  }
}

export async function verifyEmail(request, response, next) {
  const { token } = request.body ?? {};
  if (typeof token !== 'string' || !/^[a-f\d]{64}$/i.test(token)) {
    response.status(400).json({ error: 'This verification link is invalid or expired.' });
    return;
  }

  let connection;
  try {
    const pool = getDbPool();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT u.id, u.email_verified_at,
              t.expires_at > UTC_TIMESTAMP() AS token_is_valid
       FROM users AS u
       JOIN email_verification_tokens AS t ON t.user_id = u.id
       WHERE t.token_hash = ?
       LIMIT 1
       FOR UPDATE`,
      [hashVerificationToken(token)],
    );

    const verification = rows[0];
    if (!verification || !verification.token_is_valid) {
      await connection.rollback();
      response.status(400).json({ error: 'This verification link is invalid or expired.' });
      return;
    }

    if (!verification.email_verified_at) {
      await connection.execute(
        'UPDATE users SET email_verified_at = UTC_TIMESTAMP() WHERE id = ? AND email_verified_at IS NULL',
        [verification.id],
      );
    }
    await connection.execute(
      'DELETE FROM email_verification_tokens WHERE user_id = ?',
      [verification.id],
    );
    await connection.commit();
    response.json({ message: 'Your email is verified. You can now sign in.' });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    next(error);
  } finally {
    connection?.release();
  }
}

export async function resendVerification(request, response, next) {
  const normalizedEmail = typeof request.body?.email === 'string'
    ? request.body.email.trim().toLowerCase()
    : '';
  if (!validGmail(normalizedEmail)) {
    response.status(400).json({ error: 'Enter a valid Gmail address.' });
    return;
  }

  let connection;
  try {
    const pool = getDbPool();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT u.id, u.full_name, u.email, u.email_verified_at,
              (SELECT t.last_sent_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 60 SECOND)
               FROM email_verification_tokens AS t
               WHERE t.user_id = u.id) AS recently_sent
       FROM users AS u
       WHERE u.email = ?
       LIMIT 1
       FOR UPDATE`,
      [normalizedEmail],
    );
    const user = rows[0];

    if (
      user
      && !user.email_verified_at
      && user.recently_sent
    ) {
      await connection.commit();
      response.json({ message: 'If that account needs verification, a link will be sent shortly.' });
      return;
    }

    if (user && !user.email_verified_at) {
      const token = createVerificationToken();
      await connection.execute(
        `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, last_sent_at)
         VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR), UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
           token_hash = VALUES(token_hash),
           expires_at = VALUES(expires_at),
           last_sent_at = VALUES(last_sent_at)`,
        [user.id, hashVerificationToken(token)],
      );
      await sendVerificationEmail(user.email, user.full_name, token);
    }

    await connection.commit();
    response.json({ message: 'If that account needs verification, a link will be sent shortly.' });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    if (handleEmailConfigurationError(error, response)) {
      return;
    }
    next(error);
  } finally {
    connection?.release();
  }
}

export async function login(request, response, next) {
  const { email, password } = request.body ?? {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!validEmail(normalizedEmail) || typeof password !== 'string') {
    response.status(400).json({ error: 'Enter a valid email address and password.' });
    return;
  }

  try {
    const pool = getDbPool();
    const [rows] = await pool.execute(
      `SELECT u.id, u.full_name, u.email, u.password_hash, u.status,
              u.email_verified_at, r.name AS role_name
       FROM users AS u
       JOIN roles AS r ON r.id = u.role_id
       WHERE u.email = ?
       LIMIT 1`,
      [normalizedEmail],
    );
    const user = rows[0];
    if (
      !user
      || user.status !== 'active'
      || !(await bcrypt.compare(password, user.password_hash))
    ) {
      response.status(401).json({ error: 'Email or password is incorrect.' });
      return;
    }

    if (!user.email_verified_at) {
      response.status(403).json({
        error: 'Verify your Gmail address using the link we sent before signing in.',
        code: 'EMAIL_NOT_VERIFIED',
      });
      return;
    }

    setSessionCookie(response, user);
    response.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function getCurrentUser(request, response, next) {
  try {
    const pool = getDbPool();
    const [rows] = await pool.execute(
      `SELECT u.id, u.full_name, u.email, r.name AS role_name
       FROM users AS u
       JOIN roles AS r ON r.id = u.role_id
       WHERE u.id = ? AND u.status = 'active'
       LIMIT 1`,
      [request.auth.userId],
    );
    const user = rows[0];

    if (!user) {
      response.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
      response.status(401).json({ error: 'Authentication required.' });
      return;
    }

    response.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
}

export function logout(_request, response) {
  response.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
  response.json({ status: 'ok' });
}
