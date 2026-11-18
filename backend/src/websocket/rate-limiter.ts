/**
 * @fileoverview WsRateLimiter: Sliding Window Rate Limiter with 100% SOS Priority Bypass
 */

import { ClientSession, InboundWsFrame } from './types.js';

export interface RateLimitConfig {
  chatMaxPerMinute: number;      // e.g. 60
  telemetryMaxPerMinute: number; // e.g. 120 (2 Hz)
  meshMaxPerMinute: number;      // e.g. 60
}

export class WsRateLimiter {
  private config: RateLimitConfig;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      chatMaxPerMinute: config?.chatMaxPerMinute ?? 60,
      telemetryMaxPerMinute: config?.telemetryMaxPerMinute ?? 120,
      meshMaxPerMinute: config?.meshMaxPerMinute ?? 60
    };
  }

  /**
   * Checks if an inbound frame is permitted.
   * STRICT INVARIANT: SEND_SOS and Priority.ALERT (110) completely bypass rate limiting.
   */
  public checkLimit(session: ClientSession, frame: InboundWsFrame): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();
    const windowStart = now - 60000; // 1-minute sliding window

    // 1. EMERGENCY SOS ABSOLUTE 100% BYPASS
    if (frame.type === 'SEND_SOS') {
      return { allowed: true };
    }
    if (
      frame.type === 'SEND_MESH_PACKET' &&
      (frame.packet.priority === 'ALERT' ||
        (typeof frame.packet.priority === 'number' && frame.packet.priority >= 110))
    ) {
      return { allowed: true };
    }

    // 2. Control & Authentication frames bypass normal rate limiter
    if (
      frame.type === 'AUTH' ||
      frame.type === 'PING' ||
      frame.type === 'SUBSCRIBE' ||
      frame.type === 'UNSUBSCRIBE'
    ) {
      return { allowed: true };
    }

    // 3. Telemetry Rate Limiting
    if (frame.type === 'SEND_TELEMETRY') {
      const bucket = session.rateLimitBucket.telemetryCount;
      session.rateLimitBucket.telemetryCount = bucket.filter((t: number) => t > windowStart);
      if (session.rateLimitBucket.telemetryCount.length >= this.config.telemetryMaxPerMinute) {
        const oldest = session.rateLimitBucket.telemetryCount[0];
        const retryAfterMs = Math.max(100, 60000 - (now - oldest));
        return { allowed: false, retryAfterMs };
      }
      session.rateLimitBucket.telemetryCount.push(now);
      return { allowed: true };
    }

    // 4. Chat Rate Limiting
    if (frame.type === 'SEND_CHAT') {
      const bucket = session.rateLimitBucket.chatCount;
      session.rateLimitBucket.chatCount = bucket.filter((t: number) => t > windowStart);
      if (session.rateLimitBucket.chatCount.length >= this.config.chatMaxPerMinute) {
        const oldest = session.rateLimitBucket.chatCount[0];
        const retryAfterMs = Math.max(100, 60000 - (now - oldest));
        return { allowed: false, retryAfterMs };
      }
      session.rateLimitBucket.chatCount.push(now);
      return { allowed: true };
    }

    // 5. Mesh Packets Rate Limiting
    if (frame.type === 'SEND_MESH_PACKET') {
      const bucket = session.rateLimitBucket.meshCount;
      session.rateLimitBucket.meshCount = bucket.filter((t: number) => t > windowStart);
      if (session.rateLimitBucket.meshCount.length >= this.config.meshMaxPerMinute) {
        const oldest = session.rateLimitBucket.meshCount[0];
        const retryAfterMs = Math.max(100, 60000 - (now - oldest));
        return { allowed: false, retryAfterMs };
      }
      session.rateLimitBucket.meshCount.push(now);
      return { allowed: true };
    }

    return { allowed: true };
  }
}
