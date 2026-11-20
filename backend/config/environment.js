export function parseFrontendOrigins(value) {
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error('FRONTEND_URL is required to send verification links and configure allowed origins.');
    error.code = 'EMAIL_FRONTEND_CONFIG_MISSING';
    throw error;
  }

  const origins = [];
  for (const entry of value.split(',').map((origin) => origin.trim()).filter(Boolean)) {
    let parsed;
    try {
      parsed = new URL(entry);
    } catch {
      const error = new Error('FRONTEND_URL contains a malformed URL.');
      error.code = 'EMAIL_CONFIG_INVALID';
      throw error;
    }

    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash) {
      const error = new Error('FRONTEND_URL must contain only valid HTTP(S) origins.');
      error.code = 'EMAIL_CONFIG_INVALID';
      throw error;
    }

    if (parsed.pathname !== '/' || parsed.search) {
      const error = new Error('FRONTEND_URL must contain origins without paths or query strings.');
      error.code = 'EMAIL_CONFIG_INVALID';
      throw error;
    }

    origins.push(parsed.origin);
  }

  if (!origins.length) {
    const error = new Error('FRONTEND_URL must contain at least one valid origin.');
    error.code = 'EMAIL_CONFIG_INVALID';
    throw error;
  }

  return origins;
}

export function validateRuntimeEnvironment() {
  const missing = [];

  if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET, 'utf8') < 32) {
    missing.push('JWT_SECRET (at least 32 bytes)');
  }

  for (const name of ['DB_HOST', 'DB_USER', 'DB_NAME']) {
    if (!process.env[name]?.trim()) {
      missing.push(name);
    }
  }

  const dbPort = Number(process.env.DB_PORT ?? 3306);
  if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) {
    missing.push('DB_PORT (integer between 1 and 65535)');
  }

  for (const name of ['GMAIL_USER', 'GMAIL_APP_PASSWORD']) {
    if (!process.env[name]?.trim()) {
      missing.push(name);
    }
  }

  parseFrontendOrigins(process.env.FRONTEND_URL ?? '');

  if (missing.length) {
    throw new Error(`Missing or invalid required runtime settings: ${missing.join(', ')}.`);
  }
}
