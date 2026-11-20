import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import coursesRoutes from './routes/courses.js';
import certificateRoutes from './routes/certificates.js';
import instructorRoutes from './routes/instructor.js';
import materialRoutes from './routes/materials.js';
import studentRoutes from './routes/student.js';
import { getJwtSecret } from './config/auth.js';
import { closeDbPool, getDbPool } from './config/db.js';
import { parseFrontendOrigins, validateRuntimeEnvironment } from './config/environment.js';

dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

const app = express();
validateRuntimeEnvironment();
getJwtSecret();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? 'localhost';
const allowedOrigins = parseFrontendOrigins(process.env.FRONTEND_URL);

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('PORT must be an integer between 0 and 65535.');
}

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(cookieParser());
app.use('/api/instructor', express.json({ limit: '256kb' }));
app.use(express.json({ limit: '100kb' }));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/instructor', instructorRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/student', studentRoutes);

app.get('/', (_request, response) => {
  response.json({
    name: 'CodeBloom API',
    health: '/api/health',
    readiness: '/api/ready',
  });
});

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.get('/api/ready', async (_request, response) => {
  try {
    const pool = getDbPool();
    await pool.query('SELECT 1');
    response.json({ status: 'ready', database: 'connected' });
  } catch (error) {
    console.error('Readiness check failed:', error.message);
    response.status(503).json({
      status: 'not_ready',
      database: 'unavailable',
    });
  }
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found' });
});

app.use((error, _request, response, _next) => {
  console.error('Unhandled request error:', error);
  response.status(error.status === 400 ? 400 : 500).json({
    error: error.status === 400 ? 'Invalid request body' : 'Internal server error',
  });
});

const server = app.listen(port, host, () => {
  const address = server.address();
  const listeningPort = typeof address === 'object' && address ? address.port : port;
  console.log(`CodeBloom API listening at http://${host}:${listeningPort}`);
});

server.on('error', (error) => {
  console.error('Failed to start the CodeBloom API:', error);
  process.exitCode = 1;
});

function shutdown(signal) {
  console.log(`${signal} received; shutting down the CodeBloom API.`);
  server.close(async (error) => {
    if (error) {
      console.error('Error while closing the HTTP server:', error);
      process.exitCode = 1;
    }

    try {
      await closeDbPool();
    } catch (poolError) {
      console.error('Error while closing the database pool:', poolError);
      process.exitCode = 1;
    }

    if (error || process.exitCode) {
      process.exit(1);
    }
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

export { app, server };
