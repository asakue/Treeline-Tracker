/**
 * @fileoverview RoomManager: Multi-tenant Pub/Sub and RBAC Room Registry
 */

import { OutboundWsFrame, AuthenticatedUser, WebSocketLike } from './types.js';

export class RoomManager {
  // roomName -> Set of connected WebSockets
  private rooms: Map<string, Set<WebSocketLike>> = new Map();
  // socket -> Set of joined roomNames
  private socketRooms: Map<WebSocketLike, Set<string>> = new Map();

  /**
   * Check if a user is permitted to subscribe to a room
   */
  public canSubscribe(user: AuthenticatedUser, channel: string): boolean {
    if (!channel || typeof channel !== 'string') return false;

    if (channel === 'emergency:broadcast' || channel === 'mesh:nodes') {
      return true; // All authenticated users can subscribe
    }
    if (channel.startsWith('mesh:channel:')) {
      return true; // Mesh channel listening allowed
    }
    if (channel.startsWith('team:')) {
      const teamId = channel.substring(5);
      // Admin, Rescuer, or explicit Team Member
      return user.role === 'admin' || user.role === 'rescuer' || user.teams.includes(teamId);
    }
    if (channel.startsWith('user:')) {
      const targetUserId = channel.substring(5);
      return user.id === targetUserId || user.role === 'admin';
    }
    return false;
  }

  /**
   * Join a client socket to a room
   */
  public join(socket: WebSocketLike, roomName: string): boolean {
    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, new Set());
    }
    this.rooms.get(roomName)!.add(socket);

    if (!this.socketRooms.has(socket)) {
      this.socketRooms.set(socket, new Set());
    }
    this.socketRooms.get(socket)!.add(roomName);
    return true;
  }

  /**
   * Leave a single room
   */
  public leave(socket: WebSocketLike, roomName: string): boolean {
    const roomSet = this.rooms.get(roomName);
    if (roomSet) {
      roomSet.delete(socket);
      if (roomSet.size === 0) {
        this.rooms.delete(roomName);
      }
    }

    const clientSet = this.socketRooms.get(socket);
    if (clientSet) {
      clientSet.delete(roomName);
      if (clientSet.size === 0) {
        this.socketRooms.delete(socket);
      }
    }
    return true;
  }

  /**
   * Cleanup all room subscriptions for a disconnected socket
   */
  public cleanup(socket: WebSocketLike): void {
    const rooms = this.socketRooms.get(socket);
    if (rooms) {
      for (const roomName of rooms) {
        const roomSet = this.rooms.get(roomName);
        if (roomSet) {
          roomSet.delete(socket);
          if (roomSet.size === 0) {
            this.rooms.delete(roomName);
          }
        }
      }
      this.socketRooms.delete(socket);
    }
  }

  /**
   * Broadcast a message to all sockets in a specific room
   */
  public broadcastToRoom(roomName: string, frame: OutboundWsFrame, excludeSocket?: WebSocketLike): number {
    const roomSet = this.rooms.get(roomName);
    if (!roomSet || roomSet.size === 0) return 0;

    const payload = JSON.stringify(frame);
    let sentCount = 0;

    for (const client of roomSet) {
      if (client !== excludeSocket && client.readyState === 1) { // 1 = OPEN
        try {
          client.send(payload);
          sentCount++;
        } catch {
          // ignore dead socket
        }
      }
    }
    return sentCount;
  }

  /**
   * Broadcast a message globally across all active rooms
   */
  public broadcastAll(frame: OutboundWsFrame, excludeSocket?: WebSocketLike): number {
    const payload = JSON.stringify(frame);
    let sentCount = 0;
    const seenSockets = new Set<WebSocketLike>();

    for (const roomSet of this.rooms.values()) {
      for (const client of roomSet) {
        if (!seenSockets.has(client) && client !== excludeSocket && client.readyState === 1) {
          seenSockets.add(client);
          try {
            client.send(payload);
            sentCount++;
          } catch {
            // ignore
          }
        }
      }
    }
    return sentCount;
  }

  public getSubscribedRooms(socket: WebSocketLike): string[] {
    return Array.from(this.socketRooms.get(socket) || []);
  }

  public getRoomSubscribersCount(roomName: string): number {
    return this.rooms.get(roomName)?.size || 0;
  }
}
