import { describe, it, expect } from 'vitest';
import { WsRateLimiter } from '../rate-limiter';
import { ClientSession, InboundWsFrame } from '../types';

function createMockSession(): ClientSession {
  return {
    sessionId: 'test-session',
    socket: {} as any,
    ip: '127.0.0.1',
    isAuthenticated: true,
    connectedAt: Date.now(),
    lastActivity: Date.now(),
    isAlive: true,
    rateLimitBucket: {
      chatCount: [],
      telemetryCount: [],
      meshCount: []
    }
  };
}

describe('WsRateLimiter & Emergency SOS Priority Bypass', () => {
  it('should throttle chat when exceeding limit', () => {
    const limiter = new WsRateLimiter({ chatMaxPerMinute: 3 });
    const session = createMockSession();
    const chatFrame: InboundWsFrame = { type: 'SEND_CHAT', channelId: 'general', text: 'hi' };

    expect(limiter.checkLimit(session, chatFrame).allowed).toBe(true);
    expect(limiter.checkLimit(session, chatFrame).allowed).toBe(true);
    expect(limiter.checkLimit(session, chatFrame).allowed).toBe(true);

    const fourth = limiter.checkLimit(session, chatFrame);
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterMs).toBeGreaterThan(0);
  });

  it('should throttle telemetry when exceeding limit', () => {
    const limiter = new WsRateLimiter({ telemetryMaxPerMinute: 2 });
    const session = createMockSession();
    const telFrame: InboundWsFrame = { type: 'SEND_TELEMETRY', latitude: 45, longitude: 10 };

    expect(limiter.checkLimit(session, telFrame).allowed).toBe(true);
    expect(limiter.checkLimit(session, telFrame).allowed).toBe(true);
    expect(limiter.checkLimit(session, telFrame).allowed).toBe(false);
  });

  it('STRICT INVARIANT: SEND_SOS must 100% bypass rate limiter even when saturated', () => {
    const limiter = new WsRateLimiter({ chatMaxPerMinute: 1, telemetryMaxPerMinute: 1 });
    const session = createMockSession();

    // Saturate chat
    limiter.checkLimit(session, { type: 'SEND_CHAT', channelId: 'c1', text: '1' });
    expect(limiter.checkLimit(session, { type: 'SEND_CHAT', channelId: 'c1', text: '2' }).allowed).toBe(false);

    // Distress call MUST pass immediately
    const sosFrame: InboundWsFrame = {
      type: 'SEND_SOS',
      emergencyType: 'MEDICAL_EMERGENCY',
      latitude: 43.35,
      longitude: 42.44,
      notes: 'Compound fracture'
    };

    // Even if 500 consecutive SOS calls are sent, all must be allowed!
    for (let i = 0; i < 500; i++) {
      const res = limiter.checkLimit(session, sosFrame);
      expect(res.allowed).toBe(true);
    }
  });

  it('STRICT INVARIANT: SEND_MESH_PACKET with priority ALERT or >= 110 must 100% bypass rate limiter', () => {
    const limiter = new WsRateLimiter({ meshMaxPerMinute: 1 });
    const session = createMockSession();

    // Saturate normal mesh packets
    limiter.checkLimit(session, {
      type: 'SEND_MESH_PACKET',
      packet: { from: 1, to: 2, channel: 0, id: 1, priority: 'DEFAULT', portnum: 1, payload: 'a' }
    });
    expect(
      limiter.checkLimit(session, {
        type: 'SEND_MESH_PACKET',
        packet: { from: 1, to: 2, channel: 0, id: 2, priority: 'DEFAULT', portnum: 1, payload: 'b' }
      }).allowed
    ).toBe(false);

    // High priority alert packet MUST bypass
    const alertPacket: InboundWsFrame = {
      type: 'SEND_MESH_PACKET',
      packet: { from: 1, to: 2, channel: 0, id: 3, priority: 'ALERT', portnum: 1, payload: 'sos' }
    };
    expect(limiter.checkLimit(session, alertPacket).allowed).toBe(true);

    const numericAlertPacket: InboundWsFrame = {
      type: 'SEND_MESH_PACKET',
      packet: { from: 1, to: 2, channel: 0, id: 4, priority: 110, portnum: 1, payload: 'sos' }
    };
    expect(limiter.checkLimit(session, numericAlertPacket).allowed).toBe(true);
  });

  it('should allow control frames (AUTH, PING, SUBSCRIBE, UNSUBSCRIBE) to bypass rate limiter', () => {
    const limiter = new WsRateLimiter();
    const session = createMockSession();

    expect(limiter.checkLimit(session, { type: 'AUTH', token: 'jwt' }).allowed).toBe(true);
    expect(limiter.checkLimit(session, { type: 'PING' }).allowed).toBe(true);
    expect(limiter.checkLimit(session, { type: 'SUBSCRIBE', channels: ['mesh:nodes'] }).allowed).toBe(true);
    expect(limiter.checkLimit(session, { type: 'UNSUBSCRIBE', channels: ['mesh:nodes'] }).allowed).toBe(true);
  });
});
