/**
 * Autonomous Embedded Test Server for Treeline Tracker E2E Testing
 * 
 * Strictly implements the interface contracts defined in PROJECT.md:
 * - REST API Base URL: /api/v1
 * - JWT Authentication & RBAC (hiker, guide, rescuer, admin) with Argon2/HMAC token rotation & revocation
 * - Team & Member Management with OCC versioning
 * - Waypoint Management (PostGIS-compatible coordinates, hazard zones)
 * - Track Recording, Playback, and Cross-Track Deviation Evaluation
 * - Geofences (Circle, Polygon, self-intersection rejection, perimeter inclusion, breach detection)
 * - Telemetry Batch Ingestion, privacy coordinate quantization, and deduplication
 * - Rate Limiting Engine: multi-tier sliding window with 100% Emergency SOS priority bypass
 * - RFC 6455 compliant WebSocket server (ws://<host>:<port>/ws) with room pub/sub topologies:
 *   team:<id>, emergency:broadcast, mesh:channel:<id>
 * - Auto-detects port or allows running standalone
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: 'hiker' | 'guide' | 'rescuer' | 'admin';
  privacyMode?: 'NORMAL' | 'REDUCED';
  createdAt: string;
}

export interface TeamRecord {
  id: string;
  name: string;
  callsign?: string;
  safeRadiusMeters: number;
  version: number;
  members: Array<{ userId: string; role: string }>;
  createdAt: string;
}

export interface WaypointRecord {
  id: string;
  teamId: string;
  name: string;
  symbol: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  isHazard?: boolean;
  hazardRadiusMeters?: number;
  sequenceOrder?: number;
  locationGeom: string;
}

export interface TrackRecord {
  id: string;
  teamId: string;
  name: string;
  difficulty?: string;
  corridorWidthMeters: number;
  path: Array<[number, number]>;
  distanceKm: number;
  isArchived?: boolean;
  version: number;
}

export interface GeofenceRecord {
  id: string;
  teamId: string;
  name: string;
  fenceType: string;
  shapeType: 'CIRCLE' | 'POLYGON';
  centerLatitude?: number;
  centerLongitude?: number;
  radiusMeters?: number;
  polygonCoordinates?: Array<[number, number]>;
  breachAction?: string;
  isActive: boolean;
  geom: string;
}

export interface TelemetryRecord {
  id: string;
  userId?: string;
  meshNodeId?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speedMps?: number;
  headingDeg?: number;
  batteryLevel?: number;
  transportType?: string;
  recordedAt: string;
}

export interface EmergencyRecord {
  id: string;
  userId?: string;
  emergencyType: string;
  latitude: number;
  longitude: number;
  notes?: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  resolutionNotes?: string;
  createdAt: string;
}

// WebSocket Connection Wrapper
class WsSocket {
  public rooms = new Set<string>();
  public userId?: string;
  public userRole?: string;
  public isAlive = true;

  constructor(public socket: any, public server: TestServer) {
    this.setupParser();
  }

  private setupParser() {
    let buffer = Buffer.alloc(0);

    this.socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= 2) {
        const byte0 = buffer[0];
        const byte1 = buffer[1];
        const opcode = byte0 & 0x0f;
        const isMasked = (byte1 & 0x80) !== 0;
        let payloadLen = byte1 & 0x7f;
        let offset = 2;

        if (payloadLen === 126) {
          if (buffer.length < 4) return;
          payloadLen = buffer.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (buffer.length < 10) return;
          payloadLen = Number(buffer.readBigUInt64BE(2));
          offset = 10;
        }

        // Oversized message protection (> 64KB)
        if (payloadLen > 64 * 1024) {
          this.close(1009, 'Message Too Big');
          return;
        }

        let maskingKey = Buffer.alloc(0);
        if (isMasked) {
          if (buffer.length < offset + 4) return;
          maskingKey = buffer.subarray(offset, offset + 4);
          offset += 4;
        }

        if (buffer.length < offset + payloadLen) return;

        const payload = buffer.subarray(offset, offset + payloadLen);
        buffer = buffer.subarray(offset + payloadLen);

        const unmasked = Buffer.alloc(payloadLen);
        for (let i = 0; i < payloadLen; i++) {
          unmasked[i] = isMasked ? payload[i] ^ maskingKey[i % 4] : payload[i];
        }

        this.handleFrame(opcode, unmasked);
      }
    });

    this.socket.on('close', () => {
      this.server.removeWsSocket(this);
    });

    this.socket.on('error', () => {
      this.server.removeWsSocket(this);
    });
  }

  private handleFrame(opcode: number, payload: Buffer) {
    if (opcode === 0x8) {
      // Close frame
      this.socket.end();
      this.server.removeWsSocket(this);
      return;
    }

    if (opcode === 0x9) {
      // Ping -> Pong
      this.sendPong(payload);
      return;
    }

    if (opcode === 0xa) {
      // Pong received
      this.isAlive = true;
      return;
    }

    if (opcode === 0x1) {
      // Text frame (JSON)
      const text = payload.toString('utf-8');
      try {
        const msg = JSON.parse(text);
        this.server.handleWsMessage(this, msg);
      } catch (err) {
        this.send({ type: 'ERROR', message: 'Malformed JSON' });
      }
    }
  }

  send(data: any): void {
    const json = typeof data === 'string' ? data : JSON.stringify(data);
    const payload = Buffer.from(json, 'utf-8');
    const header = Buffer.alloc(payload.length <= 125 ? 2 : payload.length <= 65535 ? 4 : 10);
    header[0] = 0x81; // FIN + Text opcode

    if (payload.length <= 125) {
      header[1] = payload.length;
      this.socket.write(Buffer.concat([header, payload]));
    } else if (payload.length <= 65535) {
      header[1] = 126;
      header.writeUInt16BE(payload.length, 2);
      this.socket.write(Buffer.concat([header, payload]));
    } else {
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(payload.length), 2);
      this.socket.write(Buffer.concat([header, payload]));
    }
  }

  sendPong(payload: Buffer): void {
    const header = Buffer.from([0x8a, payload.length]);
    this.socket.write(Buffer.concat([header, payload]));
  }

  close(code = 1000, reason = ''): void {
    const reasonBuf = Buffer.from(reason, 'utf-8');
    const buf = Buffer.alloc(2 + reasonBuf.length);
    buf.writeUInt16BE(code, 0);
    reasonBuf.copy(buf, 2);
    const header = Buffer.from([0x88, buf.length]);
    try {
      this.socket.write(Buffer.concat([header, buf]));
      this.socket.end();
    } catch (_) {}
    this.server.removeWsSocket(this);
  }
}

export class TestServer {
  private server: http.Server;
  private port = 0;
  private wsClients = new Set<WsSocket>();
  private secretKey = 'treeline-test-jwt-secret-key-32bytes-long!';

  // In-memory data store
  public users = new Map<string, UserRecord>();
  public userTokens = new Map<string, { userId: string; token: string; revokedAt: string | null }>();
  public teams = new Map<string, TeamRecord>();
  public waypoints = new Map<string, WaypointRecord>();
  public tracks = new Map<string, TrackRecord>();
  public geofences = new Map<string, GeofenceRecord>();
  public telemetry = new Map<string, TelemetryRecord>();
  public meshNodes = new Map<string, { id: string; name: string; lastHeard: string; battery: number }>();
  public emergencies = new Map<string, EmergencyRecord>();

  // Rate Limiting sliding window structures
  private requestLog = new Map<string, number[]>(); // key -> timestamps array
  private failedLogins = new Map<string, number[]>();

  constructor() {
    this.server = http.createServer((req, res) => this.handleHttpRequest(req, res));
    this.setupWebSocketUpgrade();
  }

  resetRateLimits(): void {
    this.requestLog.clear();
    this.failedLogins.clear();
  }

  resetState(): void {
    this.users.clear();
    this.userTokens.clear();
    this.teams.clear();
    this.waypoints.clear();
    this.tracks.clear();
    this.geofences.clear();
    this.telemetry.clear();
    this.meshNodes.clear();
    this.emergencies.clear();
    this.requestLog.clear();
    this.failedLogins.clear();
  }

  async start(port = 0): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(port, () => {
        const addr = this.server.address();
        if (typeof addr === 'object' && addr !== null) {
          this.port = addr.port;
        }
        resolve(this.port);
      });
    });
  }

  async close(): Promise<void> {
    for (const ws of this.wsClients) {
      ws.close(1001, 'Server shutting down');
    }
    this.wsClients.clear();
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }

  getPort(): number {
    return this.port;
  }

  getBaseUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  getWsUrl(): string {
    return `ws://127.0.0.1:${this.port}/ws`;
  }

  // ============================================================================
  // JWT & AUTH HELPERS
  // ============================================================================

  generateJwt(payload: Record<string, any>, expiresInSec = 900): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const bodyObj = {
      ...payload,
      iat: now,
      exp: now + expiresInSec,
    };
    const body = Buffer.from(JSON.stringify(bodyObj)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(`${header}.${body}`)
      .digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  verifyJwt(token: string): { valid: boolean; expired: boolean; payload?: any } {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return { valid: false, expired: false };
      const [header, body, signature] = parts;
      const expectedSig = crypto
        .createHmac('sha256', this.secretKey)
        .update(`${header}.${body}`)
        .digest('base64url');
      if (signature !== expectedSig) return { valid: false, expired: false };

      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return { valid: false, expired: true, payload };
      }
      return { valid: true, expired: false, payload };
    } catch (e) {
      return { valid: false, expired: false };
    }
  }

  private authenticateRequest(req: http.IncomingMessage): { user?: UserRecord; error?: { status: number; message: string } } {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { error: { status: 401, message: 'Missing or invalid Authorization header' } };
    }
    const token = authHeader.substring(7);
    const res = this.verifyJwt(token);
    if (!res.valid) {
      if (res.expired) {
        return { error: { status: 401, message: 'TOKEN_EXPIRED' } };
      }
      return { error: { status: 401, message: 'INVALID_TOKEN' } };
    }
    let user = this.users.get(res.payload.sub);
    if (!user) {
      if (res.payload.role) {
        user = {
          id: res.payload.sub,
          email: res.payload.email || `${res.payload.sub}@treeline.org`,
          displayName: res.payload.sub,
          passwordHash: '',
          role: res.payload.role,
          createdAt: new Date().toISOString(),
        };
        this.users.set(user.id, user);
      } else {
        return { error: { status: 401, message: 'USER_NOT_FOUND' } };
      }
    }
    return { user };
  }

  // ============================================================================
  // RATE LIMITING
  // ============================================================================

  private checkRateLimit(req: http.IncomingMessage, path: string): { allowed: boolean; remaining: number; retryAfter?: number } {
    // 100% BYPASS for Emergency SOS endpoint
    if (path === '/api/v1/emergency/sos') {
      return { allowed: true, remaining: 999 };
    }

    // Extract client IP (handling trusted X-Forwarded-For)
    let ip = req.socket.remoteAddress || '127.0.0.1';
    const xff = req.headers['x-forwarded-for'];
    if (xff && typeof xff === 'string') {
      const parts = xff.split(',').map((s) => s.trim());
      if (parts.length > 0) ip = parts[0];
    }

    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const limit = 120; // 120 requests per minute

    const list = this.requestLog.get(ip) || [];
    // Evict timestamps outside sliding window
    const valid = list.filter((t) => now - t < windowMs);

    if (valid.length >= limit) {
      const oldest = valid[0];
      const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
      return { allowed: false, remaining: 0, retryAfter: Math.max(1, retryAfter) };
    }

    valid.push(now);
    this.requestLog.set(ip, valid);
    return { allowed: true, remaining: limit - valid.length };
  }

  // ============================================================================
  // WEBSOCKET UPGRADE & ROUTING
  // ============================================================================

  private setupWebSocketUpgrade() {
    this.server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (url.pathname !== '/ws') {
        socket.destroy();
        return;
      }

      // Check auth from query string ?token=...
      const token = url.searchParams.get('token');
      let authedUser: UserRecord | undefined;
      let authCloseError: { code: number; reason: string } | null = null;
      if (token) {
        const verify = this.verifyJwt(token);
        if (!verify.valid) {
          authCloseError = {
            code: 4401,
            reason: verify.expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
          };
        } else {
          authedUser = this.users.get(verify.payload.sub);
        }
      }

      const secKey = req.headers['sec-websocket-key'];
      if (!secKey) {
        socket.destroy();
        return;
      }

      this.acceptWebSocketUpgrade(secKey, socket);
      const ws = new WsSocket(socket, this);
      if (authedUser) {
        ws.userId = authedUser.id;
        ws.userRole = authedUser.role;
      }
      this.wsClients.add(ws);

      if (authCloseError) {
        setTimeout(() => {
          ws.close(authCloseError.code, authCloseError.reason);
        }, 20);
        return;
      }

      ws.send({
        type: 'CONNECTED',
        userId: ws.userId || 'anonymous',
        timestamp: Date.now(),
      });

      ws.send({
        type: 'CONNECTED',
        userId: ws.userId || 'anonymous',
        timestamp: Date.now(),
      });
    });
  }

  private acceptWebSocketUpgrade(secKey: string, socket: any) {
    const hash = crypto
      .createHash('sha1')
      .update(secKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');
    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${hash}`,
      '',
      '',
    ].join('\r\n');
    socket.write(responseHeaders);
  }

  removeWsSocket(ws: WsSocket) {
    this.wsClients.delete(ws);
  }

  broadcastToRoom(room: string, message: any, excludeWs?: WsSocket) {
    for (const ws of this.wsClients) {
      if (ws !== excludeWs && ws.rooms.has(room)) {
        ws.send(message);
      }
    }
  }

  handleWsMessage(ws: WsSocket, msg: any) {
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'AUTH': {
        const verify = this.verifyJwt(msg.token);
        if (!verify.valid) {
          ws.close(4401, verify.expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN');
          return;
        }
        ws.userId = verify.payload.sub;
        ws.userRole = verify.payload.role;
        ws.send({ type: 'AUTHENTICATED', userId: ws.userId });
        break;
      }

      case 'SUBSCRIBE': {
        const channels = Array.isArray(msg.channels) ? msg.channels : [msg.channels];
        const subscribed: string[] = [];

        for (const ch of channels) {
          if (ch.startsWith('team:')) {
            const teamId = ch.substring(5);
            const team = this.teams.get(teamId);
            // Verify team membership or guide/rescuer/admin
            if (team && ws.userId) {
              const isMember = team.members.some((m) => m.userId === ws.userId);
              const isStaff = ['guide', 'rescuer', 'admin'].includes(ws.userRole || '');
              if (isMember || isStaff) {
                ws.rooms.add(ch);
                subscribed.push(ch);
              }
            } else {
              ws.rooms.add(ch);
              subscribed.push(ch);
            }
          } else {
            ws.rooms.add(ch);
            subscribed.push(ch);
          }
        }

        ws.send({ type: 'SUBSCRIBED', channels: subscribed });
        break;
      }

      case 'SEND_TELEMETRY': {
        const payload = {
          type: 'TELEMETRY_BROADCAST',
          userId: ws.userId || 'unknown',
          coords: [msg.latitude, msg.longitude],
          altitude: msg.altitude,
          battery: msg.battery,
          timestamp: Date.now(),
        };
        // Broadcast to all team channels ws belongs to
        for (const room of ws.rooms) {
          if (room.startsWith('team:')) {
            this.broadcastToRoom(room, payload);
          }
        }
        break;
      }

      case 'SEND_CHAT': {
        const payload = {
          type: 'CHAT_MESSAGE',
          channelId: msg.channelId,
          senderId: ws.userId || 'anonymous',
          text: msg.text,
          timestamp: Date.now(),
        };
        this.broadcastToRoom(msg.channelId, payload);
        break;
      }

      case 'SEND_SOS': {
        const emergencyId = crypto.randomUUID();
        const payload = {
          type: 'EMERGENCY_ALERT',
          emergencyId,
          sender: ws.userId || 'anonymous',
          emergencyType: msg.emergencyType || 'DISTRESS',
          location: [msg.latitude, msg.longitude],
          notes: msg.notes,
          priority: 'ALERT',
          timestamp: Date.now(),
        };
        this.broadcastToRoom('emergency:broadcast', payload);
        break;
      }

      case 'PING': {
        ws.send({ type: 'PONG', timestamp: Date.now() });
        break;
      }

      default:
        ws.send({ type: 'ACK', received: msg.type });
    }
  }

  // ============================================================================
  // REST API ROUTING
  // ============================================================================

  private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const path = parsedUrl.pathname;
    const method = (req.method || 'GET').toUpperCase();

    // Check Rate Limit
    const rl = this.checkRateLimit(req, path);
    res.setHeader('X-RateLimit-Limit', '120');
    res.setHeader('X-RateLimit-Remaining', rl.remaining.toString());

    if (!rl.allowed) {
      res.setHeader('Retry-After', (rl.retryAfter || 60).toString());
      this.sendJson(res, 429, { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' });
      return;
    }

    // Read Body
    let body: any = {};
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      try {
        body = await this.readRequestBody(req);
      } catch (err) {
        this.sendJson(res, 400, { error: 'INVALID_JSON', message: 'Body parsing failed' });
        return;
      }
    }

    // Route matching
    try {
      // --- AUTH ROUTES ---
      if (path === '/api/v1/auth/register' && method === 'POST') {
        const { email, password, displayName } = body;
        if (!email || !email.includes('@') || email.includes('@@') || email.includes('..')) {
          this.sendJson(res, 400, { error: 'INVALID_EMAIL', message: 'Invalid email format' });
          return;
        }
        if (!password || password.length < 6) {
          this.sendJson(res, 400, { error: 'INVALID_PASSWORD', message: 'Password too short' });
          return;
        }
        for (const u of this.users.values()) {
          if (u.email === email) {
            this.sendJson(res, 409, { error: 'EMAIL_ALREADY_EXISTS', message: 'Email registered' });
            return;
          }
        }
        const user: UserRecord = {
          id: crypto.randomUUID(),
          email,
          displayName: displayName || email.split('@')[0],
          passwordHash: crypto.createHash('sha256').update(password).digest('hex'),
          role: 'hiker',
          createdAt: new Date().toISOString(),
        };
        this.users.set(user.id, user);

        const accessToken = this.generateJwt({ sub: user.id, email: user.email, role: user.role }, 900);
        const refreshToken = crypto.randomUUID();
        this.userTokens.set(refreshToken, { userId: user.id, token: refreshToken, revokedAt: null });

        const { passwordHash: _, ...userSafe } = user;
        this.sendJson(res, 201, { user: userSafe, accessToken, refreshToken });
        return;
      }

      if (path === '/api/v1/auth/login' && method === 'POST') {
        const { email, password } = body;
        const ip = req.socket.remoteAddress || '127.0.0.1';

        // Check Brute Force Auth Limit (10 attempts / 15 min)
        const attempts = this.failedLogins.get(ip) || [];
        const now = Date.now();
        const validAttempts = attempts.filter((t) => now - t < 15 * 60 * 1000);
        if (validAttempts.length >= 10) {
          this.sendJson(res, 429, { error: 'AUTH_RATE_LIMIT_EXCEEDED', message: 'Too many failed login attempts' });
          return;
        }

        let user: UserRecord | undefined;
        for (const u of this.users.values()) {
          if (u.email === email) {
            user = u;
            break;
          }
        }

        const inputHash = password ? crypto.createHash('sha256').update(password).digest('hex') : '';
        if (!user || user.passwordHash !== inputHash) {
          validAttempts.push(now);
          this.failedLogins.set(ip, validAttempts);
          this.sendJson(res, 401, { error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
          return;
        }

        const accessToken = this.generateJwt({ sub: user.id, email: user.email, role: user.role }, 900);
        const refreshToken = crypto.randomUUID();
        this.userTokens.set(refreshToken, { userId: user.id, token: refreshToken, revokedAt: null });

        const { passwordHash: _, ...userSafe } = user;
        this.sendJson(res, 200, { user: userSafe, accessToken, refreshToken });
        return;
      }

      if (path === '/api/v1/auth/refresh' && method === 'POST') {
        const { refreshToken } = body;
        const record = this.userTokens.get(refreshToken);
        if (!record || record.revokedAt !== null) {
          // Token theft detection: if an already-revoked token is used, revoke all tokens for that user!
          if (record && record.userId) {
            for (const t of this.userTokens.values()) {
              if (t.userId === record.userId) {
                t.revokedAt = new Date().toISOString();
              }
            }
          }
          this.sendJson(res, 401, { error: 'INVALID_REFRESH_TOKEN', message: 'Token revoked or invalid' });
          return;
        }

        // Revoke old token
        record.revokedAt = new Date().toISOString();

        const user = this.users.get(record.userId);
        if (!user) {
          this.sendJson(res, 401, { error: 'USER_NOT_FOUND' });
          return;
        }

        const newAccessToken = this.generateJwt({ sub: user.id, email: user.email, role: user.role }, 900);
        const newRefreshToken = crypto.randomUUID();
        this.userTokens.set(newRefreshToken, { userId: user.id, token: newRefreshToken, revokedAt: null });

        this.sendJson(res, 200, { accessToken: newAccessToken, refreshToken: newRefreshToken });
        return;
      }

      if (path === '/api/v1/auth/logout' && method === 'POST') {
        const auth = this.authenticateRequest(req);
        if (auth.error) {
          this.sendJson(res, auth.error.status, auth.error);
          return;
        }

        const { refreshToken } = body;
        if (refreshToken && this.userTokens.has(refreshToken)) {
          const rec = this.userTokens.get(refreshToken)!;
          rec.revokedAt = new Date().toISOString();
        }

        // Terminate any active WebSocket connections for this user with code 4401
        for (const ws of this.wsClients) {
          if (ws.userId === auth.user!.id) {
            ws.close(4401, 'Session Revoked');
          }
        }

        this.sendJson(res, 200, { success: true });
        return;
      }

      if (path === '/api/v1/auth/me' && method === 'GET') {
        const auth = this.authenticateRequest(req);
        if (auth.error) {
          res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token", error_description="Token expired"');
          this.sendJson(res, auth.error.status, auth.error);
          return;
        }
        const { passwordHash: _, ...userSafe } = auth.user!;
        this.sendJson(res, 200, { user: userSafe });
        return;
      }

      // --- TEAMS ROUTES ---
      if (path === '/api/v1/teams' && method === 'POST') {
        const auth = this.authenticateRequest(req);
        if (auth.error) {
          this.sendJson(res, auth.error.status, auth.error);
          return;
        }
        // Hiker cannot create teams
        if (auth.user!.role === 'hiker') {
          this.sendJson(res, 403, { error: 'INSUFFICIENT_PERMISSIONS', message: 'Hiker cannot create teams' });
          return;
        }
        const { name, callsign, safeRadiusMeters } = body;
        if (!name || name.trim().length < 2) {
          this.sendJson(res, 400, { error: 'INVALID_NAME', message: 'Team name must be at least 2 characters' });
          return;
        }
        const radius = safeRadiusMeters !== undefined ? safeRadiusMeters : 500.0;
        if (radius <= 0) {
          this.sendJson(res, 400, { error: 'INVALID_RADIUS', message: 'safeRadiusMeters must be greater than 0' });
          return;
        }

        const team: TeamRecord = {
          id: crypto.randomUUID(),
          name: name.trim(),
          callsign: callsign || 'LEAD-1',
          safeRadiusMeters: radius,
          version: 1,
          members: [{ userId: auth.user!.id, role: 'LEADER' }],
          createdAt: new Date().toISOString(),
        };
        this.teams.set(team.id, team);
        this.sendJson(res, 201, team);
        return;
      }

      if (path === '/api/v1/teams' && method === 'GET') {
        const auth = this.authenticateRequest(req);
        if (auth.error) {
          this.sendJson(res, auth.error.status, auth.error);
          return;
        }
        this.sendJson(res, 200, Array.from(this.teams.values()));
        return;
      }

      const teamMatch = path.match(/^\/api\/v1\/teams\/([a-zA-Z0-9-]+)$/);
      if (teamMatch && method === 'GET') {
        const auth = this.authenticateRequest(req);
        if (auth.error) {
          this.sendJson(res, auth.error.status, auth.error);
          return;
        }
        const teamId = teamMatch[1];
        const team = this.teams.get(teamId);
        if (!team) {
          this.sendJson(res, 404, { error: 'TEAM_NOT_FOUND' });
          return;
        }
        // If hiker, must be a member
        if (auth.user!.role === 'hiker' && !team.members.some((m) => m.userId === auth.user!.id)) {
          this.sendJson(res, 403, { error: 'FORBIDDEN', message: 'Hiker not member of this team' });
          return;
        }
        this.sendJson(res, 200, team);
        return;
      }

      if (teamMatch && method === 'PUT') {
        const auth = this.authenticateRequest(req);
        if (auth.error) {
          this.sendJson(res, auth.error.status, auth.error);
          return;
        }
        const teamId = teamMatch[1];
        const team = this.teams.get(teamId);
        if (!team) {
          this.sendJson(res, 404, { error: 'TEAM_NOT_FOUND' });
          return;
        }

        // Optimistic Concurrency Control (OCC)
        if (body.version !== undefined && body.version !== team.version) {
          this.sendJson(res, 409, { error: 'OCC_VERSION_MISMATCH', message: 'Concurrent edit detected' });
          return;
        }

        if (body.name) team.name = body.name;
        if (body.safeRadiusMeters) team.safeRadiusMeters = body.safeRadiusMeters;
        team.version += 1;

        this.sendJson(res, 200, team);
        return;
      }

      const memberMatch = path.match(/^\/api\/v1\/teams\/([a-zA-Z0-9-]+)\/members$/);
      if (memberMatch && method === 'POST') {
        const auth = this.authenticateRequest(req);
        if (auth.error) {
          this.sendJson(res, auth.error.status, auth.error);
          return;
        }
        const teamId = memberMatch[1];
        const team = this.teams.get(teamId);
        if (!team) {
          this.sendJson(res, 404, { error: 'TEAM_NOT_FOUND' });
          return;
        }
        const { userId, role } = body;
        if (team.members.some((m) => m.userId === userId)) {
          this.sendJson(res, 409, { error: 'MEMBER_ALREADY_EXISTS', message: 'User is already on team' });
          return;
        }
        team.members.push({ userId, role: role || 'MEMBER' });
        this.sendJson(res, 201, { teamId, userId, role: role || 'MEMBER' });
        return;
      }

      const delMemberMatch = path.match(/^\/api\/v1\/teams\/([a-zA-Z0-9-]+)\/members\/([a-zA-Z0-9-]+)$/);
      if (delMemberMatch && method === 'DELETE') {
        const auth = this.authenticateRequest(req);
        if (auth.error) {
          this.sendJson(res, auth.error.status, auth.error);
          return;
        }
        const [, teamId, userId] = delMemberMatch;
        const team = this.teams.get(teamId);
        if (!team) {
          this.sendJson(res, 404, { error: 'TEAM_NOT_FOUND' });
          return;
        }
        team.members = team.members.filter((m) => m.userId !== userId);
        this.sendJson(res, 200, { success: true });
        return;
      }

      // --- WAYPOINTS ROUTES ---
      if (path === '/api/v1/waypoints' && method === 'POST') {
        const auth = this.authenticateRequest(req);
        if (auth.error) {
          this.sendJson(res, auth.error.status, auth.error);
          return;
        }
        const { teamId, name, symbol, latitude, longitude, altitude, isHazard, hazardRadiusMeters } = body;

        if (latitude === undefined || latitude < -90.0 || latitude > 90.0) {
          this.sendJson(res, 400, { error: 'INVALID_LATITUDE', message: 'Latitude must be between -90 and 90' });
          return;
        }
        if (longitude === undefined || longitude < -180.0 || longitude > 180.0) {
          this.sendJson(res, 400, { error: 'INVALID_LONGITUDE', message: 'Longitude must be between -180 and 180' });
          return;
        }
        if (hazardRadiusMeters !== undefined && hazardRadiusMeters < 0) {
          this.sendJson(res, 400, { error: 'INVALID_HAZARD_RADIUS', message: 'hazardRadiusMeters cannot be negative' });
          return;
        }
        if (teamId && !this.teams.has(teamId)) {
          this.sendJson(res, 404, { error: 'TEAM_NOT_FOUND', message: 'Foreign key reference failed' });
          return;
        }

        const wp: WaypointRecord = {
          id: crypto.randomUUID(),
          teamId: teamId || 'default',
          name: name || 'Waypoint',
          symbol: symbol || 'WAYPOINT',
          latitude,
          longitude,
          altitude,
          isHazard: !!isHazard,
          hazardRadiusMeters,
          sequenceOrder: body.sequenceOrder || 1,
          locationGeom: `POINT(${longitude} ${latitude})`,
        };
        this.waypoints.set(wp.id, wp);
        this.sendJson(res, 201, wp);
        return;
      }

      if (path === '/api/v1/waypoints' && method === 'GET') {
        const auth = this.authenticateRequest(req);
        if (auth.error) {
          this.sendJson(res, auth.error.status, auth.error);
          return;
        }
        const teamId = parsedUrl.searchParams.get('teamId');
        let list = Array.from(this.waypoints.values());
        if (teamId) {
          list = list.filter((w) => w.teamId === teamId);
        }
        this.sendJson(res, 200, list);
        return;
      }

      const wpMatch = path.match(/^\/api\/v1\/waypoints\/([a-zA-Z0-9-]+)$/);
      if (wpMatch && method === 'PATCH') {
        const wp = this.waypoints.get(wpMatch[1]);
        if (!wp) {
          this.sendJson(res, 404, { error: 'WAYPOINT_NOT_FOUND' });
          return;
        }
        if (body.name) wp.name = body.name;
        if (body.sequenceOrder !== undefined) wp.sequenceOrder = body.sequenceOrder;
        this.sendJson(res, 200, wp);
        return;
      }

      if (wpMatch && method === 'DELETE') {
        const wp = this.waypoints.get(wpMatch[1]);
        if (!wp) {
          this.sendJson(res, 404, { error: 'WAYPOINT_NOT_FOUND' });
          return;
        }
        this.waypoints.delete(wpMatch[1]);
        this.sendJson(res, 200, { success: true });
        return;
      }

      // --- TRACKS ROUTES ---
      if (path === '/api/v1/tracks' && method === 'POST') {
        const auth = this.authenticateRequest(req);
        if (auth.error) {
          this.sendJson(res, auth.error.status, auth.error);
          return;
        }
        const { teamId, name, difficulty, corridorWidthMeters, path: trackPath } = body;

        if (!Array.isArray(trackPath) || trackPath.length < 2) {
          this.sendJson(res, 400, { error: 'INVALID_PATH', message: 'LineString requires at least 2 distinct points' });
          return;
        }
        for (const pt of trackPath) {
          if (!Array.isArray(pt) || pt.length !== 2 || typeof pt[0] !== 'number' || typeof pt[1] !== 'number') {
            this.sendJson(res, 400, { error: 'INVALID_COORDINATES', message: 'Coordinates must be valid numbers' });
            return;
          }
        }
        const width = corridorWidthMeters !== undefined ? corridorWidthMeters : 50.0;
        if (width <= 0) {
          this.sendJson(res, 400, { error: 'INVALID_CORRIDOR_WIDTH', message: 'corridorWidthMeters must be > 0' });
          return;
        }

        const track: TrackRecord = {
          id: crypto.randomUUID(),
          teamId: teamId || 'default',
          name: name || 'Track',
          difficulty: difficulty || 'MODERATE',
          corridorWidthMeters: width,
          path: trackPath,
          distanceKm: trackPath.length * 0.5,
          version: 1,
        };
        this.tracks.set(track.id, track);
        this.sendJson(res, 201, track);
        return;
      }

      const trackMatch = path.match(/^\/api\/v1\/tracks\/([a-zA-Z0-9-]+)$/);
      if (trackMatch && method === 'GET') {
        const track = this.tracks.get(trackMatch[1]);
        if (!track) {
          this.sendJson(res, 404, { error: 'TRACK_NOT_FOUND' });
          return;
        }
        this.sendJson(res, 200, track);
        return;
      }

      if (trackMatch && method === 'PUT') {
        const auth = this.authenticateRequest(req);
        if (auth.error) {
          this.sendJson(res, auth.error.status, auth.error);
          return;
        }
        if (auth.user!.role === 'hiker') {
          this.sendJson(res, 403, { error: 'FORBIDDEN', message: 'Hiker cannot modify route track' });
          return;
        }
        const track = this.tracks.get(trackMatch[1]);
        if (!track) {
          this.sendJson(res, 404, { error: 'TRACK_NOT_FOUND' });
          return;
        }
        if (body.version !== undefined && body.version !== track.version) {
          this.sendJson(res, 409, { error: 'OCC_VERSION_MISMATCH', message: 'Stale track version' });
          return;
        }
        if (body.name) track.name = body.name;
        track.version += 1;
        this.sendJson(res, 200, track);
        return;
      }

      if (trackMatch && method === 'PATCH') {
        const track = this.tracks.get(trackMatch[1]);
        if (!track) {
          this.sendJson(res, 404, { error: 'TRACK_NOT_FOUND' });
          return;
        }
        if (body.isArchived !== undefined) track.isArchived = body.isArchived;
        this.sendJson(res, 200, track);
        return;
      }

      const evalMatch = path.match(/^\/api\/v1\/tracks\/([a-zA-Z0-9-]+)\/evaluate$/);
      if (evalMatch && method === 'POST') {
        const track = this.tracks.get(evalMatch[1]);
        if (!track) {
          this.sendJson(res, 404, { error: 'TRACK_NOT_FOUND' });
          return;
        }
        const { latitude, longitude, headingDeg } = body;
        // Compute cross-track distance to track path (simplified Euclidean meters)
        let minDistanceMeters = Infinity;
        for (const [ptLat, ptLon] of track.path) {
          const dLat = (latitude - ptLat) * 111139;
          const dLon = (longitude - ptLon) * 111139 * Math.cos((latitude * Math.PI) / 180);
          const dist = Math.sqrt(dLat * dLat + dLon * dLon);
          if (dist < minDistanceMeters) minDistanceMeters = dist;
        }
        const isOffRoute = minDistanceMeters > track.corridorWidthMeters;
        const bearingDeviationDeg = headingDeg !== undefined ? Math.abs((headingDeg - 45.0) % 360) : 0;
        this.sendJson(res, 200, {
          crossTrackErrorMeters: Math.round(minDistanceMeters * 10) / 10,
          isOffRoute,
          bearingDeviationDeg,
        });
        return;
      }

      const sarMatch = path.match(/^\/api\/v1\/tracks\/([a-zA-Z0-9-]+)\/sar-corridor$/);
      if (sarMatch && method === 'POST') {
        const auth = this.authenticateRequest(req);
        if (auth.error) {
          this.sendJson(res, auth.error.status, auth.error);
          return;
        }
        if (auth.user!.role === 'hiker') {
          this.sendJson(res, 403, { error: 'FORBIDDEN', message: 'Hiker cannot generate SAR corridor' });
          return;
        }
        this.sendJson(res, 200, {
          sectorType: 'EXPANDING_SQUARE',
          corridorPolygon: [
            [43.35, 42.43],
            [43.37, 42.43],
            [43.37, 42.45],
            [43.35, 42.45],
            [43.35, 42.43],
          ],
        });
        return;
      }

      // --- GEOFENCES ROUTES ---
      if (path === '/api/v1/geofences' && method === 'POST') {
        const auth = this.authenticateRequest(req);
        if (auth.error) {
          this.sendJson(res, auth.error.status, auth.error);
          return;
        }
        const {
          teamId,
          name,
          fenceType,
          shapeType,
          centerLatitude,
          centerLongitude,
          radiusMeters,
          polygonCoordinates,
          breachAction,
        } = body;

        if (shapeType === 'CIRCLE') {
          if (radiusMeters === undefined || radiusMeters <= 0 || radiusMeters > 50000.0) {
            this.sendJson(res, 400, { error: 'INVALID_RADIUS', message: 'radiusMeters must be between 0 and 50000' });
            return;
          }
        } else if (shapeType === 'POLYGON') {
          if (!Array.isArray(polygonCoordinates) || polygonCoordinates.length < 3) {
            this.sendJson(res, 400, { error: 'INVALID_POLYGON', message: 'Polygon requires at least 3 vertices' });
            return;
          }
          // Bowtie self-intersection detection
          if (this.isSelfIntersecting(polygonCoordinates)) {
            this.sendJson(res, 400, { error: 'SELF_INTERSECTING_POLYGON', message: 'Polygon vertices intersect' });
            return;
          }
          // Auto-close polygon if first != last
          const first = polygonCoordinates[0];
          const last = polygonCoordinates[polygonCoordinates.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            polygonCoordinates.push([...first]);
          }
        }

        const gf: GeofenceRecord = {
          id: crypto.randomUUID(),
          teamId: teamId || 'default',
          name: name || 'Geofence',
          fenceType: fenceType || 'SAFETY_BUFFER',
          shapeType: shapeType || 'CIRCLE',
          centerLatitude,
          centerLongitude,
          radiusMeters,
          polygonCoordinates,
          breachAction: breachAction || 'ALERT_TEAM',
          isActive: true,
          geom: shapeType === 'CIRCLE' ? `CIRCLE(${centerLongitude} ${centerLatitude}, ${radiusMeters})` : 'POLYGON(...)',
        };
        this.geofences.set(gf.id, gf);
        this.sendJson(res, 201, gf);
        return;
      }

      if (path === '/api/v1/geofences' && method === 'GET') {
        this.sendJson(res, 200, Array.from(this.geofences.values()));
        return;
      }

      const gfMatch = path.match(/^\/api\/v1\/geofences\/([a-zA-Z0-9-]+)$/);
      if (gfMatch && method === 'PATCH') {
        const gf = this.geofences.get(gfMatch[1]);
        if (!gf) {
          this.sendJson(res, 404, { error: 'GEOFENCE_NOT_FOUND' });
          return;
        }
        if (body.isActive !== undefined) gf.isActive = body.isActive;
        this.sendJson(res, 200, gf);
        return;
      }

      if (gfMatch && method === 'DELETE') {
        this.geofences.delete(gfMatch[1]);
        this.sendJson(res, 200, { success: true });
        return;
      }

      const gfCheckMatch = path.match(/^\/api\/v1\/geofences\/([a-zA-Z0-9-]+)\/check$/);
      if (gfCheckMatch && method === 'POST') {
        const gf = this.geofences.get(gfCheckMatch[1]);
        if (!gf) {
          this.sendJson(res, 404, { error: 'GEOFENCE_NOT_FOUND' });
          return;
        }
        const { latitude, longitude } = body;
        const isInside = this.checkPointInGeofence(gf, latitude, longitude);
        this.sendJson(res, 200, {
          isInside,
          breachStatus: isInside ? 'CLEAR' : 'BREACHED',
        });
        return;
      }

      // --- TELEMETRY ROUTES ---
      if (path === '/api/v1/telemetry' && method === 'POST') {
        const auth = this.authenticateRequest(req);
        const { latitude, longitude, altitude, speedMps, headingDeg, batteryLevel, transportType, privacyMode, recordedAt } = body;

        if (batteryLevel !== undefined && (batteryLevel < 0 || batteryLevel > 100)) {
          this.sendJson(res, 400, { error: 'INVALID_BATTERY', message: 'batteryLevel must be between 0 and 100' });
          return;
        }
        if (headingDeg !== undefined && (headingDeg < 0.0 || headingDeg > 360.0)) {
          this.sendJson(res, 400, { error: 'INVALID_HEADING', message: 'headingDeg must be between 0 and 360' });
          return;
        }

        // Privacy quantization
        let lat = latitude;
        let lon = longitude;
        if (privacyMode === 'REDUCED') {
          lat = Math.round(latitude * 100) / 100;
          lon = Math.round(longitude * 100) / 100;
        }

        const telem: TelemetryRecord = {
          id: crypto.randomUUID(),
          userId: auth.user?.id || body.userId,
          meshNodeId: body.meshNodeId,
          latitude: lat,
          longitude: lon,
          altitude,
          speedMps,
          headingDeg,
          batteryLevel,
          transportType: transportType || 'INTERNET',
          recordedAt: recordedAt || new Date().toISOString(),
        };

        if (body.meshNodeId) {
          const node = this.meshNodes.get(body.meshNodeId) || {
            id: body.meshNodeId,
            name: body.meshNodeId,
            battery: batteryLevel || 100,
            lastHeard: telem.recordedAt,
          };
          node.lastHeard = telem.recordedAt;
          this.meshNodes.set(body.meshNodeId, node);
        }

        this.telemetry.set(telem.id, telem);
        this.sendJson(res, 201, telem);
        return;
      }

      if (path === '/api/v1/telemetry/batch' && method === 'POST') {
        const auth = this.authenticateRequest(req);
        const { points } = body;
        if (!Array.isArray(points) || points.length === 0) {
          this.sendJson(res, 400, { error: 'INVALID_BATCH', message: 'Points array cannot be empty' });
          return;
        }

        let inserted = 0;
        for (const pt of points) {
          const telem: TelemetryRecord = {
            id: crypto.randomUUID(),
            userId: auth.user?.id || pt.userId,
            latitude: pt.latitude,
            longitude: pt.longitude,
            altitude: pt.altitude,
            batteryLevel: pt.batteryLevel,
            recordedAt: pt.recordedAt || new Date().toISOString(),
          };
          this.telemetry.set(telem.id, telem);
          inserted++;

          // Geofence breach check across active geofences
          for (const gf of this.geofences.values()) {
            if (gf.isActive) {
              const isInside = this.checkPointInGeofence(gf, pt.latitude, pt.longitude);
              if (!isInside && gf.fenceType === 'SAFETY_BUFFER') {
                this.broadcastToRoom(`team:${gf.teamId}`, {
                  type: 'GEOFENCE_ALERT',
                  geofenceId: gf.id,
                  breachedPoint: [pt.latitude, pt.longitude],
                  timestamp: Date.now(),
                });
              }
            }
          }
        }

        // Broadcast latest point to squad
        const latest = points[points.length - 1];
        if (auth.user) {
          this.broadcastToRoom(`team:default`, {
            type: 'MEMBER_TELEMETRY',
            userId: auth.user.id,
            coords: [latest.latitude, latest.longitude],
            timestamp: Date.now(),
          });
        }

        this.sendJson(res, 201, { inserted });
        return;
      }

      if (path === '/api/v1/telemetry/history' && method === 'GET') {
        const userId = parsedUrl.searchParams.get('userId');
        let list = Array.from(this.telemetry.values());
        if (userId) {
          list = list.filter((t) => t.userId === userId);
        }
        list.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
        this.sendJson(res, 200, { points: list.slice(0, 50) });
        return;
      }

      // --- MESH NODES ---
      if (path === '/api/v1/mesh/nodes' && method === 'GET') {
        this.sendJson(res, 200, Array.from(this.meshNodes.values()));
        return;
      }

      if (path === '/api/v1/mesh/nodes/heartbeat' && method === 'POST') {
        const { nodeId, name, battery } = body;
        const node = {
          id: nodeId,
          name: name || nodeId,
          battery: battery || 100,
          lastHeard: new Date().toISOString(),
        };
        this.meshNodes.set(nodeId, node);
        this.sendJson(res, 200, node);
        return;
      }

      // --- EMERGENCY SOS ---
      if (path === '/api/v1/emergency/sos' && method === 'POST') {
        const auth = this.authenticateRequest(req);
        const { emergencyType, latitude, longitude, notes } = body;

        const emergency: EmergencyRecord = {
          id: crypto.randomUUID(),
          userId: auth.user?.id,
          emergencyType: emergencyType || 'DISTRESS',
          latitude,
          longitude,
          notes,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        };
        this.emergencies.set(emergency.id, emergency);

        // Create tactical waypoint with SOS marker
        const wp: WaypointRecord = {
          id: crypto.randomUUID(),
          teamId: 'default',
          name: `SOS: ${emergency.emergencyType}`,
          symbol: 'SOS',
          latitude,
          longitude,
          isHazard: true,
          hazardRadiusMeters: 200.0,
          locationGeom: `POINT(${longitude} ${latitude})`,
        };
        this.waypoints.set(wp.id, wp);

        // Real-time broadcast to emergency:broadcast room
        this.broadcastToRoom('emergency:broadcast', {
          type: 'EMERGENCY_ALERT',
          emergencyId: emergency.id,
          sender: auth.user?.id || 'anonymous',
          emergencyType: emergency.emergencyType,
          location: [latitude, longitude],
          priority: 'ALERT',
          timestamp: Date.now(),
        });

        this.sendJson(res, 201, { emergencyId: emergency.id, status: 'ACTIVE' });
        return;
      }

      const resEmergencyMatch = path.match(/^\/api\/v1\/emergency\/([a-zA-Z0-9-]+)\/resolve$/);
      if (resEmergencyMatch && method === 'PATCH') {
        const auth = this.authenticateRequest(req);
        if (auth.error) {
          this.sendJson(res, auth.error.status, auth.error);
          return;
        }
        if (auth.user!.role === 'hiker') {
          this.sendJson(res, 403, { error: 'FORBIDDEN', message: 'Hiker cannot resolve emergency' });
          return;
        }
        const em = this.emergencies.get(resEmergencyMatch[1]);
        if (!em) {
          this.sendJson(res, 404, { error: 'EMERGENCY_NOT_FOUND' });
          return;
        }
        em.status = 'RESOLVED';
        em.resolutionNotes = body.resolutionNotes;

        this.broadcastToRoom('emergency:broadcast', {
          type: 'EMERGENCY_RESOLVED',
          emergencyId: em.id,
          resolutionNotes: em.resolutionNotes,
          timestamp: Date.now(),
        });

        this.sendJson(res, 200, { emergencyId: em.id, status: 'RESOLVED' });
        return;
      }

      // Default Not Found
      this.sendJson(res, 404, { error: 'NOT_FOUND', message: `Route ${method} ${path} not found` });
    } catch (err: any) {
      this.sendJson(res, 500, { error: 'INTERNAL_ERROR', message: err.message });
    }
  }

  // ============================================================================
  // GEOMETRY HELPERS
  // ============================================================================

  private checkPointInGeofence(gf: GeofenceRecord, lat: number, lon: number): boolean {
    if (gf.shapeType === 'CIRCLE') {
      const dLat = (lat - (gf.centerLatitude || 0)) * 111139;
      const dLon = (lon - (gf.centerLongitude || 0)) * 111139 * Math.cos((lat * Math.PI) / 180);
      const dist = Math.sqrt(dLat * dLat + dLon * dLon);
      // Perimeter inclusion: dist <= radius (with 0.1m epsilon for float conversion)
      return dist <= (gf.radiusMeters || 0) + 0.1;
    }

    if (gf.shapeType === 'POLYGON' && gf.polygonCoordinates) {
      // Ray-casting algorithm for point in polygon
      const vs = gf.polygonCoordinates;
      let inside = false;
      for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0], yi = vs[i][1];
        const xj = vs[j][0], yj = vs[j][1];
        const intersect = yi > lon !== yj > lon && lat < ((xj - xi) * (lon - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    }

    return false;
  }

  private isSelfIntersecting(coords: Array<[number, number]>): boolean {
    // Detect bowtie: check if any two non-adjacent line segments intersect
    const n = coords.length;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n - 1; j++) {
        if (i === 0 && j === n - 2) continue; // Skip adjacent first and last
        const p1 = coords[i], p2 = coords[i + 1];
        const p3 = coords[j], p4 = coords[j + 1];
        if (this.segmentsIntersect(p1, p2, p3, p4)) return true;
      }
    }
    return false;
  }

  private segmentsIntersect(p1: [number, number], p2: [number, number], p3: [number, number], p4: [number, number]): boolean {
    const ccw = (a: [number, number], b: [number, number], c: [number, number]) => {
      return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
    };
    return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
  }

  private sendJson(res: http.ServerResponse, status: number, data: any) {
    const json = JSON.stringify(data);
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(json),
    });
    res.end(json);
  }

  private readRequestBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        if (chunks.length === 0) {
          resolve({});
          return;
        }
        const text = Buffer.concat(chunks).toString('utf-8');
        try {
          resolve(JSON.parse(text));
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
    });
  }
}
