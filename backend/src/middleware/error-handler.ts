/**
 * @fileoverview Centralized Error Handling Middleware
 * Transforms domain errors, validation errors, and uncaught exceptions into structured JSON responses.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(404, code, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict detected', code = 'CONFLICT', details?: any) {
    super(409, code, message, details);
  }
}

export class OccConflictError extends AppError {
  constructor(expectedVersion: number, currentVersion: number) {
    super(
      409,
      'OCC_VERSION_CONFLICT',
      `Optimistic concurrency conflict: Expected version ${expectedVersion}, but current version is ${currentVersion}`,
      { expectedVersion, currentVersion }
    );
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(401, code, message);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST', details?: any) {
    super(400, code, message, details);
  }
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    const details = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details,
    });
  }

  // 2. JSON Body Parse Errors
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON payload',
      code: 'INVALID_JSON',
    });
  }

  // 3. Known Application Errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      details: err.details,
    });
  }

  // 4. Token Errors from Auth / JWT
  if (err.message === 'TOKEN_REUSE_DETECTED') {
    return res.status(403).json({
      success: false,
      error: 'Security Alert: Refresh token reuse detected. All active sessions have been revoked.',
      code: 'TOKEN_REUSE_DETECTED',
    });
  }

  if (err.message === 'INVALID_REFRESH_TOKEN' || err.message === 'REFRESH_TOKEN_EXPIRED') {
    return res.status(401).json({
      success: false,
      error: err.message === 'REFRESH_TOKEN_EXPIRED' ? 'Refresh token expired' : 'Invalid refresh token',
      code: err.message,
    });
  }

  // 5. Unhandled Server Errors
  console.error('[UnhandledError]', err);
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR',
  });
}
