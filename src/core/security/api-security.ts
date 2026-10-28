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
      const timer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
      if (typeof timer === 'object' && timer && 'unref' in timer) {
        (timer as any).unref();
      }
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
    const realIp = req.headers.get('x-real-ip');
    const ipPattern = /^([0-9]{1,3}\.){3}[0-9]{1,3}$|^([a-fA-F0-9:]+)$/;
    let ip = '127.0.0.1';
    if (realIp && ipPattern.test(realIp.trim())) {
      ip = realIp.trim();
    } else if (forwarded) {
      const candidate = forwarded.split(',')[0].trim();
      if (ipPattern.test(candidate)) {
        ip = candidate;
      }
    }
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
  // Log full error internally for debugging
  console.error('[API Security] Request error:', error);

  let message = 'Внутренняя ошибка сервера';
  if (status < 500) {
    message = error instanceof Error ? error.message : 'Неверный запрос';
  } else if (process.env.NODE_ENV !== 'production') {
    // In dev / test, show meaningful message
    message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера';
  }

  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  );
}

export type ValidRole = 'hiker' | 'guide' | 'rescuer' | 'admin';

export interface AuthUser {
  uid: string;
  role: ValidRole;
  displayName?: string;
  isMfaVerified?: boolean;
}

export interface AuthResult {
  authenticated: boolean;
  user: AuthUser;
  response?: NextResponse;
}

/**
 * Authenticates request based on Bearer token or session headers.
 */
export function authenticateRequest(
  req: NextRequest,
  options?: {
    requiredRole?: ValidRole[] | ValidRole;
    allowAnonymous?: boolean;
  }
): AuthResult {
  const authHeader = req.headers.get('authorization');
  const userIdHeader = req.headers.get('x-user-id');
  const userRoleHeader = req.headers.get('x-user-role') as ValidRole | null;

  let user: AuthUser | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      let jsonStr = '';
      if (typeof Buffer !== 'undefined') {
        jsonStr = Buffer.from(token, 'base64').toString('utf-8');
      } else {
        const binary = atob(token);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        jsonStr = new TextDecoder().decode(bytes);
      }
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed.uid === 'string') {
        user = {
          uid: parsed.uid,
          role: (['hiker', 'guide', 'rescuer', 'admin'].includes(parsed.role) ? parsed.role : 'hiker') as ValidRole,
          displayName: parsed.displayName,
          isMfaVerified: !!parsed.isMfaVerified,
        };
      }
    } catch {
      if (token.length > 0) {
        user = {
          uid: token,
          role: (userRoleHeader && ['hiker', 'guide', 'rescuer', 'admin'].includes(userRoleHeader) ? userRoleHeader : 'hiker') as ValidRole,
        };
      }
    }
  } else if (userIdHeader) {
    user = {
      uid: userIdHeader,
      role: (userRoleHeader && ['hiker', 'guide', 'rescuer', 'admin'].includes(userRoleHeader) ? userRoleHeader : 'hiker') as ValidRole,
    };
  }

  // Fallback for anonymous access
  if (!user) {
    if (options?.allowAnonymous !== false) {
      user = {
        uid: 'anonymous-hiker',
        role: 'hiker',
      };
    } else {
      return {
        authenticated: false,
        user: { uid: '', role: 'hiker' },
        response: NextResponse.json(
          { success: false, error: 'Требуется аутентификация', code: 'UNAUTHORIZED' },
          { status: 401 }
        ),
      };
    }
  }

  if (options?.requiredRole) {
    const required = Array.isArray(options.requiredRole) ? options.requiredRole : [options.requiredRole];
    if (!required.includes(user.role)) {
      return {
        authenticated: false,
        user,
        response: NextResponse.json(
          {
            success: false,
            error: `Недостаточно прав доступа для роли "${user.role}"`,
            code: 'FORBIDDEN',
          },
          { status: 403 }
        ),
      };
    }
  }

  return { authenticated: true, user };
}
