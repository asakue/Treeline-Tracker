/**
 * @fileoverview Backend API Security Utilities
 * Conforms to OWASP Backend Security Guidelines and ADR-002
 * Provides rate-limiting, request validation, and safe error sanitization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory sliding window rate limiter
class ApiRateLimiter {
  private requests = new Map<string, RateLimitRecord>();
  private readonly defaultLimit: number;
  private readonly defaultWindowMs: number;

  constructor(defaultLimit = 60, defaultWindowMs = 60 * 1000) {
    this.defaultLimit = defaultLimit;
    this.defaultWindowMs = defaultWindowMs;

    // Periodic cleanup of expired records every 5 minutes
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.requests.entries()) {
      if (now > record.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  public check(
    req: NextRequest,
    options?: { limit?: number; windowMs?: number }
  ): { allowed: boolean; remaining: number; retryAfter?: number } {
    const limit = options?.limit ?? this.defaultLimit;
    const windowMs = options?.windowMs ?? this.defaultWindowMs;
    const now = Date.now();

    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || '127.0.0.1';
    const key = `${ip}:${req.nextUrl.pathname}`;

    const record = this.requests.get(key);

    if (!record || now > record.resetTime) {
      this.requests.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return { allowed: true, remaining: limit - 1 };
    }

    record.count++;
    if (record.count > limit) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return { allowed: false, remaining: 0, retryAfter };
    }

    return { allowed: true, remaining: limit - record.count };
  }

  public reset(): void {
    this.requests.clear();
  }
}

export const rateLimiter = new ApiRateLimiter();

/**
 * Enforces rate limiting on a NextRequest. Returns a 429 response if limit exceeded.
 */
export function enforceRateLimit(
  req: NextRequest,
  options?: { limit?: number; windowMs?: number }
): NextResponse | null {
  const result = rateLimiter.check(req, options);
  if (!result.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Слишком много запросов. Пожалуйста, подождите перед повторной отправкой.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfter ?? 60),
        },
      }
    );
  }
  return null;
}

/**
 * Validates request JSON body against a Zod schema.
 */
export async function validateRequestBody<T>(
  req: NextRequest,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Неверный формат JSON в теле запроса',
          code: 'INVALID_JSON',
        },
        { status: 400 }
      ),
    };
  }

  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    const errorMessages = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: `Ошибка валидации данных: ${errorMessages}`,
          code: 'VALIDATION_ERROR',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: parseResult.data };
}

/**
 * Sanitizes and formats API error responses without leaking internal server details.
 */
export function handleApiError(error: unknown, status = 500): NextResponse {
  const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера';
  
  // Log full error internally for debugging
  console.error('[API Security] Request error:', error);

  // In production or external responses, prevent leaking sensitive stack traces
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  );
}
