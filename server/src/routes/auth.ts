import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { Prisma, UserRole } from '@prisma/client';

import { HttpError } from '../lib/http-error';
import { prisma } from '../lib/prisma';
import { authenticate, currentUser, issueToken, requireJwtSecret } from '../middleware/auth';

const router = Router();

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/register', async (request, response, next) => {
  try {
    const body: unknown = request.body;
    if (!isRecord(body)) {
      throw new HttpError('A JSON request body is required', 400);
    }

    const { name, email, password, role } = body;
    if (
      typeof name !== 'string' ||
      name.trim().length < 2 ||
      name.trim().length > 100 ||
      typeof email !== 'string' ||
      email.length > 254 ||
      !isValidEmail(email) ||
      typeof password !== 'string' ||
      password.length < 10 ||
      Buffer.byteLength(password, 'utf8') > 72 ||
      typeof role !== 'string' ||
      ![UserRole.FARMER, UserRole.EQUIPMENT_OWNER, UserRole.OPERATOR].some(
        (allowedRole) => allowedRole === role,
      )
    ) {
      throw new HttpError('Provide a valid name, email, password (10-72 UTF-8 bytes), and role', 400);
    }

    requireJwtSecret();
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: role as UserRole,
        ...(role === UserRole.OPERATOR ? { operatorProfile: { create: {} } } : {}),
      },
      select: { id: true, name: true, email: true, role: true },
    });

    response.status(201).json({ user, token: issueToken(user) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      next(new HttpError('An account with that email already exists', 409));
      return;
    }
    next(error);
  }
});

router.post('/login', loginRateLimit, async (request, response, next) => {
  try {
    const body: unknown = request.body;
    if (
      !isRecord(body) ||
      typeof body.email !== 'string' ||
      body.email.length > 254 ||
      !isValidEmail(body.email) ||
      typeof body.password !== 'string' ||
      body.password.length === 0 ||
      Buffer.byteLength(body.password, 'utf8') > 72
    ) {
      throw new HttpError('A valid email and password are required', 400);
    }

    requireJwtSecret();
    const user = await prisma.user.findUnique({
      where: { email: body.email.trim().toLowerCase() },
    });
    const passwordMatches = user ? await bcrypt.compare(body.password, user.passwordHash) : false;
    if (!user || !passwordMatches) {
      throw new HttpError('Invalid email or password', 401);
    }

    response.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token: issueToken(user),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: currentUser(request).id },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) {
      throw new HttpError('Account not found', 401);
    }
    response.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
