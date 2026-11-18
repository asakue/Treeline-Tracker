/**
 * @fileoverview Production Drizzle ORM Repositories (PostgreSQL 16 + PostGIS)
 */

import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { TreelineDb } from '../db/client.js';
import * as schema from '../db/schema.js';
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

export class DrizzleUserRepository implements IUserRepository {
  constructor(private db: TreelineDb) {}

  async create(data: Omit<UserEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserEntity> {
    const [row] = await this.db.insert(schema.users).values(data as any).returning();
    return row as UserEntity;
  }

  async findById(id: string): Promise<UserEntity | null> {
    const [row] = await this.db.select().from(schema.users).where(eq(schema.users.id, id));
    return (row as UserEntity) || null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const [row] = await this.db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase()));
    return (row as UserEntity) || null;
  }

  async update(id: string, data: Partial<UserEntity>): Promise<UserEntity | null> {
    const [row] = await this.db.update(schema.users)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(schema.users.id, id))
      .returning();
    return (row as UserEntity) || null;
  }
}

export class DrizzleTokenRepository implements ITokenRepository {
  constructor(private db: TreelineDb) {}

  async createToken(data: {
    userId: string;
    familyId: string;
    tokenHash: string;
    deviceInfo?: string | null;
    ipAddress?: string | null;
    expiresAt: Date;
  }): Promise<TokenRecord> {
    const [row] = await this.db.insert(schema.userTokens).values(data as any).returning();
    return row as TokenRecord;
  }

  async findByTokenHash(tokenHash: string): Promise<TokenRecord | null> {
    const [row] = await this.db.select().from(schema.userTokens).where(eq(schema.userTokens.tokenHash, tokenHash));
    return (row as TokenRecord) || null;
  }

  async revokeToken(id: string): Promise<void> {
    await this.db.update(schema.userTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.userTokens.id, id));
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.db.update(schema.userTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.userTokens.familyId, familyId), sql`revoked_at IS NULL`));
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.db.update(schema.userTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.userTokens.userId, userId), sql`revoked_at IS NULL`));
  }
}

export class DrizzleTeamRepository implements ITeamRepository {
  constructor(private db: TreelineDb) {}

  async create(data: Omit<TeamEntity, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<TeamEntity> {
    const [row] = await this.db.insert(schema.teams).values(data as any).returning();
    // Add creator as LEADER
    await this.db.insert(schema.teamMembers).values({
      teamId: row.id,
      userId: data.createdByUserId,
      role: 'LEADER',
    });
    return row as TeamEntity;
  }

  async findById(id: string): Promise<TeamEntity | null> {
    const [row] = await this.db.select().from(schema.teams).where(eq(schema.teams.id, id));
    return (row as TeamEntity) || null;
  }

  async list(filter?: { status?: string; userId?: string }): Promise<TeamEntity[]> {
    let query = this.db.select().from(schema.teams);
    if (filter?.status) {
      query = query.where(eq(schema.teams.status, filter.status as any)) as any;
    }
    const rows = await query;
    return rows as TeamEntity[];
  }

  async update(id: string, expectedVersion: number, data: Partial<Omit<TeamEntity, 'id' | 'version'>>): Promise<TeamEntity> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundError('Team not found');

    const [updated] = await this.db.update(schema.teams)
      .set({
        ...data,
        version: expectedVersion + 1,
        updatedAt: new Date(),
      } as any)
      .where(and(eq(schema.teams.id, id), eq(schema.teams.version, expectedVersion)))
      .returning();

    if (!updated) {
      throw new OccConflictError(expectedVersion, existing.version);
    }
    return updated as TeamEntity;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db.delete(schema.teams).where(eq(schema.teams.id, id)).returning();
    return deleted.length > 0;
  }

  async addMember(teamId: string, userId: string, role: TeamMemberEntity['role'] = 'MEMBER'): Promise<TeamMemberEntity> {
    const [row] = await this.db.insert(schema.teamMembers).values({
      teamId,
      userId,
      role,
    }).onConflictDoUpdate({
      target: [schema.teamMembers.teamId, schema.teamMembers.userId],
      set: { role },
    }).returning();
    return row as TeamMemberEntity;
  }

  async removeMember(teamId: string, userId: string): Promise<boolean> {
    const deleted = await this.db.delete(schema.teamMembers)
      .where(and(eq(schema.teamMembers.teamId, teamId), eq(schema.teamMembers.userId, userId)))
      .returning();
    return deleted.length > 0;
  }

  async getMembers(teamId: string): Promise<TeamMemberEntity[]> {
    const rows = await this.db.select().from(schema.teamMembers).where(eq(schema.teamMembers.teamId, teamId));
    return rows as TeamMemberEntity[];
  }

  async getUserTeamIds(userId: string): Promise<string[]> {
    const rows = await this.db.select({ teamId: schema.teamMembers.teamId })
      .from(schema.teamMembers)
      .where(eq(schema.teamMembers.userId, userId));
    return rows.map(r => r.teamId);
  }
}

export class DrizzleTrackRepository implements ITrackRepository {
  constructor(private db: TreelineDb) {}

  async create(data: Omit<TrackEntity, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<TrackEntity> {
    const [row] = await this.db.insert(schema.tracks).values(data as any).returning();
    return row as TrackEntity;
  }

  async findById(id: string): Promise<TrackEntity | null> {
    const [row] = await this.db.select().from(schema.tracks).where(eq(schema.tracks.id, id));
    return (row as TrackEntity) || null;
  }

  async list(filter?: { teamId?: string; userId?: string; includeArchived?: boolean }): Promise<TrackEntity[]> {
    let conditions = [];
    if (!filter?.includeArchived) {
      conditions.push(eq(schema.tracks.isArchived, false));
    }
    if (filter?.teamId) {
      conditions.push(eq(schema.tracks.teamId, filter.teamId));
    }
    if (filter?.userId) {
      conditions.push(eq(schema.tracks.userId, filter.userId));
    }
    const rows = await this.db.select().from(schema.tracks).where(conditions.length ? and(...conditions) : undefined);
    return rows as TrackEntity[];
  }

  async update(id: string, expectedVersion: number, data: Partial<Omit<TrackEntity, 'id' | 'version'>>): Promise<TrackEntity> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundError('Track not found');

    const [updated] = await this.db.update(schema.tracks)
      .set({
        ...data,
        version: expectedVersion + 1,
        updatedAt: new Date(),
      } as any)
      .where(and(eq(schema.tracks.id, id), eq(schema.tracks.version, expectedVersion)))
      .returning();

    if (!updated) {
      throw new OccConflictError(expectedVersion, existing.version);
    }
    return updated as TrackEntity;
  }

  async delete(id: string, permanent = false): Promise<{ deleted: boolean; archived: boolean }> {
    if (permanent) {
      const deleted = await this.db.delete(schema.tracks).where(eq(schema.tracks.id, id)).returning();
      return { deleted: deleted.length > 0, archived: false };
    }
    const [archived] = await this.db.update(schema.tracks)
      .set({ isArchived: true, archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.tracks.id, id))
      .returning();
    return { deleted: !!archived, archived: true };
  }
}

export class DrizzleWaypointRepository implements IWaypointRepository {
  constructor(private db: TreelineDb) {}

  async create(data: Omit<WaypointEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<WaypointEntity> {
    const [row] = await this.db.insert(schema.waypoints).values(data as any).returning();
    return row as WaypointEntity;
  }

  async findById(id: string): Promise<WaypointEntity | null> {
    const [row] = await this.db.select().from(schema.waypoints).where(eq(schema.waypoints.id, id));
    return (row as WaypointEntity) || null;
  }

  async list(filter?: { trackId?: string; teamId?: string }): Promise<WaypointEntity[]> {
    let conditions = [];
    if (filter?.trackId) conditions.push(eq(schema.waypoints.trackId, filter.trackId));
    if (filter?.teamId) conditions.push(eq(schema.waypoints.teamId, filter.teamId));

    const rows = await this.db.select().from(schema.waypoints)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(schema.waypoints.sequenceOrder);
    return rows as WaypointEntity[];
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db.delete(schema.waypoints).where(eq(schema.waypoints.id, id)).returning();
    return deleted.length > 0;
  }
}

export class DrizzleGeofenceRepository implements IGeofenceRepository {
  constructor(private db: TreelineDb) {}

  async create(data: Omit<GeofenceEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<GeofenceEntity> {
    const [row] = await this.db.insert(schema.geofences).values(data as any).returning();
    return row as GeofenceEntity;
  }

  async findById(id: string): Promise<GeofenceEntity | null> {
    const [row] = await this.db.select().from(schema.geofences).where(eq(schema.geofences.id, id));
    return (row as GeofenceEntity) || null;
  }

  async list(filter?: { teamId?: string; activeOnly?: boolean }): Promise<GeofenceEntity[]> {
    let conditions = [];
    if (filter?.teamId) conditions.push(eq(schema.geofences.teamId, filter.teamId));
    if (filter?.activeOnly) conditions.push(eq(schema.geofences.isActive, true));

    const rows = await this.db.select().from(schema.geofences).where(conditions.length ? and(...conditions) : undefined);
    return rows as GeofenceEntity[];
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db.delete(schema.geofences).where(eq(schema.geofences.id, id)).returning();
    return deleted.length > 0;
  }
}

export class DrizzleEmergencyRepository implements IEmergencyRepository {
  constructor(private db: TreelineDb) {}

  async create(data: Omit<EmergencyEntity, 'id' | 'acknowledgedBy' | 'createdAt' | 'updatedAt'>): Promise<EmergencyEntity> {
    const [row] = await this.db.insert(schema.emergencies).values(data as any).returning();
    return row as EmergencyEntity;
  }

  async findById(id: string): Promise<EmergencyEntity | null> {
    const [row] = await this.db.select().from(schema.emergencies).where(eq(schema.emergencies.id, id));
    return (row as EmergencyEntity) || null;
  }

  async listActive(filter?: { teamId?: string }): Promise<EmergencyEntity[]> {
    let conditions = [sql`status IN ('ACTIVE', 'ACKNOWLEDGED')`];
    if (filter?.teamId) conditions.push(eq(schema.emergencies.teamId, filter.teamId));

    const rows = await this.db.select().from(schema.emergencies)
      .where(and(...conditions))
      .orderBy(desc(schema.emergencies.createdAt));
    return rows as EmergencyEntity[];
  }

  async acknowledge(id: string, userId: string): Promise<EmergencyEntity> {
    const [row] = await this.db.update(schema.emergencies)
      .set({
        status: 'ACKNOWLEDGED',
        acknowledgedBy: sql`jsonb_set(COALESCE(acknowledged_by, '[]'::jsonb), '{999999}', to_jsonb(${userId}::text), true)`,
        updatedAt: new Date(),
      })
      .where(eq(schema.emergencies.id, id))
      .returning();
    if (!row) throw new NotFoundError('Emergency not found');
    return row as EmergencyEntity;
  }

  async resolve(id: string, resolvedBy: string, notes?: string): Promise<EmergencyEntity> {
    const [row] = await this.db.update(schema.emergencies)
      .set({
        status: 'RESOLVED',
        resolvedBy,
        resolvedAt: new Date(),
        notes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.emergencies.id, id))
      .returning();
    if (!row) throw new NotFoundError('Emergency not found');
    return row as EmergencyEntity;
  }
}

export class DrizzleMeshRepository implements IMeshRepository {
  constructor(private db: TreelineDb) {}

  async registerNode(data: Omit<MeshNodeEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<MeshNodeEntity> {
    const [row] = await this.db.insert(schema.meshNodes).values(data as any)
      .onConflictDoUpdate({
        target: schema.meshNodes.nodeNum,
        set: { ...data, updatedAt: new Date() } as any,
      })
      .returning();
    return row as MeshNodeEntity;
  }

  async findByNodeNum(nodeNum: number): Promise<MeshNodeEntity | null> {
    const [row] = await this.db.select().from(schema.meshNodes).where(eq(schema.meshNodes.nodeNum, nodeNum));
    return (row as MeshNodeEntity) || null;
  }

  async findByIdStr(nodeIdStr: string): Promise<MeshNodeEntity | null> {
    const [row] = await this.db.select().from(schema.meshNodes).where(eq(schema.meshNodes.nodeIdStr, nodeIdStr));
    return (row as MeshNodeEntity) || null;
  }

  async list(filter?: { teamId?: string; activeWithinMinutes?: number }): Promise<MeshNodeEntity[]> {
    let conditions = [];
    if (filter?.teamId) conditions.push(eq(schema.meshNodes.teamId, filter.teamId));
    if (filter?.activeWithinMinutes && filter.activeWithinMinutes > 0) {
      const threshold = new Date(Date.now() - filter.activeWithinMinutes * 60 * 1000);
      conditions.push(gte(schema.meshNodes.lastHeard, threshold));
    }
    const rows = await this.db.select().from(schema.meshNodes).where(conditions.length ? and(...conditions) : undefined);
    return rows as MeshNodeEntity[];
  }

  async updateHeartbeat(nodeNum: number, vitals: Partial<MeshNodeEntity>): Promise<MeshNodeEntity | null> {
    const [row] = await this.db.update(schema.meshNodes)
      .set({ ...vitals, lastHeard: new Date(), updatedAt: new Date() } as any)
      .where(eq(schema.meshNodes.nodeNum, nodeNum))
      .returning();
    return (row as MeshNodeEntity) || null;
  }

  async logMessage(data: Omit<LoRaMessageEntity, 'id' | 'receivedAt'>): Promise<LoRaMessageEntity> {
    const [row] = await this.db.insert(schema.loraMessages).values(data as any).returning();
    return row as LoRaMessageEntity;
  }

  async getMessages(filter?: { teamId?: string; limit?: number }): Promise<LoRaMessageEntity[]> {
    let query = this.db.select().from(schema.loraMessages);
    if (filter?.teamId) {
      query = query.where(eq(schema.loraMessages.teamId, filter.teamId)) as any;
    }
    const limit = filter?.limit || 100;
    const rows = await query.orderBy(desc(schema.loraMessages.receivedAt)).limit(limit);
    return rows as LoRaMessageEntity[];
  }
}

export class DrizzleTelemetryRepository implements ITelemetryRepository {
  constructor(private db: TreelineDb) {}

  async insertBatch(points: Omit<TelemetryPointEntity, 'id' | 'createdAt'>[]): Promise<{ inserted: number; skipped: number }> {
    if (points.length === 0) return { inserted: 0, skipped: 0 };
    await this.db.insert(schema.telemetry).values(points as any);
    return { inserted: points.length, skipped: 0 };
  }

  async queryHistory(filter: { userId?: string; teamId?: string; startTime: Date; endTime: Date; limit?: number }): Promise<TelemetryPointEntity[]> {
    let conditions = [
      gte(schema.telemetry.recordedAt, filter.startTime),
      lte(schema.telemetry.recordedAt, filter.endTime),
    ];
    if (filter.userId) conditions.push(eq(schema.telemetry.userId, filter.userId));
    if (filter.teamId) conditions.push(eq(schema.telemetry.teamId, filter.teamId));

    const limit = filter.limit || 500;
    const rows = await this.db.select().from(schema.telemetry)
      .where(and(...conditions))
      .orderBy(schema.telemetry.recordedAt)
      .limit(limit);
    return rows as TelemetryPointEntity[];
  }
}

export function createDrizzleRepositories(database: TreelineDb): IRepositories {
  return {
    users: new DrizzleUserRepository(database),
    tokens: new DrizzleTokenRepository(database),
    teams: new DrizzleTeamRepository(database),
    tracks: new DrizzleTrackRepository(database),
    waypoints: new DrizzleWaypointRepository(database),
    geofences: new DrizzleGeofenceRepository(database),
    emergencies: new DrizzleEmergencyRepository(database),
    mesh: new DrizzleMeshRepository(database),
    telemetry: new DrizzleTelemetryRepository(database),
  };
}
