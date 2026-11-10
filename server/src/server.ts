import dotenv from 'dotenv';
import { resolve } from 'node:path';

import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { Prisma, UserRole } from '@prisma/client';

import { HttpError } from './lib/http-error';
import { prisma } from './lib/prisma';
import { authenticate, currentUser, requireRole } from './middleware/auth';
import authRouter from './routes/auth';
import cloudinaryRouter from './routes/cloudinary';
import bookingsRouter from './routes/bookings';
import equipmentRouter from './routes/equipment';
import notificationsRouter from './routes/notifications';
import ownersRouter from './routes/owners';
import operatorsRouter from './routes/operators';
import { verifyCloudinaryConfiguration } from './services/cloudinary';

dotenv.config({ path: resolve(__dirname, '../.env') });

const app = express();
const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = [
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:19006',
  ...(process.env.CORS_ORIGIN ?? '').split(','),
]
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

app.use('/api/auth', authRouter);
app.use('/api/cloudinary', cloudinaryRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/equipment', equipmentRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/operators', operatorsRouter);
app.use('/api/owners', ownersRouter);

app.get(
  '/api/operator/profile',
  authenticate,
  requireRole(UserRole.OPERATOR),
  async (request, response, next) => {
    try {
      const profile = await prisma.operatorProfile.findUnique({
        where: { userId: currentUser(request).id },
        select: {
          experienceYears: true,
          certificationStatus: true,
          documents: {
            select: {
              id: true,
              type: true,
              originalName: true,
              status: true,
              reviewNotes: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      if (!profile) throw new HttpError('Operator profile not found', 404);
      response.json(profile);
    } catch (error) {
      next(error);
    }
  },
);

app.patch(
  '/api/operator/profile',
  authenticate,
  requireRole(UserRole.OPERATOR),
  async (request, response, next) => {
    try {
      const body: unknown = request.body;
      if (
        !isRecord(body) ||
        typeof body.experienceYears !== 'number' ||
        !Number.isInteger(body.experienceYears) ||
        body.experienceYears < 0 ||
        body.experienceYears > 60
      ) {
        throw new HttpError('experienceYears must be a whole number between 0 and 60', 400);
      }

      const profile = await prisma.operatorProfile.update({
        where: { userId: currentUser(request).id },
        data: { experienceYears: body.experienceYears },
        select: {
          experienceYears: true,
          certificationStatus: true,
          documents: {
            select: {
              id: true,
              type: true,
              originalName: true,
              status: true,
              reviewNotes: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      response.json(profile);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        next(new HttpError('Operator profile not found', 404));
        return;
      }
      next(error);
    }
  },
);

app.get('/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'agrishare-api',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'agrishare-api',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health/database', async (_request, response, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    next(error);
  }
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found' });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  const bodyParserStatus =
    isRecord(error) && error.type === 'entity.parse.failed'
      ? 400
      : isRecord(error) && error.type === 'entity.too.large'
        ? 413
        : null;
  const databaseErrorCode = isRecord(error) ? error.code ?? error.errorCode : undefined;
  const hasDatabaseUnavailableCode =
    typeof databaseErrorCode === 'string' &&
    ['P1001', 'P1002', 'P1008', 'P2024'].includes(databaseErrorCode);
  const isDatabaseInitializationFailure =
    isRecord(error) &&
    error.name === 'PrismaClientInitializationError' &&
    typeof error.message === 'string' &&
    /can't reach database server|timed out fetching a new connection|connection timeout/i.test(error.message);
  const isDatabaseUnavailable = hasDatabaseUnavailableCode || isDatabaseInitializationFailure;
  const status =
    error instanceof HttpError
      ? error.status
      : bodyParserStatus ?? (isDatabaseUnavailable ? 503 : 500);
  if (status >= 500) {
    console.error(error);
  }
  if (response.headersSent) {
    return next(error);
  }

  const message =
    error instanceof HttpError
      ? error.message
      : bodyParserStatus === 400
        ? 'Invalid JSON request body'
        : bodyParserStatus === 413
          ? 'Request body is too large'
          : isDatabaseUnavailable
            ? 'The database is temporarily unavailable. Please try again shortly.'
          : 'Internal server error';
  response.status(status).json({ error: message });
};

app.use(errorHandler);

app.listen(port, () => {
  console.log(`AgriShare API listening on http://localhost:${port}`);
  void verifyCloudinaryConfiguration()
    .then(() => console.log('Cloudinary configuration verified.'))
    .catch((error: unknown) => {
      console.warn(
        error instanceof Error
          ? error.message
          : 'Cloudinary configuration could not be verified.',
      );
    });
});
