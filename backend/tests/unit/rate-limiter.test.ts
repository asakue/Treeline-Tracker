/**
 * @fileoverview Unit Tests for Sliding Window Rate Limiter & Emergency SOS Priority Bypass
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SlidingWindowRateLimiter } from '../../src/middleware/rate-limiter.js';

describe('Sliding-Window Rate Limiter & SOS Priority Bypass', () => {
  let limiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new SlidingWindowRateLimiter({
      authTier: { windowMs: 60 * 1000, maxRequests: 5 },
      apiTier: { windowMs: 60 * 1000, maxRequests: 10 },
      telemetryTier: { windowMs: 60 * 1000, maxRequests: 20 },
      meshTier: { windowMs: 60 * 1000, maxRequests: 15 },
    });
  });

  afterEach(() => {
    limiter.destroy();
    vi.useRealTimers();
  });

  it('allows requests within limit and attaches standard RFC rate-limiting headers', () => {
    const middleware = limiter.middleware();
    const req: any = { path: '/api/v1/teams', socket: { remoteAddress: '192.168.1.50' }, headers: {} };
    const headers: Record<string, any> = {};
    const res: any = {
      setHeader: (k: string, v: any) => { headers[k] = v; },
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(headers['X-RateLimit-Limit']).toBe(10);
    expect(headers['X-RateLimit-Remaining']).toBe(9);
  });

  it('rejects with 429 and Retry-After header when rate limit is exceeded', () => {
    const middleware = limiter.middleware();
    const req: any = { path: '/api/v1/auth/login', socket: { remoteAddress: '10.0.0.1' }, headers: {} };
    const headers: Record<string, any> = {};
    const res: any = {
      setHeader: (k: string, v: any) => { headers[k] = v; },
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    // 5 allowed requests for auth tier
    for (let i = 0; i < 5; i++) {
      middleware(req, res, next);
    }
    expect(next).toHaveBeenCalledTimes(5);

    // 6th request triggers 429
    middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(5);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(headers['Retry-After']).toBeDefined();
    expect(headers['Retry-After']).toBeGreaterThanOrEqual(1);
  });

  it('resets sliding window count as time advances past windowMs', () => {
    const middleware = limiter.middleware();
    const req: any = { path: '/api/v1/auth/login', socket: { remoteAddress: '10.0.0.2' }, headers: {} };
    const res: any = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    // Fill quota
    for (let i = 0; i < 5; i++) middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(5);

    // Advance time past the 60s window
    vi.advanceTimersByTime(61 * 1000);

    // Next request is permitted again
    middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(6);
  });

  it('CRITICAL: /api/v1/emergency/sos NEVER rate limits under any circumstances (100 rapid requests)', () => {
    const middleware = limiter.middleware();
    const req: any = {
      path: '/api/v1/emergency/sos',
      socket: { remoteAddress: '10.0.0.99' },
      headers: {},
      body: { type: 'MEDICAL', isEmergency: true },
    };
    const headers: Record<string, any> = {};
    const res: any = {
      setHeader: (k: string, v: any) => { headers[k] = v; },
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    // Send 100 rapid distress requests from the same IP
    for (let i = 0; i < 100; i++) {
      middleware(req, res, next);
    }

    // All 100 must be immediately allowed through with priority bypass header
    expect(next).toHaveBeenCalledTimes(100);
    expect(res.status).not.toHaveBeenCalledWith(429);
    expect(headers['X-RateLimit-Bypass']).toBe('EMERGENCY_PRIORITY_SOS');
  });

  it('CRITICAL: requests carrying X-Emergency-Priority: SOS header bypass all limits', () => {
    const middleware = limiter.middleware();
    const req: any = {
      path: '/api/v1/telemetry/batch',
      socket: { remoteAddress: '10.0.0.88' },
      headers: { 'x-emergency-priority': 'SOS' },
    };
    const headers: Record<string, any> = {};
    const res: any = {
      setHeader: (k: string, v: any) => { headers[k] = v; },
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    for (let i = 0; i < 50; i++) {
      middleware(req, res, next);
    }

    expect(next).toHaveBeenCalledTimes(50);
    expect(headers['X-RateLimit-Bypass']).toBe('EMERGENCY_PRIORITY_SOS');
  });

  it('CRITICAL: requests carrying body isEmergency: true bypass limits', () => {
    const middleware = limiter.middleware();
    const req: any = {
      path: '/api/v1/telemetry/batch',
      socket: { remoteAddress: '10.0.0.77' },
      headers: {},
      body: { isEmergency: true },
    };
    const headers: Record<string, any> = {};
    const res: any = {
      setHeader: (k: string, v: any) => { headers[k] = v; },
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    for (let i = 0; i < 50; i++) {
      middleware(req, res, next);
    }

    expect(next).toHaveBeenCalledTimes(50);
    expect(headers['X-RateLimit-Bypass']).toBe('EMERGENCY_PRIORITY_SOS');
  });
});
