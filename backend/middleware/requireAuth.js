import jwt from 'jsonwebtoken';
import { getJwtSecret, SESSION_COOKIE_NAME } from '../config/auth.js';

export function requireAuth(request, response, next) {
  const token = request.cookies?.[SESSION_COOKIE_NAME];
  if (!token) {
    response.status(401).json({ error: 'Authentication required.' });
    return;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (!payload || typeof payload !== 'object' || typeof payload.sub !== 'string') {
      response.status(401).json({ error: 'Authentication required.' });
      return;
    }

    request.auth = { userId: payload.sub };
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      response.status(401).json({ error: 'Authentication required.' });
      return;
    }

    next(error);
  }
}
