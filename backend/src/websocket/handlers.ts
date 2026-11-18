/**
 * @fileoverview Inbound Frame Dispatcher & Business Logic
 */

import {
  InboundWsFrame,
  ClientSession,
  AuthenticatedUser,
  OutboundWsFrame,
  WebSocketLike
} from './types.js';
import { RoomManager } from './rooms.js';
import { SessionManager } from './sessions.js';
import { WsRateLimiter } from './rate-limiter.js';
import { MeshEventBridge } from './bridge.js';
import * as crypto from 'crypto';

export interface TokenVerifier {
  verify(token: string): Promise<AuthenticatedUser | null> | AuthenticatedUser | null;
}

export class WsFrameHandler {
  constructor(
    private rooms: RoomManager,
    private sessions: SessionManager,
    private rateLimiter: WsRateLimiter,
    private bridge: MeshEventBridge,
    private tokenVerifier: TokenVerifier
  ) {}

  public async handleMessage(socket: WebSocketLike, rawData: string | Buffer | Uint8Array): Promise<void> {
    const session = this.sessions.getSession(socket);
    if (!session) return;

    let frame: InboundWsFrame;
    try {
      const text = typeof rawData === 'string' ? rawData : Buffer.from(rawData).toString('utf-8');
      frame = JSON.parse(text);
    } catch {
      this.send(socket, { type: 'ERROR', code: 'INVALID_JSON', message: 'Payload must be valid JSON' });
      return;
    }

    if (!frame || typeof frame.type !== 'string') {
      this.send(socket, { type: 'ERROR', code: 'INVALID_FRAME', message: 'Frame missing type property' });
      return;
    }

    // 1. Check Rate Limiter (SEND_SOS automatically 100% bypasses)
    const limitCheck = this.rateLimiter.checkLimit(session, frame);
    if (!limitCheck.allowed) {
      this.send(socket, {
        type: 'RATE_LIMIT_EXCEEDED',
        message: 'Message rate limit exceeded. Please wait.',
        retryAfterMs: limitCheck.retryAfterMs ?? 1000
      });
      return;
    }

    // 2. Handle Authentication
    if (frame.type === 'AUTH') {
      const user = await this.tokenVerifier.verify(frame.token);
      if (!user) {
        this.send(socket, { type: 'ERROR', code: 'AUTH_FAILED', message: 'Invalid or expired token' });
        socket.close(4401, 'Unauthorized');
        return;
      }
      this.sessions.authenticate(socket, user);
      this.send(socket, {
        type: 'AUTH_SUCCESS',
        userId: user.id,
        role: user.role,
        displayName: user.displayName,
        teams: user.teams
      });

      // Auto-subscribe to emergency broadcast, mesh nodes, and user's private channel
      this.rooms.join(socket, 'emergency:broadcast');
      this.rooms.join(socket, 'mesh:nodes');
      this.rooms.join(socket, `user:${user.id}`);
      return;
    }

    // 3. Handle PING
    if (frame.type === 'PING') {
      session.isAlive = true;
      session.lastActivity = Date.now();
      this.send(socket, { type: 'PONG', timestamp: Date.now() });
      return;
    }

    // 4. Require authentication for all subsequent frames
    if (!session.isAuthenticated || !session.user) {
      this.send(socket, { type: 'ERROR', code: 'UNAUTHORIZED', message: 'Must send AUTH before other frames' });
      return;
    }

    session.lastActivity = Date.now();

    // 5. Route by Frame Type
    switch (frame.type) {
      case 'SUBSCRIBE': {
        const allowedChannels: string[] = [];
        for (const channel of frame.channels) {
          if (this.rooms.canSubscribe(session.user, channel)) {
            this.rooms.join(socket, channel);
            allowedChannels.push(channel);
          } else {
            this.send(socket, {
              type: 'ERROR',
              code: 'FORBIDDEN',
              message: `Not authorized to subscribe to channel: ${channel}`
            });
          }
        }
        this.send(socket, { type: 'SUBSCRIBED', channels: allowedChannels });
        break;
      }

      case 'UNSUBSCRIBE': {
        for (const channel of frame.channels) {
          this.rooms.leave(socket, channel);
        }
        this.send(socket, { type: 'UNSUBSCRIBED', channels: frame.channels });
        break;
      }

      case 'SEND_TELEMETRY': {
        const telemetryPayload: OutboundWsFrame = {
          type: 'TELEMETRY_BROADCAST',
          userId: session.user.id,
          nodeNum: session.user.nodeNum,
          coords: [frame.latitude, frame.longitude],
          altitude: frame.altitude,
          battery: frame.battery ?? 100,
          timestamp: Date.now(),
          speed: frame.speed,
          heading: frame.heading
        };

        for (const teamId of session.user.teams) {
          this.rooms.broadcastToRoom(`team:${teamId}`, telemetryPayload, socket);
        }

        if (session.user.nodeNum) {
          this.rooms.broadcastToRoom('mesh:nodes', {
            type: 'NODE_STATUS_UPDATE',
            nodeNum: session.user.nodeNum,
            shortName: session.user.displayName.substring(0, 4),
            battery: frame.battery ?? 100,
            lastHeard: Math.floor(Date.now() / 1000)
          });
        }
        break;
      }

      case 'SEND_CHAT': {
        const roomName = `team:${frame.channelId}`;
        this.rooms.broadcastToRoom(
          roomName,
          {
            type: 'MESH_PACKET_RECEIVED',
            packet: {
              from: session.user.nodeNum ?? 0,
              to: frame.recipientNodeNum ?? 0xffffffff,
              channel: 0,
              id: crypto.randomInt(1, 0xffffffff),
              priority: 'DEFAULT',
              portnum: 1, // TEXT_MESSAGE_APP
              payload: {
                senderId: session.user.id,
                senderName: session.user.displayName,
                text: frame.text,
                timestamp: Date.now()
              }
            }
          },
          socket
        );

        this.bridge.emitOutboundPacket({
          packet: {
            from: session.user.nodeNum ?? 0,
            to: frame.recipientNodeNum ?? 0xffffffff,
            channel: 0,
            id: crypto.randomInt(1, 0xffffffff),
            priority: 'DEFAULT',
            portnum: 1,
            payload: frame.text
          }
        });
        break;
      }

      case 'SEND_MESH_PACKET': {
        const isAlert =
          frame.packet.priority === 'ALERT' ||
          (typeof frame.packet.priority === 'number' && frame.packet.priority >= 110);

        this.bridge.emitOutboundPacket({
          packet: frame.packet,
          isEmergency: isAlert
        });

        this.rooms.broadcastToRoom(
          `mesh:channel:${frame.packet.channel}`,
          {
            type: 'MESH_PACKET_RECEIVED',
            packet: frame.packet
          },
          socket
        );
        break;
      }

      case 'SEND_SOS': {
        const emergencyId = crypto.randomUUID();
        const now = Date.now();

        const alertFrame: OutboundWsFrame = {
          type: 'EMERGENCY_ALERT',
          emergencyId,
          sender: session.user.displayName,
          senderId: session.user.id,
          location: [frame.latitude, frame.longitude],
          emergencyType: frame.emergencyType,
          notes: frame.notes,
          timestamp: now,
          priority: 'ALERT'
        };

        // 1. Broadcast to emergency:broadcast room
        this.rooms.broadcastToRoom('emergency:broadcast', alertFrame);

        // 2. Broadcast to all user teams
        for (const teamId of session.user.teams) {
          this.rooms.broadcastToRoom(`team:${teamId}`, alertFrame);
        }

        // 3. Emit high-priority SOS to LoRa mesh bridge
        this.bridge.emitOutboundPacket({
          isEmergency: true,
          packet: {
            from: session.user.nodeNum ?? 0,
            to: 0xffffffff, // Broadcast to entire mesh
            channel: 0,
            id: crypto.randomInt(1, 0xffffffff),
            wantAck: true,
            priority: 'ALERT', // Priority.ALERT = 110
            portnum: 1,
            payload: `[SOS] ${session.user.displayName}: ${frame.emergencyType} at ${frame.latitude}, ${frame.longitude}`
          }
        });

        // 4. Return SOS ACK to sender
        this.send(socket, {
          type: 'SOS_ACK',
          emergencyId,
          status: 'BROADCAST_ACTIVE',
          dispatchedAt: now
        });
        break;
      }
    }
  }

  private send(socket: WebSocketLike, frame: OutboundWsFrame): void {
    if (socket.readyState === 1) { // 1 = OPEN
      socket.send(JSON.stringify(frame));
    }
  }
}
