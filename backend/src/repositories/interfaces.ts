/**
 * @fileoverview Domain Repository Interfaces for Treeline Tracker
 * Enables Clean Architecture with interchangeable PostgreSQL (Drizzle) and In-Memory storage engines.
 */

import { UserRole } from '../auth/rbac.js';
import { ITokenRepository } from '../auth/jwt.js';

export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  emergencyContact?: string | null;
  role: UserRole;
  publicKey?: string | null;
  keyFingerprint?: string | null;
  privacyMode: 'NORMAL' | 'REDUCED' | 'STEALTH' | 'EMERGENCY';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamEntity {
  id: string;
  name: string;
  callsign?: string | null;
  description?: string | null;
  location: string;
  distance: string;
  difficulty: string;
  createdByUserId: string;
  adminId?: string | null;
  sharedKeyId?: string | null;
  routeId?: string | null;
  startDate?: string | null;
  leaderName?: string | null;
  safeRadiusMeters: number;
  status: 'PLANNING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'EMERGENCY';
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMemberEntity {
  id: string;
  teamId: string;
  userId: string;
  role: 'LEADER' | 'GUIDE' | 'MEDIC' | 'MEMBER' | 'RESCUER';
  joinedAt: Date;
}

export interface TrackEntity {
  id: string;
  teamId?: string | null;
  userId: string;
  name: string;
  description?: string | null;
  location: string;
  difficulty: string;
  distance: string;
  distanceKm: number;
  time: string;
  type: string;
  altitude: string;
  coordinates: string;
  estimatedDurationMin?: number | null;
  elevationGainM?: number | null;
  elevationLossM?: number | null;
  trackType: 'PLANNED' | 'RECORDED' | 'RESCUE_SEARCH_CORRIDOR' | 'PATROL';
  path: [number, number, number?][];
  corridorWidthMeters: number;
  isCustom: boolean;
  isArchived: boolean;
  archivedAt?: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WaypointEntity {
  id: string;
  trackId?: string | null;
  teamId?: string | null;
  createdByUserId?: string | null;
  name: string;
  description?: string | null;
  symbol: string;
  milStd2525Code?: string | null;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  sequenceOrder: number;
  isHazard: boolean;
  hazardRadiusMeters?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeofenceEntity {
  id: string;
  teamId: string;
  name: string;
  fenceType: 'SAFETY_BUFFER' | 'EXCLUSION_ZONE' | 'HAZARD_ZONE' | 'SEARCH_SECTOR' | 'CAMP_PERIMETER';
  shapeType: 'CIRCLE' | 'POLYGON';
  centerLatitude?: number | null;
  centerLongitude?: number | null;
  radiusMeters?: number | null;
  polygonCoordinates?: [number, number][] | null;
  breachAction: 'LOG_ONLY' | 'ALERT_USER' | 'ALERT_TEAM' | 'TRIGGER_SOS';
  isActive: boolean;
  createdByUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmergencyEntity {
  id: string;
  senderId: string;
  senderName: string;
  teamId?: string | null;
  type: string;
  message: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CANCELLED';
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  accuracy?: number | null;
  batteryLevel?: number | null;
  acknowledgedBy: string[];
  resolvedBy?: string | null;
  resolvedAt?: Date | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MeshNodeEntity {
  id: string;
  nodeNum: number;
  nodeIdStr: string;
  longName?: string | null;
  shortName?: string | null;
  hwModel?: string | null;
  macAddress?: string | null;
  publicKey?: string | null;
  userId?: string | null;
  teamId?: string | null;
  role: string;
  batteryLevel?: number | null;
  voltage?: number | null;
  channelUtilization?: number | null;
  airUtilTx?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  lastHeard?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TelemetryPointEntity {
  id: string;
  userId?: string | null;
  meshNodeId?: string | null;
  teamId?: string | null;
  hikerId?: string | null;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracyM?: number | null;
  speedMps?: number | null;
  headingDeg?: number | null;
  batteryLevel?: number | null;
  transportType: 'INTERNET' | 'MESH_LORA' | 'OFFLINE_BUFFER' | 'BLE_GATEWAY';
  privacyMode: 'NORMAL' | 'REDUCED' | 'STEALTH' | 'EMERGENCY';
  isEmergency: boolean;
  rawMetadata?: any;
  recordedAt: Date;
  createdAt: Date;
}

export interface LoRaMessageEntity {
  id: string;
  packetId?: number | null;
  fromNodeId: number;
  toNodeId: number;
  channel: number;
  portnum: string;
  hopLimit: number;
  hopStart: number;
  rxSnr?: number | null;
  rxRssi?: number | null;
  senderUserId?: string | null;
  teamId?: string | null;
  payloadText?: string | null;
  isEncrypted: boolean;
  isEmergency: boolean;
  deliveryStatus: string;
  sentAt?: Date | null;
  receivedAt: Date;
}

// ----------------------------------------------------------------------------
// Repository Interfaces
// ----------------------------------------------------------------------------

export interface IUserRepository {
  create(data: Omit<UserEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserEntity>;
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  update(id: string, data: Partial<UserEntity>): Promise<UserEntity | null>;
}

export interface ITeamRepository {
  create(data: Omit<TeamEntity, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<TeamEntity>;
  findById(id: string): Promise<TeamEntity | null>;
  list(filter?: { status?: string; userId?: string }): Promise<TeamEntity[]>;
  update(id: string, expectedVersion: number, data: Partial<Omit<TeamEntity, 'id' | 'version'>>): Promise<TeamEntity>;
  delete(id: string): Promise<boolean>;
  addMember(teamId: string, userId: string, role: TeamMemberEntity['role']): Promise<TeamMemberEntity>;
  removeMember(teamId: string, userId: string): Promise<boolean>;
  getMembers(teamId: string): Promise<TeamMemberEntity[]>;
  getUserTeamIds(userId: string): Promise<string[]>;
}

export interface ITrackRepository {
  create(data: Omit<TrackEntity, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<TrackEntity>;
  findById(id: string): Promise<TrackEntity | null>;
  list(filter?: { teamId?: string; userId?: string; includeArchived?: boolean }): Promise<TrackEntity[]>;
  update(id: string, expectedVersion: number, data: Partial<Omit<TrackEntity, 'id' | 'version'>>): Promise<TrackEntity>;
  delete(id: string, permanent?: boolean): Promise<{ deleted: boolean; archived: boolean }>;
}

export interface IWaypointRepository {
  create(data: Omit<WaypointEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<WaypointEntity>;
  findById(id: string): Promise<WaypointEntity | null>;
  list(filter?: { trackId?: string; teamId?: string }): Promise<WaypointEntity[]>;
  delete(id: string): Promise<boolean>;
}

export interface IGeofenceRepository {
  create(data: Omit<GeofenceEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<GeofenceEntity>;
  findById(id: string): Promise<GeofenceEntity | null>;
  list(filter?: { teamId?: string; activeOnly?: boolean }): Promise<GeofenceEntity[]>;
  delete(id: string): Promise<boolean>;
}

export interface IEmergencyRepository {
  create(data: Omit<EmergencyEntity, 'id' | 'acknowledgedBy' | 'createdAt' | 'updatedAt'>): Promise<EmergencyEntity>;
  findById(id: string): Promise<EmergencyEntity | null>;
  listActive(filter?: { teamId?: string }): Promise<EmergencyEntity[]>;
  acknowledge(id: string, userId: string): Promise<EmergencyEntity>;
  resolve(id: string, resolvedBy: string, notes?: string): Promise<EmergencyEntity>;
}

export interface IMeshRepository {
  registerNode(data: Omit<MeshNodeEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<MeshNodeEntity>;
  findByNodeNum(nodeNum: number): Promise<MeshNodeEntity | null>;
  findByIdStr(nodeIdStr: string): Promise<MeshNodeEntity | null>;
  list(filter?: { teamId?: string; activeWithinMinutes?: number }): Promise<MeshNodeEntity[]>;
  updateHeartbeat(nodeNum: number, vitals: Partial<MeshNodeEntity>): Promise<MeshNodeEntity | null>;
  logMessage(data: Omit<LoRaMessageEntity, 'id' | 'receivedAt'>): Promise<LoRaMessageEntity>;
  getMessages(filter?: { teamId?: string; limit?: number }): Promise<LoRaMessageEntity[]>;
}

export interface ITelemetryRepository {
  insertBatch(points: Omit<TelemetryPointEntity, 'id' | 'createdAt'>[]): Promise<{ inserted: number; skipped: number }>;
  queryHistory(filter: { userId?: string; teamId?: string; startTime: Date; endTime: Date; limit?: number }): Promise<TelemetryPointEntity[]>;
}

export interface IRepositories {
  users: IUserRepository;
  tokens: ITokenRepository;
  teams: ITeamRepository;
  tracks: ITrackRepository;
  waypoints: IWaypointRepository;
  geofences: IGeofenceRepository;
  emergencies: IEmergencyRepository;
  mesh: IMeshRepository;
  telemetry: ITelemetryRepository;
}
