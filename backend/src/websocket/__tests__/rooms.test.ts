import { describe, it, expect, vi } from 'vitest';
import { RoomManager } from '../rooms';
import { AuthenticatedUser, WebSocketLike, OutboundWsFrame } from '../types';

function createMockSocket(): WebSocketLike {
  return {
    readyState: 1, // OPEN
    send: vi.fn(),
    close: vi.fn(),
    terminate: vi.fn(),
    ping: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  };
}

describe('RoomManager & RBAC PubSub', () => {
  it('should join, track, leave, and clean up rooms', () => {
    const mgr = new RoomManager();
    const s1 = createMockSocket();
    const s2 = createMockSocket();

    mgr.join(s1, 'team:alpha');
    mgr.join(s1, 'mesh:nodes');
    mgr.join(s2, 'team:alpha');

    expect(mgr.getRoomSubscribersCount('team:alpha')).toBe(2);
    expect(mgr.getRoomSubscribersCount('mesh:nodes')).toBe(1);
    expect(mgr.getSubscribedRooms(s1)).toEqual(['team:alpha', 'mesh:nodes']);

    mgr.leave(s1, 'mesh:nodes');
    expect(mgr.getRoomSubscribersCount('mesh:nodes')).toBe(0);

    mgr.cleanup(s2);
    expect(mgr.getRoomSubscribersCount('team:alpha')).toBe(1);
    expect(mgr.getSubscribedRooms(s2)).toEqual([]);
  });

  it('should broadcast frame only to room members and exclude specified socket', () => {
    const mgr = new RoomManager();
    const s1 = createMockSocket();
    const s2 = createMockSocket();
    const s3 = createMockSocket();

    mgr.join(s1, 'team:bravo');
    mgr.join(s2, 'team:bravo');
    mgr.join(s3, 'team:charlie');

    const frame: OutboundWsFrame = {
      type: 'PONG',
      timestamp: 123456
    };

    const count = mgr.broadcastToRoom('team:bravo', frame, s1);
    expect(count).toBe(1);
    expect(s1.send).not.toHaveBeenCalled();
    expect(s2.send).toHaveBeenCalledWith(JSON.stringify(frame));
    expect(s3.send).not.toHaveBeenCalled();
  });

  it('should broadcast globally across all rooms with deduplication', () => {
    const mgr = new RoomManager();
    const s1 = createMockSocket();
    const s2 = createMockSocket();

    mgr.join(s1, 'team:1');
    mgr.join(s1, 'team:2'); // s1 in multiple rooms
    mgr.join(s2, 'team:2');

    const frame: OutboundWsFrame = { type: 'PONG', timestamp: 999 };
    const count = mgr.broadcastAll(frame);

    expect(count).toBe(2);
    expect(s1.send).toHaveBeenCalledTimes(1);
    expect(s2.send).toHaveBeenCalledTimes(1);
  });

  describe('RBAC room authorization (canSubscribe)', () => {
    const hiker: AuthenticatedUser = {
      id: 'hiker-1',
      email: 'hiker@example.com',
      role: 'hiker',
      displayName: 'Hiker One',
      teams: ['team-green']
    };

    const rescuer: AuthenticatedUser = {
      id: 'rescuer-1',
      email: 'rescuer@example.com',
      role: 'rescuer',
      displayName: 'Rescuer One',
      teams: ['team-sar']
    };

    const admin: AuthenticatedUser = {
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
      displayName: 'Admin Root',
      teams: []
    };

    const mgr = new RoomManager();

    it('allows all users to subscribe to emergency:broadcast, mesh:nodes, mesh:channel:x', () => {
      expect(mgr.canSubscribe(hiker, 'emergency:broadcast')).toBe(true);
      expect(mgr.canSubscribe(hiker, 'mesh:nodes')).toBe(true);
      expect(mgr.canSubscribe(hiker, 'mesh:channel:0')).toBe(true);
      expect(mgr.canSubscribe(hiker, 'mesh:channel:1')).toBe(true);
    });

    it('enforces strict team RBAC: hiker can only join own team', () => {
      expect(mgr.canSubscribe(hiker, 'team:team-green')).toBe(true);
      expect(mgr.canSubscribe(hiker, 'team:team-red')).toBe(false);
    });

    it('allows rescuer and admin to join any team room', () => {
      expect(mgr.canSubscribe(rescuer, 'team:team-green')).toBe(true);
      expect(mgr.canSubscribe(rescuer, 'team:team-red')).toBe(true);
      expect(mgr.canSubscribe(admin, 'team:team-green')).toBe(true);
      expect(mgr.canSubscribe(admin, 'team:team-red')).toBe(true);
    });

    it('restricts user private channels to owner or admin', () => {
      expect(mgr.canSubscribe(hiker, 'user:hiker-1')).toBe(true);
      expect(mgr.canSubscribe(hiker, 'user:hiker-2')).toBe(false);
      expect(mgr.canSubscribe(admin, 'user:hiker-2')).toBe(true);
    });
  });
});
