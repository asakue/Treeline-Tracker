/**
 * @fileoverview Multi-Tier Sliding-Window Rate Limiter with Emergency SOS Priority Bypass
 * Conforms to Interface Contract §1 & Milestone 1 Architecture.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.guard.js';

export interface RateLimiterTierConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimiterOptions {
  authTier?: RateLimiterTierConfig;      // e.g. 10 req / 15 min
  apiTier?: RateLimiterTierConfig;       // e.g. 120 req / 60 sec
  telemetryTier?: RateLimiterTierConfig; // e.g. 300 req / 60 sec
  meshTier?: RateLimiterTierConfig;      // e.g. 180 req / 60 sec
}

export class SlidingWindowRateLimiter {
  // Key -> Array of request epoch timestamps (milliseconds)
  private records = new Map<string, number[]>();
  private sweepTimer: NodeJS.Timeout | null = null;

  public readonly config: {
    auth: RateLimiterTierConfig;
    api: RateLimiterTierConfig;
    telemetry: RateLimiterTierConfig;
    mesh: RateLimiterTierConfig;
  };

  constructor(options?: RateLimiterOptions) {
    this.config = {
      auth: options?.authTier || { windowMs: 15 * 60 * 1000, maxRequests: 10 },
      api: options?.apiTier || { windowMs: 60 * 1000, maxRequests: 120 },
      telemetry: options?.telemetryTier || { windowMs: 60 * 1000, maxRequests: 300 },
      mesh: options?.meshTier || { windowMs: 60 * 1000, maxRequests: 180 },
    };

    // Automated cleanup sweep every 60 seconds
    if (typeof setInterval !== 'undefined') {
      this.sweepTimer = setInterval(() => this.cleanup(), 60 * 1000);
      if (this.sweepTimer && typeof this.sweepTimer.unref === 'function') {
        this.sweepTimer.unref();
      }
    }
  }

  public destroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    this.records.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.records.entries()) {
      // Find oldest active window across tiers (max window is auth: 15 min)
      const oldestValid = now - this.config.auth.windowMs;
      const validTimestamps = timestamps.filter(t => t > oldestValid);
      if (validTimestamps.length === 0) {
        this.records.delete(key);
      } else if (validTimestamps.length !== timestamps.length) {
        this.records.set(key, validTimestamps);
      }
    }
  }

  private extractClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const candidate = (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]).trim();
      if (/^([0-9]{1,3}\.){3}[0-9]{1,3}$|^([a-fA-F0-9:]+)$/.test(candidate)) {
        return candidate;
      }
    }
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) {
      return realIp.trim();
    }
    return req.socket?.remoteAddress || '127.0.0.1';
  }

  /**
   * Main Express Middleware Handler.
   */
  public middleware() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const path = req.path || req.originalUrl || '';

      // =======================================================================
      // 1. EMERGENCY SOS PRIORITY BYPASS
      // Emergency distress signals must NEVER be rate limited or dropped!
      // =======================================================================
      const isEmergencyRoute = path === '/api/v1/emergency/sos' || path.includes('/emergency/sos');
      const hasEmergencyHeader = (req.headers['x-emergency-priority'] as string)?.toUpperCase() === 'SOS';
      const hasEmergencyBody = req.body?.isEmergency === true || req.body?.priority === 'ALERT';

      if (isEmergencyRoute || hasEmergencyHeader || hasEmergencyBody) {
        res.setHeader('X-RateLimit-Bypass', 'EMERGENCY_PRIORITY_SOS');
        return next();
      }

      // =======================================================================
      // 2. TIER CLASSIFICATION
      // =======================================================================
      let tier: RateLimiterTierConfig;
      let subjectKey: string;
      const clientIp = this.extractClientIp(req);
      const userId = req.user?.sub;

      if (path.startsWith('/api/v1/auth')) {
        tier = this.config.auth;
        subjectKey = `auth:${clientIp}`;
      } else if (path.startsWith('/api/v1/telemetry')) {
        tier = this.config.telemetry;
        subjectKey = `telemetry:${userId || clientIp}`;
      } else if (path.startsWith('/api/v1/mesh')) {
        tier = this.config.mesh;
        subjectKey = `mesh:${userId || clientIp}`;
      } else {
        tier = this.config.api;
        subjectKey = `api:${userId || clientIp}`;
      }

      // =======================================================================
      // 3. SLIDING-WINDOW LOG CALCULATION
      // =======================================================================
      const now = Date.now();
      const windowStart = now - tier.windowMs;

      let timestamps = this.records.get(subjectKey);
      if (!timestamps) {
        timestamps = [];
        this.records.set(subjectKey, timestamps);
      }

      // Filter out timestamps outside sliding window
      timestamps = timestamps.filter(t => t > windowStart);
      this.records.set(subjectKey, timestamps);

      const count = timestamps.length;
      const remaining = Math.max(0, tier.maxRequests - count);
      const oldestInWindow = timestamps[0] || now;
      const resetEpochSec = Math.ceil((oldestInWindow + tier.windowMs) / 1000);

      // Set standard RFC rate-limiting headers
      res.setHeader('X-RateLimit-Limit', tier.maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining > 0 ? remaining - 1 : 0);
      res.setHeader('X-RateLimit-Reset', resetEpochSec);

      if (count >= tier.maxRequests) {
        const retryAfterSec = Math.ceil((oldestInWindow + tier.windowMs - now) / 1000);
        res.setHeader('Retry-After', Math.max(1, retryAfterSec));

        return res.status(429).json({
          success: false,
          error: 'Too Many Requests',
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please wait before making more requests.',
          retryAfter: Math.max(1, retryAfterSec),
        });
      }

      // Record this request timestamp into the sliding log
      timestamps.push(now);
      next();
    };
  }

  public reset(): void {
    this.records.clear();
  }
}

export const rateLimiter = new SlidingWindowRateLimiter();
