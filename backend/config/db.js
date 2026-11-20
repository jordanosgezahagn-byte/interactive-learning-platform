import mysql from 'mysql2/promise';

let pool;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to connect to the database.`);
  }
  return value;
}

export function getDbPool() {
  if (pool) {
    return pool;
  }

  const port = Number(process.env.DB_PORT ?? 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be an integer between 1 and 65535.');
  }

  pool = mysql.createPool({
    host: requiredEnv('DB_HOST'),
    port,
    user: requiredEnv('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    database: requiredEnv('DB_NAME'),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
  });

  return pool;
}

export async function closeDbPool() {
  if (!pool) {
    return;
  }

  const currentPool = pool;
  pool = undefined;
  await currentPool.end();
}