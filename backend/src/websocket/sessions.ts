/**
 * @fileoverview SessionManager: Client Lifecycle, Heartbeat & Authentication Grace Timer
 */

import { ClientSession, AuthenticatedUser, WebSocketLike } from './types.js';
import * as crypto from 'crypto';

export class SessionManager {
  private sessions: Map<WebSocketLike, ClientSession> = new Map();
  private authGraceTimeoutMs = 10000; // 10 seconds to authenticate

  constructor(authGraceTimeoutMs?: number) {
    if (authGraceTimeoutMs !== undefined) {
      this.authGraceTimeoutMs = authGraceTimeoutMs;
    }
  }

  public register(socket: WebSocketLike, req?: any): ClientSession {
    const sessionId = crypto.randomUUID();
    const ip =
      req?.headers?.['x-forwarded-for'] ||
      req?.socket?.remoteAddress ||
      '127.0.0.1';

    const session: ClientSession = {
      sessionId,
      socket,
      ip: String(ip),
      isAuthenticated: false,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      isAlive: true,
      rateLimitBucket: {
        chatCount: [],
        telemetryCount: [],
        meshCount: []
      }
    };

    // 10-second unauthenticated grace period timer
    session.authTimer = setTimeout(() => {
      if (!session.isAuthenticated) {
        try {
          socket.send(
            JSON.stringify({
              type: 'ERROR',
              code: 'AUTH_TIMEOUT',
              message: 'Authentication required within 10 seconds.'
            })
          );
          socket.close(4401, 'Authentication Timeout');
        } catch {
          // ignore error if socket already terminated
        }
      }
    }, this.authGraceTimeoutMs);

    this.sessions.set(socket, session);
    return session;
  }

  public authenticate(socket: WebSocketLike, user: AuthenticatedUser): boolean {
    const session = this.sessions.get(socket);
    if (!session) return false;

    if (session.authTimer) {
      clearTimeout(session.authTimer);
      session.authTimer = undefined;
    }

    session.isAuthenticated = true;
    session.user = user;
    session.lastActivity = Date.now();
    return true;
  }

  public unregister(socket: WebSocketLike): ClientSession | undefined {
    const session = this.sessions.get(socket);
    if (session) {
      if (session.authTimer) {
        clearTimeout(session.authTimer);
        session.authTimer = undefined;
      }
      this.sessions.delete(socket);
    }
    return session;
  }

  public getSession(socket: WebSocketLike): ClientSession | undefined {
    return this.sessions.get(socket);
  }

  public getAllSessions(): ClientSession[] {
    return Array.from(this.sessions.values());
  }

  public getSessionsByUserId(userId: string): ClientSession[] {
    return this.getAllSessions().filter((s) => s.user?.id === userId);
  }

  public get size(): number {
    return this.sessions.size;
  }
}
