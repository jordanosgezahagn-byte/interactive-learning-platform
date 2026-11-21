export const SESSION_COOKIE_NAME = 'codebloom_session';
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must be set to a value of at least 32 bytes.');
  }

  return secret;
}

export function sessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  };
}