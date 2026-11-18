import { describe, it, expect, vi } from 'vitest';
import { WsFrameHandler, TokenVerifier } from '../handlers';
import { RoomManager } from '../rooms';
import { SessionManager } from '../sessions';
import { WsRateLimiter } from '../rate-limiter';
import { MeshEventBridge } from '../bridge';
import { WebSocketServerManager } from '../server';
import { WebSocketLike, AuthenticatedUser, OutboundWsFrame } from '../types';

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

describe('WsFrameHandler & WebSocketServerManager', () => {
  const mockUser: AuthenticatedUser = {
    id: 'user-123',
    email: 'user@treeline.org',
    role: 'hiker',
    displayName: 'Alex Guide',
    teams: ['team-alpha'],
    nodeNum: 0x28a4c1f0
  };

  const mockVerifier: TokenVerifier = {
    verify: async (token: string) => {
      if (token === 'valid-jwt') return mockUser;
      return null;
    }
  };

  it('should reject non-AUTH frames when unauthenticated', async () => {
    const rooms = new RoomManager();
    const sessions = new SessionManager();
    const limiter = new WsRateLimiter();
    const bridge = new MeshEventBridge();
    const handler = new WsFrameHandler(rooms, sessions, limiter, bridge, mockVerifier);

    const socket = createMockSocket();
    sessions.register(socket);

    await handler.handleMessage(socket, JSON.stringify({ type: 'SEND_TELEMETRY', latitude: 45, longitude: 10 }));

    expect(socket.send).toHaveBeenCalled();
    const sent = JSON.parse((socket.send as any).mock.calls[0][0]);
    expect(sent.type).toBe('ERROR');
    expect(sent.code).toBe('UNAUTHORIZED');
  });

  it('should authenticate client, return AUTH_SUCCESS, and auto-subscribe to default rooms', async () => {
    const rooms = new RoomManager();
    const sessions = new SessionManager();
    const limiter = new WsRateLimiter();
    const bridge = new MeshEventBridge();
    const handler = new WsFrameHandler(rooms, sessions, limiter, bridge, mockVerifier);

    const socket = createMockSocket();
    sessions.register(socket);

    await handler.handleMessage(socket, JSON.stringify({ type: 'AUTH', token: 'valid-jwt' }));

    expect(socket.send).toHaveBeenCalled();
    const sent = JSON.parse((socket.send as any).mock.calls[0][0]);
    expect(sent.type).toBe('AUTH_SUCCESS');
    expect(sent.userId).toBe('user-123');

    // Auto-joined rooms check
    expect(rooms.getSubscribedRooms(socket)).toEqual(
      expect.arrayContaining(['emergency:broadcast', 'mesh:nodes', 'user:user123'.replace('user123', 'user-123')])
    );
  });

  it('should handle SUBSCRIBE and UNSUBSCRIBE with RBAC enforcement', async () => {
    const rooms = new RoomManager();
    const sessions = new SessionManager();
    const limiter = new WsRateLimiter();
    const bridge = new MeshEventBridge();
    const handler = new WsFrameHandler(rooms, sessions, limiter, bridge, mockVerifier);

    const socket = createMockSocket();
    sessions.register(socket);
    sessions.authenticate(socket, mockUser);

    // Subscribe to allowed team and unauthorized team
    await handler.handleMessage(
      socket,
      JSON.stringify({ type: 'SUBSCRIBE', channels: ['team:team-alpha', 'team:team-forbidden'] })
    );

    const calls = (socket.send as any).mock.calls.map((c: any) => JSON.parse(c[0]));
    const errorFrame = calls.find((c: any) => c.type === 'ERROR');
    expect(errorFrame.code).toBe('FORBIDDEN');

    const subFrame = calls.find((c: any) => c.type === 'SUBSCRIBED');
    expect(subFrame.channels).toEqual(['team:team-alpha']);

    // Unsubscribe
    await handler.handleMessage(socket, JSON.stringify({ type: 'UNSUBSCRIBE', channels: ['team:team-alpha'] }));
    const unsubFrame = JSON.parse((socket.send as any).mock.calls.slice(-1)[0][0]);
    expect(unsubFrame.type).toBe('UNSUBSCRIBED');
  });

  it('should handle SEND_TELEMETRY and broadcast TELEMETRY_BROADCAST and NODE_STATUS_UPDATE', async () => {
    const rooms = new RoomManager();
    const sessions = new SessionManager();
    const limiter = new WsRateLimiter();
    const bridge = new MeshEventBridge();
    const handler = new WsFrameHandler(rooms, sessions, limiter, bridge, mockVerifier);

    const senderSocket = createMockSocket();
    sessions.register(senderSocket);
    sessions.authenticate(senderSocket, mockUser);

    const peerSocket = createMockSocket();
    sessions.register(peerSocket);
    sessions.authenticate(peerSocket, { ...mockUser, id: 'peer' });
    rooms.join(peerSocket, 'team:team-alpha');
    rooms.join(peerSocket, 'mesh:nodes');

    await handler.handleMessage(
      senderSocket,
      JSON.stringify({
        type: 'SEND_TELEMETRY',
        latitude: 43.355,
        longitude: 42.439,
        altitude: 2100,
        battery: 92
      })
    );

    expect(peerSocket.send).toHaveBeenCalled();
    const sentFrames = (peerSocket.send as any).mock.calls.map((c: any) => JSON.parse(c[0]));
    const telFrame = sentFrames.find((f: any) => f.type === 'TELEMETRY_BROADCAST');
    expect(telFrame).toBeDefined();
    expect(telFrame.coords).toEqual([43.355, 42.439]);
    expect(telFrame.battery).toBe(92);

    const nodeFrame = sentFrames.find((f: any) => f.type === 'NODE_STATUS_UPDATE');
    expect(nodeFrame).toBeDefined();
    expect(nodeFrame.nodeNum).toBe(0x28a4c1f0);
  });

  it('should handle SEND_CHAT and broadcast MESH_PACKET_RECEIVED to room and forward to bridge', async () => {
    const rooms = new RoomManager();
    const sessions = new SessionManager();
    const limiter = new WsRateLimiter();
    const bridge = new MeshEventBridge();
    const handler = new WsFrameHandler(rooms, sessions, limiter, bridge, mockVerifier);

    const sender = createMockSocket();
    sessions.register(sender);
    sessions.authenticate(sender, mockUser);

    const peer = createMockSocket();
    sessions.register(peer);
    sessions.authenticate(peer, { ...mockUser, id: 'peer' });
    rooms.join(peer, 'team:team-alpha');

    let bridgeOutbound: any = null;
    bridge.onOutboundPacket((event) => {
      bridgeOutbound = event;
    });

    await handler.handleMessage(
      sender,
      JSON.stringify({
        type: 'SEND_CHAT',
        channelId: 'team-alpha',
        text: 'Radio check from high camp'
      })
    );

    expect(peer.send).toHaveBeenCalled();
    const peerFrame = JSON.parse((peer.send as any).mock.calls[0][0]);
    expect(peerFrame.type).toBe('MESH_PACKET_RECEIVED');
    expect(peerFrame.packet.payload.text).toBe('Radio check from high camp');

    expect(bridgeOutbound).not.toBeNull();
    expect(bridgeOutbound.packet.payload).toBe('Radio check from high camp');
  });

  it('should handle SEND_SOS: broadcast EMERGENCY_ALERT, emit high-priority SOS to bridge, send SOS_ACK', async () => {
    const rooms = new RoomManager();
    const sessions = new SessionManager();
    const limiter = new WsRateLimiter();
    const bridge = new MeshEventBridge();
    const handler = new WsFrameHandler(rooms, sessions, limiter, bridge, mockVerifier);

    const sender = createMockSocket();
    sessions.register(sender);
    sessions.authenticate(sender, mockUser);

    const rescuer = createMockSocket();
    sessions.register(rescuer);
    sessions.authenticate(rescuer, { ...mockUser, id: 'rescuer-1', role: 'rescuer' });
    rooms.join(rescuer, 'emergency:broadcast');

    let bridgeEmergencyOutbound: any = null;
    bridge.onOutboundSos((event) => {
      bridgeEmergencyOutbound = event;
    });

    await handler.handleMessage(
      sender,
      JSON.stringify({
        type: 'SEND_SOS',
        emergencyType: 'AVALANCHE_BURIAL',
        latitude: 43.35,
        longitude: 42.44,
        notes: '2 beacons active'
      })
    );

    // 1. Rescuer received EMERGENCY_ALERT
    expect(rescuer.send).toHaveBeenCalled();
    const alertFrame = JSON.parse((rescuer.send as any).mock.calls[0][0]);
    expect(alertFrame.type).toBe('EMERGENCY_ALERT');
    expect(alertFrame.emergencyType).toBe('AVALANCHE_BURIAL');
    expect(alertFrame.priority).toBe('ALERT');

    // 2. Sender received SOS_ACK
    const senderCalls = (sender.send as any).mock.calls.map((c: any) => JSON.parse(c[0]));
    const ackFrame = senderCalls.find((c: any) => c.type === 'SOS_ACK');
    expect(ackFrame).toBeDefined();
    expect(ackFrame.status).toBe('BROADCAST_ACTIVE');

    // 3. Bridge received SOS
    expect(bridgeEmergencyOutbound).not.toBeNull();
    expect(bridgeEmergencyOutbound.isEmergency).toBe(true);
    expect(bridgeEmergencyOutbound.packet.to).toBe(0xffffffff);
    expect(bridgeEmergencyOutbound.packet.priority).toBe('ALERT');
  });

  it('should handle PING and respond with PONG', async () => {
    const rooms = new RoomManager();
    const sessions = new SessionManager();
    const limiter = new WsRateLimiter();
    const bridge = new MeshEventBridge();
    const handler = new WsFrameHandler(rooms, sessions, limiter, bridge, mockVerifier);

    const socket = createMockSocket();
    sessions.register(socket);

    await handler.handleMessage(socket, JSON.stringify({ type: 'PING' }));

    expect(socket.send).toHaveBeenCalled();
    const sent = JSON.parse((socket.send as any).mock.calls[0][0]);
    expect(sent.type).toBe('PONG');
    expect(typeof sent.timestamp).toBe('number');
  });

  it('WebSocketServerManager lifecycle and bridge event dispatching', async () => {
    const wsManager = new WebSocketServerManager({
      tokenVerifier: mockVerifier,
      pingIntervalMs: 60000
    });

    const clientSocket = createMockSocket();
    wsManager.handleConnection(clientSocket as any);

    // Join room
    wsManager.getRooms().join(clientSocket, 'mesh:channel:0');

    // Emit packet from LoRa RF bridge into WebSocket manager
    wsManager.getBridge().emitInboundPacket({
      packet: {
        from: 0x1111,
        to: 0xffffffff,
        channel: 0,
        id: 777,
        priority: 'DEFAULT',
        portnum: 1,
        payload: 'RF message'
      },
      rssi: -80,
      snr: 8.5,
      transport: 'webserial'
    });

    expect(clientSocket.send).toHaveBeenCalled();
    const sent = JSON.parse((clientSocket.send as any).mock.calls[0][0]);
    expect(sent.type).toBe('MESH_PACKET_RECEIVED');
    expect(sent.packet.id).toBe(777);
    expect(sent.rssi).toBe(-80);

    await wsManager.close();
  });
});
