import type { NextFunction, Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

import { HttpError } from '../lib/http-error';

export type AuthenticatedUser = {
  id: string;
  role: UserRole;
};

type AuthenticatedRequest = Request & { auth?: AuthenticatedUser };

export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith('replace-with-')) {
    throw new HttpError('Authentication is not configured on this server', 503);
  }
  return secret;
}

export function issueToken(user: AuthenticatedUser): string {
  const expiresIn: SignOptions['expiresIn'] = '7d';
  return jwt.sign({ role: user.role }, requireJwtSecret(), { subject: user.id, expiresIn });
}

export function currentUser(request: Request): AuthenticatedUser {
  const auth = (request as AuthenticatedRequest).auth;
  if (!auth) {
    throw new HttpError('Authentication required', 401);
  }
  return auth;
}

export function authenticate(request: Request, _response: Response, next: NextFunction) {
  const authorization = request.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  if (!token) {
    next(new HttpError('Authentication required', 401));
    return;
  }

  try {
    const payload = jwt.verify(token, requireJwtSecret());
    if (
      typeof payload === 'string' ||
      typeof payload.sub !== 'string' ||
      typeof payload.role !== 'string' ||
      !Object.values(UserRole).includes(payload.role as UserRole)
    ) {
      throw new HttpError('Invalid authentication token', 401);
    }

    (request as AuthenticatedRequest).auth = {
      id: payload.sub,
      role: payload.role as UserRole,
    };
    next();
  } catch (error) {
    if (error instanceof HttpError) {
      next(error);
      return;
    }
    next(new HttpError('Invalid or expired authentication token', 401));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!roles.includes(currentUser(request).role)) {
      next(new HttpError('You are not allowed to perform this action', 403));
      return;
    }
    next();
  };
}
