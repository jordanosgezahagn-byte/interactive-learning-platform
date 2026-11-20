import { getDbPool } from '../config/db.js';

export function requireRole(...allowedRoles) {
  return async function verifyRole(request, response, next) {
    try {
      const pool = getDbPool();
      const [rows] = await pool.execute(
        `SELECT r.name AS role_name
         FROM users AS u
         JOIN roles AS r ON r.id = u.role_id
         WHERE u.id = ? AND u.status = 'active'
         LIMIT 1`,
        [request.auth.userId],
      );
      const role = rows[0]?.role_name;

      if (!role || !allowedRoles.includes(role)) {
        response.status(403).json({ error: 'You do not have permission to perform this action.' });
        return;
      }

      request.auth.role = role;
      next();
    } catch (error) {
      next(error);
    }
  };
}
