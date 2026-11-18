/**
 * @fileoverview WebSocketServerManager: Server Lifecycle, HTTP Upgrade & Bridge Sync
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer, IncomingMessage } from 'http';
import { parse as parseUrl } from 'url';
import { RoomManager } from './rooms.js';
import { SessionManager } from './sessions.js';
import { WsRateLimiter } from './rate-limiter.js';
import { MeshEventBridge, InboundMeshEvent } from './bridge.js';
import { WsFrameHandler, TokenVerifier } from './handlers.js';

export interface WsServerOptions {
  httpServer?: HttpServer;
  tokenVerifier: TokenVerifier;
  pingIntervalMs?: number;
  authGraceTimeoutMs?: number;
  noServer?: boolean;
}

export class WebSocketServerManager {
  private wss: WebSocketServer;
  private rooms: RoomManager;
  private sessions: SessionManager;
  private rateLimiter: WsRateLimiter;
  private bridge: MeshEventBridge;
  private handler: WsFrameHandler;
  private pingInterval?: any;
  private pingIntervalMs: number;

  constructor(options: WsServerOptions) {
    this.pingIntervalMs = options.pingIntervalMs ?? 30000;
    this.rooms = new RoomManager();
    this.sessions = new SessionManager(options.authGraceTimeoutMs);
    this.rateLimiter = new WsRateLimiter();
    this.bridge = MeshEventBridge.getInstance();
    this.handler = new WsFrameHandler(
      this.rooms,
      this.sessions,
      this.rateLimiter,
      this.bridge,
      options.tokenVerifier
    );

    // Initialize standalone WebSocket server
    this.wss = new WebSocketServer({ noServer: true });

    if (options.httpServer) {
      this.setupHttpUpgrade(options.httpServer, options.tokenVerifier);
    }

    this.setupBridgeListeners();
    this.startHeartbeat();
  }

  /**
   * Listen to HTTP server 'upgrade' events for path '/ws'
   */
  public setupHttpUpgrade(server: HttpServer, tokenVerifier: TokenVerifier): void {
    server.on('upgrade', async (request: IncomingMessage, socket, head) => {
      const parsedUrl = parseUrl(request.url || '', true);
      const pathname = parsedUrl.pathname;

      if (pathname === '/ws') {
        const tokenQuery = parsedUrl.query.token as string | undefined;

        this.wss.handleUpgrade(request, socket, head, async (ws) => {
          this.sessions.register(ws as any, request);

          // If query param token is provided, attempt immediate handshake auth
          if (tokenQuery) {
            try {
              const user = await tokenVerifier.verify(tokenQuery);
              if (user) {
                this.sessions.authenticate(ws as any, user);
                ws.send(
                  JSON.stringify({
                    type: 'AUTH_SUCCESS',
                    userId: user.id,
                    role: user.role,
                    displayName: user.displayName,
                    teams: user.teams
                  })
                );
                this.rooms.join(ws as any, 'emergency:broadcast');
                this.rooms.join(ws as any, 'mesh:nodes');
                this.rooms.join(ws as any, `user:${user.id}`);
              }
            } catch {
              // Token invalid in query param: will wait for in-frame AUTH or timeout
            }
          }

          this.setupSocketEvents(ws);
        });
      } else {
        socket.destroy();
      }
    });
  }

  public handleConnection(ws: WebSocket, req?: IncomingMessage): void {
    this.sessions.register(ws as any, req);
    this.setupSocketEvents(ws);
  }

  private setupSocketEvents(ws: WebSocket): void {
    ws.on('pong', () => {
      const session = this.sessions.getSession(ws as any);
      if (session) {
        session.isAlive = true;
      }
    });

    ws.on('message', async (data) => {
      await this.handler.handleMessage(ws as any, data as any);
    });

    ws.on('close', () => {
      this.rooms.cleanup(ws as any);
      this.sessions.unregister(ws as any);
    });

    ws.on('error', () => {
      this.rooms.cleanup(ws as any);
      this.sessions.unregister(ws as any);
    });
  }

  /**
   * Listen for events originating from RF LoRa Mesh Transports
   */
  private setupBridgeListeners(): void {
    this.bridge.onInboundPacket((event: InboundMeshEvent) => {
      const { packet, rssi, snr } = event;

      // 1. Broadcast raw packet to channel listeners
      this.rooms.broadcastToRoom(`mesh:channel:${packet.channel}`, {
        type: 'MESH_PACKET_RECEIVED',
        packet,
        rssi,
        snr
      });

      // 2. If packet is POSITION_APP (portnum 3)
      if (packet.portnum === 3 || packet.portnum === 'POSITION_APP') {
        const payload = packet.payload as Record<string, any>;
        if (payload && typeof payload.latitude === 'number' && typeof payload.longitude === 'number') {
          this.rooms.broadcastAll({
            type: 'TELEMETRY_BROADCAST',
            userId: `node:${packet.from}`,
            nodeNum: packet.from,
            coords: [payload.latitude, payload.longitude],
            altitude: payload.altitude,
            battery: payload.battery ?? 100,
            timestamp: packet.rxTime ? packet.rxTime * 1000 : Date.now()
          });
        }
      }

      // 3. If packet is NODEINFO_APP (4) or TELEMETRY_APP (67)
      if (packet.portnum === 4 || packet.portnum === 67) {
        const payload = packet.payload as Record<string, any>;
        this.rooms.broadcastToRoom('mesh:nodes', {
          type: 'NODE_STATUS_UPDATE',
          nodeNum: packet.from,
          shortName: payload?.shortName || `N${packet.from.toString(16).slice(-4)}`,
          battery: payload?.batteryLevel ?? payload?.battery ?? 100,
          voltage: payload?.voltage,
          lastHeard: packet.rxTime || Math.floor(Date.now() / 1000)
        });
      }

      // 4. If packet has Priority.ALERT (110) or SOS payload
      if (packet.priority === 'ALERT' || (typeof packet.priority === 'number' && packet.priority >= 110)) {
        this.rooms.broadcastToRoom('emergency:broadcast', {
          type: 'EMERGENCY_ALERT',
          emergencyId: `mesh-sos-${packet.id}`,
          sender: `Node !${packet.from.toString(16)}`,
          location: [0, 0],
          timestamp: packet.rxTime ? packet.rxTime * 1000 : Date.now(),
          priority: 'ALERT'
        });
      }
    });
  }

  /**
   * Heartbeat to evict dead sockets
   */
  private startHeartbeat(): void {
    this.pingInterval = setInterval(() => {
      for (const session of this.sessions.getAllSessions()) {
        const ws = session.socket as WebSocket;
        if (!session.isAlive) {
          this.rooms.cleanup(ws as any);
          this.sessions.unregister(ws as any);
          if (ws.terminate) ws.terminate();
          else if (ws.close) ws.close();
        } else {
          session.isAlive = false;
          if (ws.ping) ws.ping();
        }
      }
    }, this.pingIntervalMs);
  }

  public async close(): Promise<void> {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
    return new Promise((resolve) => {
      this.wss.close(() => resolve());
    });
  }

  public getRooms(): RoomManager {
    return this.rooms;
  }

  public getSessions(): SessionManager {
    return this.sessions;
  }

  public getRateLimiter(): WsRateLimiter {
    return this.rateLimiter;
  }

  public getBridge(): MeshEventBridge {
    return this.bridge;
  }

  public getHandler(): WsFrameHandler {
    return this.handler;
  }

  public getWss(): WebSocketServer {
    return this.wss;
  }
}
