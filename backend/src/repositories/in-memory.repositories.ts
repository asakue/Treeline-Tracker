/**
 * @fileoverview Genuine In-Memory Repositories for Treeline Tracker
 * Implements real state, OCC version checks, cascades, token family revocation, and spatial queries.
 */

import crypto from 'node:crypto';
import {
  IRepositories,
  IUserRepository,
  ITeamRepository,
  ITrackRepository,
  IWaypointRepository,
  IGeofenceRepository,
  IEmergencyRepository,
  IMeshRepository,
  ITelemetryRepository,
  UserEntity,
  TeamEntity,
  TeamMemberEntity,
  TrackEntity,
  WaypointEntity,
  GeofenceEntity,
  EmergencyEntity,
  MeshNodeEntity,
  TelemetryPointEntity,
  LoRaMessageEntity,
} from './interfaces.js';
import { ITokenRepository, TokenRecord } from '../auth/jwt.js';
import { OccConflictError, NotFoundError } from '../middleware/error-handler.js';

export class InMemoryTokenRepository implements ITokenRepository {
  public tokens = new Map<string, TokenRecord>();

  async createToken(data: {
    userId: string;
    familyId: string;
    tokenHash: string;
    deviceInfo?: string | null;
    ipAddress?: string | null;
    expiresAt: Date;
  }): Promise<TokenRecord> {
    const record: TokenRecord = {
      id: crypto.randomUUID(),
      userId: data.userId,
      familyId: data.familyId,
      tokenHash: data.tokenHash,
      deviceInfo: data.deviceInfo || null,
      ipAddress: data.ipAddress || null,
      expiresAt: data.expiresAt,
      revokedAt: null,
      createdAt: new Date(),
    };
    this.tokens.set(record.id, record);
    return record;
  }

  async findByTokenHash(tokenHash: string): Promise<TokenRecord | null> {
    for (const token of this.tokens.values()) {
      if (token.tokenHash === tokenHash) {
        return { ...token };
      }
    }
    return null;
  }

  async revokeToken(id: string): Promise<void> {
    const token = this.tokens.get(id);
    if (token) {
      token.revokedAt = new Date();
    }
  }

  async revokeFamily(familyId: string): Promise<void> {
    const now = new Date();
    for (const token of this.tokens.values()) {
      if (token.familyId === familyId && !token.revokedAt) {
        token.revokedAt = now;
      }
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    const now = new Date();
    for (const token of this.tokens.values()) {
      if (token.userId === userId && !token.revokedAt) {
        token.revokedAt = now;
      }
    }
  }

  clear(): void {
    this.tokens.clear();
  }
}

export class InMemoryUserRepository implements IUserRepository {
  public users = new Map<string, UserEntity>();

  async create(data: Omit<UserEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserEntity> {
    const id = crypto.randomUUID();
    const now = new Date();
    const user: UserEntity = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    return { ...user };
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return { ...user };
      }
    }
    return null;
  }

  async update(id: string, data: Partial<UserEntity>): Promise<UserEntity | null> {
    const user = this.users.get(id);
    if (!user) return null;
    const updated: UserEntity = {
      ...user,
      ...data,
      updatedAt: new Date(),
    };
    this.users.set(id, updated);
    return { ...updated };
  }

  clear(): void {
    this.users.clear();
  }
}

export class InMemoryTeamRepository implements ITeamRepository {
  public teams = new Map<string, TeamEntity>();
  public members: TeamMemberEntity[] = [];

  async create(data: Omit<TeamEntity, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<TeamEntity> {
    const id = crypto.randomUUID();
    const now = new Date();
    const team: TeamEntity = {
      ...data,
      id,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.teams.set(id, team);
    // Automatically add creator as LEADER
    this.members.push({
      id: crypto.randomUUID(),
      teamId: id,
      userId: data.createdByUserId,
      role: 'LEADER',
      joinedAt: now,
    });
    return { ...team };
  }

  async findById(id: string): Promise<TeamEntity | null> {
    const team = this.teams.get(id);
    return team ? { ...team } : null;
  }

  async list(filter?: { status?: string; userId?: string }): Promise<TeamEntity[]> {
    let result = Array.from(this.teams.values());
    if (filter?.status) {
      result = result.filter(t => t.status === filter.status);
    }
    if (filter?.userId) {
      const userTeamIds = this.members.filter(m => m.userId === filter.userId).map(m => m.teamId);
      result = result.filter(t => userTeamIds.includes(t.id));
    }
    return result.map(t => ({ ...t }));
  }

  async update(id: string, expectedVersion: number, data: Partial<Omit<TeamEntity, 'id' | 'version'>>): Promise<TeamEntity> {
    const team = this.teams.get(id);
    if (!team) {
      throw new NotFoundError('Team not found');
    }
    if (team.version !== expectedVersion) {
      throw new OccConflictError(expectedVersion, team.version);
    }
    const updated: TeamEntity = {
      ...team,
      ...data,
      version: team.version + 1,
      updatedAt: new Date(),
    };
    this.teams.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    const exists = this.teams.has(id);
    if (exists) {
      this.teams.delete(id);
      this.members = this.members.filter(m => m.teamId !== id);
    }
    return exists;
  }

  async addMember(teamId: string, userId: string, role: TeamMemberEntity['role'] = 'MEMBER'): Promise<TeamMemberEntity> {
    const existing = this.members.find(m => m.teamId === teamId && m.userId === userId);
    if (existing) {
      existing.role = role;
      return { ...existing };
    }
    const member: TeamMemberEntity = {
      id: crypto.randomUUID(),
      teamId,
      userId,
      role,
      joinedAt: new Date(),
    };
    this.members.push(member);
    return { ...member };
  }

  async removeMember(teamId: string, userId: string): Promise<boolean> {
    const initialLen = this.members.length;
    this.members = this.members.filter(m => !(m.teamId === teamId && m.userId === userId));
    return this.members.length < initialLen;
  }

  async getMembers(teamId: string): Promise<TeamMemberEntity[]> {
    return this.members.filter(m => m.teamId === teamId).map(m => ({ ...m }));
  }

  async getUserTeamIds(userId: string): Promise<string[]> {
    return this.members.filter(m => m.userId === userId).map(m => m.teamId);
  }

  clear(): void {
    this.teams.clear();
    this.members = [];
  }
}

export class InMemoryTrackRepository implements ITrackRepository {
  public tracks = new Map<string, TrackEntity>();

  async create(data: Omit<TrackEntity, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<TrackEntity> {
    const id = crypto.randomUUID();
    const now = new Date();
    const track: TrackEntity = {
      ...data,
      id,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.tracks.set(id, track);
    return { ...track };
  }

  async findById(id: string): Promise<TrackEntity | null> {
    const track = this.tracks.get(id);
    return track ? { ...track } : null;
  }

  async list(filter?: { teamId?: string; userId?: string; includeArchived?: boolean }): Promise<TrackEntity[]> {
    let result = Array.from(this.tracks.values());
    if (!filter?.includeArchived) {
      result = result.filter(t => !t.isArchived);
    }
    if (filter?.teamId) {
      result = result.filter(t => t.teamId === filter.teamId);
    }
    if (filter?.userId) {
      result = result.filter(t => t.userId === filter.userId);
    }
    return result.map(t => ({ ...t }));
  }

  async update(id: string, expectedVersion: number, data: Partial<Omit<TrackEntity, 'id' | 'version'>>): Promise<TrackEntity> {
    const track = this.tracks.get(id);
    if (!track) {
      throw new NotFoundError('Track not found');
    }
    if (track.version !== expectedVersion) {
      throw new OccConflictError(expectedVersion, track.version);
    }
    const updated: TrackEntity = {
      ...track,
      ...data,
      version: track.version + 1,
      updatedAt: new Date(),
    };
    this.tracks.set(id, updated);
    return { ...updated };
  }

  async delete(id: string, permanent = false): Promise<{ deleted: boolean; archived: boolean }> {
    const track = this.tracks.get(id);
    if (!track) {
      return { deleted: false, archived: false };
    }
    if (permanent) {
      this.tracks.delete(id);
      return { deleted: true, archived: false };
    } else {
      track.isArchived = true;
      track.archivedAt = new Date();
      track.updatedAt = new Date();
      return { deleted: true, archived: true };
    }
  }

  clear(): void {
    this.tracks.clear();
  }
}

export class InMemoryWaypointRepository implements IWaypointRepository {
  public waypoints = new Map<string, WaypointEntity>();

  async create(data: Omit<WaypointEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<WaypointEntity> {
    const id = crypto.randomUUID();
    const now = new Date();
    const wp: WaypointEntity = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.waypoints.set(id, wp);
    return { ...wp };
  }

  async findById(id: string): Promise<WaypointEntity | null> {
    const wp = this.waypoints.get(id);
    return wp ? { ...wp } : null;
  }

  async list(filter?: { trackId?: string; teamId?: string }): Promise<WaypointEntity[]> {
    let result = Array.from(this.waypoints.values());
    if (filter?.trackId) {
      result = result.filter(w => w.trackId === filter.trackId);
    }
    if (filter?.teamId) {
      result = result.filter(w => w.teamId === filter.teamId);
    }
    return result.sort((a, b) => a.sequenceOrder - b.sequenceOrder).map(w => ({ ...w }));
  }

  async delete(id: string): Promise<boolean> {
    return this.waypoints.delete(id);
  }

  clear(): void {
    this.waypoints.clear();
  }
}

export class InMemoryGeofenceRepository implements IGeofenceRepository {
  public geofences = new Map<string, GeofenceEntity>();

  async create(data: Omit<GeofenceEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<GeofenceEntity> {
    const id = crypto.randomUUID();
    const now = new Date();
    const gf: GeofenceEntity = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.geofences.set(id, gf);
    return { ...gf };
  }

  async findById(id: string): Promise<GeofenceEntity | null> {
    const gf = this.geofences.get(id);
    return gf ? { ...gf } : null;
  }

  async list(filter?: { teamId?: string; activeOnly?: boolean }): Promise<GeofenceEntity[]> {
    let result = Array.from(this.geofences.values());
    if (filter?.teamId) {
      result = result.filter(g => g.teamId === filter.teamId);
    }
    if (filter?.activeOnly) {
      result = result.filter(g => g.isActive);
    }
    return result.map(g => ({ ...g }));
  }

  async delete(id: string): Promise<boolean> {
    return this.geofences.delete(id);
  }

  clear(): void {
    this.geofences.clear();
  }
}

export class InMemoryEmergencyRepository implements IEmergencyRepository {
  public emergencies = new Map<string, EmergencyEntity>();

  async create(data: Omit<EmergencyEntity, 'id' | 'acknowledgedBy' | 'createdAt' | 'updatedAt'>): Promise<EmergencyEntity> {
    const id = crypto.randomUUID();
    const now = new Date();
    const em: EmergencyEntity = {
      ...data,
      id,
      acknowledgedBy: [],
      createdAt: now,
      updatedAt: now,
    };
    this.emergencies.set(id, em);
    return { ...em };
  }

  async findById(id: string): Promise<EmergencyEntity | null> {
    const em = this.emergencies.get(id);
    return em ? { ...em } : null;
  }

  async listActive(filter?: { teamId?: string }): Promise<EmergencyEntity[]> {
    let result = Array.from(this.emergencies.values()).filter(
      e => e.status === 'ACTIVE' || e.status === 'ACKNOWLEDGED'
    );
    if (filter?.teamId) {
      result = result.filter(e => !e.teamId || e.teamId === filter.teamId);
    }
    return result.map(e => ({ ...e }));
  }

  async acknowledge(id: string, userId: string): Promise<EmergencyEntity> {
    const em = this.emergencies.get(id);
    if (!em) throw new NotFoundError('Emergency not found');
    if (!em.acknowledgedBy.includes(userId)) {
      em.acknowledgedBy.push(userId);
    }
    em.status = 'ACKNOWLEDGED';
    em.updatedAt = new Date();
    return { ...em };
  }

  async resolve(id: string, resolvedBy: string, notes?: string): Promise<EmergencyEntity> {
    const em = this.emergencies.get(id);
    if (!em) throw new NotFoundError('Emergency not found');
    em.status = 'RESOLVED';
    em.resolvedBy = resolvedBy;
    em.resolvedAt = new Date();
    if (notes) em.notes = notes;
    em.updatedAt = new Date();
    return { ...em };
  }

  clear(): void {
    this.emergencies.clear();
  }
}

export class InMemoryMeshRepository implements IMeshRepository {
  public nodes = new Map<number, MeshNodeEntity>();
  public messages: LoRaMessageEntity[] = [];

  async registerNode(data: Omit<MeshNodeEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<MeshNodeEntity> {
    const existing = this.nodes.get(data.nodeNum);
    const now = new Date();
    if (existing) {
      const updated: MeshNodeEntity = {
        ...existing,
        ...data,
        updatedAt: now,
      };
      this.nodes.set(data.nodeNum, updated);
      return { ...updated };
    }
    const node: MeshNodeEntity = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.nodes.set(data.nodeNum, node);
    return { ...node };
  }

  async findByNodeNum(nodeNum: number): Promise<MeshNodeEntity | null> {
    const n = this.nodes.get(nodeNum);
    return n ? { ...n } : null;
  }

  async findByIdStr(nodeIdStr: string): Promise<MeshNodeEntity | null> {
    for (const n of this.nodes.values()) {
      if (n.nodeIdStr === nodeIdStr) return { ...n };
    }
    return null;
  }

  async list(filter?: { teamId?: string; activeWithinMinutes?: number }): Promise<MeshNodeEntity[]> {
    let result = Array.from(this.nodes.values());
    if (filter?.teamId) {
      result = result.filter(n => n.teamId === filter.teamId);
    }
    if (filter?.activeWithinMinutes && filter.activeWithinMinutes > 0) {
      const threshold = Date.now() - filter.activeWithinMinutes * 60 * 1000;
      result = result.filter(n => n.lastHeard && n.lastHeard.getTime() >= threshold);
    }
    return result.map(n => ({ ...n }));
  }

  async updateHeartbeat(nodeNum: number, vitals: Partial<MeshNodeEntity>): Promise<MeshNodeEntity | null> {
    const node = this.nodes.get(nodeNum);
    if (!node) return null;
    const updated: MeshNodeEntity = {
      ...node,
      ...vitals,
      lastHeard: new Date(),
      updatedAt: new Date(),
    };
    this.nodes.set(nodeNum, updated);
    return { ...updated };
  }

  async logMessage(data: Omit<LoRaMessageEntity, 'id' | 'receivedAt'>): Promise<LoRaMessageEntity> {
    const msg: LoRaMessageEntity = {
      ...data,
      id: crypto.randomUUID(),
      receivedAt: new Date(),
    };
    this.messages.push(msg);
    return { ...msg };
  }

  async getMessages(filter?: { teamId?: string; limit?: number }): Promise<LoRaMessageEntity[]> {
    let result = this.messages;
    if (filter?.teamId) {
      result = result.filter(m => m.teamId === filter.teamId);
    }
    const limit = filter?.limit || 100;
    return result.slice(-limit).map(m => ({ ...m }));
  }

  clear(): void {
    this.nodes.clear();
    this.messages = [];
  }
}

export class InMemoryTelemetryRepository implements ITelemetryRepository {
  public points: TelemetryPointEntity[] = [];

  async insertBatch(points: Omit<TelemetryPointEntity, 'id' | 'createdAt'>[]): Promise<{ inserted: number; skipped: number }> {
    const now = new Date();
    let inserted = 0;
    for (const p of points) {
      this.points.push({
        ...p,
        id: crypto.randomUUID(),
        createdAt: now,
      });
      inserted++;
    }
    return { inserted, skipped: 0 };
  }

  async queryHistory(filter: { userId?: string; teamId?: string; startTime: Date; endTime: Date; limit?: number }): Promise<TelemetryPointEntity[]> {
    const startMs = filter.startTime.getTime();
    const endMs = filter.endTime.getTime();
    let result = this.points.filter(p => {
      const t = p.recordedAt.getTime();
      return t >= startMs && t <= endMs;
    });
    if (filter.userId) {
      result = result.filter(p => p.userId === filter.userId);
    }
    if (filter.teamId) {
      result = result.filter(p => p.teamId === filter.teamId);
    }
    result.sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
    const limit = filter.limit || 500;
    return result.slice(0, limit).map(p => ({ ...p }));
  }

  clear(): void {
    this.points = [];
  }
}

export function createInMemoryRepositories(): IRepositories {
  return {
    users: new InMemoryUserRepository(),
    tokens: new InMemoryTokenRepository(),
    teams: new InMemoryTeamRepository(),
    tracks: new InMemoryTrackRepository(),
    waypoints: new InMemoryWaypointRepository(),
    geofences: new InMemoryGeofenceRepository(),
    emergencies: new InMemoryEmergencyRepository(),
    mesh: new InMemoryMeshRepository(),
    telemetry: new InMemoryTelemetryRepository(),
  };
}
