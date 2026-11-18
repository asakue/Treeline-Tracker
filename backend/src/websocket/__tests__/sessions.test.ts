import { describe, it, expect, vi } from 'vitest';
import { SessionManager } from '../sessions';
import { WebSocketLike, AuthenticatedUser } from '../types';

function createMockSocket(): WebSocketLike {
  return {
    readyState: 1,
    send: vi.fn(),
    close: vi.fn(),
    terminate: vi.fn(),
    ping: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  };
}

describe('SessionManager & Auth Grace Timer', () => {
  it('should register session and generate UUID and record IP', () => {
    const mgr = new SessionManager();
    const socket = createMockSocket();
    const req = { socket: { remoteAddress: '192.168.1.100' }, headers: {} };

    const session = mgr.register(socket, req);
    expect(session.sessionId).toBeDefined();
    expect(session.ip).toBe('192.168.1.100');
    expect(session.isAuthenticated).toBe(false);
    expect(mgr.size).toBe(1);

    mgr.unregister(socket);
    expect(mgr.size).toBe(0);
  });

  it('should close unauthenticated socket with code 4401 upon grace timer expiration', async () => {
    const mgr = new SessionManager(20); // 20ms grace period for fast test
    const socket = createMockSocket();

    mgr.register(socket);
    expect(socket.close).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 40));

    expect(socket.send).toHaveBeenCalled();
    const sentData = JSON.parse((socket.send as any).mock.calls[0][0]);
    expect(sentData.code).toBe('AUTH_TIMEOUT');
    expect(socket.close).toHaveBeenCalledWith(4401, 'Authentication Timeout');
  });

  it('should cancel grace timer upon successful authentication', async () => {
    const mgr = new SessionManager(30);
    const socket = createMockSocket();

    const session = mgr.register(socket);
    expect(session.authTimer).toBeDefined();

    const user: AuthenticatedUser = {
      id: 'u1',
      email: 'user@test.com',
      role: 'hiker',
      displayName: 'Hiker Test',
      teams: ['team-1']
    };

    const success = mgr.authenticate(socket, user);
    expect(success).toBe(true);
    expect(session.isAuthenticated).toBe(true);
    expect(session.user).toEqual(user);
    expect(session.authTimer).toBeUndefined();

    // Wait past grace period
    await new Promise((r) => setTimeout(r, 50));
    expect(socket.close).not.toHaveBeenCalled();
  });

  it('should retrieve sessions by userId', () => {
    const mgr = new SessionManager();
    const s1 = createMockSocket();
    const s2 = createMockSocket();

    mgr.register(s1);
    mgr.register(s2);

    const user: AuthenticatedUser = {
      id: 'target-user',
      email: 'target@test.com',
      role: 'guide',
      displayName: 'Guide Bob',
      teams: []
    };

    mgr.authenticate(s1, user);
    mgr.authenticate(s2, user);

    const found = mgr.getSessionsByUserId('target-user');
    expect(found.length).toBe(2);
  });
});
