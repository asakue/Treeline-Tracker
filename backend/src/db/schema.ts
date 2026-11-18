/**
 * @fileoverview Treeline Tracker - Production Drizzle ORM Schema (PostgreSQL 16 + PostGIS)
 * Conforms to Milestone 1 Architecture Specification
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  doublePrecision,
  jsonb,
  bigint,
  customType,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ----------------------------------------------------------------------------
// Custom PostGIS Geometry Type
// ----------------------------------------------------------------------------
export const geometry = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'geometry';
  },
});

// ----------------------------------------------------------------------------
// 1. Users Table
// ----------------------------------------------------------------------------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  phone: text('phone'),
  emergencyContact: text('emergency_contact'),
  role: text('role', { enum: ['hiker', 'guide', 'rescuer', 'admin'] }).notNull().default('hiker'),
  publicKey: text('public_key'),
  keyFingerprint: text('key_fingerprint'),
  privacyMode: text('privacy_mode', { enum: ['NORMAL', 'REDUCED', 'STEALTH', 'EMERGENCY'] }).notNull().default('NORMAL'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_users_email').on(table.email),
  index('idx_users_role').on(table.role),
]);

// ----------------------------------------------------------------------------
// 2. User Tokens Table (JWT Refresh Token Rotation & Session Revocation)
// ----------------------------------------------------------------------------
export const userTokens = pgTable('user_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  familyId: uuid('family_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  deviceInfo: text('device_info'),
  ipAddress: text('ip_address'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_user_tokens_user_id').on(table.userId),
  index('idx_user_tokens_family_id').on(table.familyId),
  index('idx_user_tokens_hash').on(table.tokenHash),
]);

// ----------------------------------------------------------------------------
// 3. Teams Table (Expedition Squads)
// ----------------------------------------------------------------------------
export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  callsign: text('callsign'),
  description: text('description'),
  location: text('location').notNull().default(''),
  distance: text('distance').notNull().default('0 км'),
  difficulty: text('difficulty').notNull().default('Средне'),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  adminId: uuid('admin_id').references(() => users.id, { onDelete: 'set null' }),
  sharedKeyId: text('shared_key_id'),
  routeId: uuid('route_id'),
  startDate: text('start_date'),
  leaderName: text('leader_name'),
  safeRadiusMeters: doublePrecision('safe_radius_meters').notNull().default(500.0),
  status: text('status', { enum: ['PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'EMERGENCY'] }).notNull().default('ACTIVE'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_teams_created_by').on(table.createdByUserId),
  index('idx_teams_status').on(table.status),
]);

// ----------------------------------------------------------------------------
// 4. Team Members Table
// ----------------------------------------------------------------------------
export const teamMembers = pgTable('team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['LEADER', 'GUIDE', 'MEDIC', 'MEMBER', 'RESCUER'] }).notNull().default('MEMBER'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_team_members_team').on(table.teamId),
  index('idx_team_members_user').on(table.userId),
  uniqueIndex('uq_team_member').on(table.teamId, table.userId),
]);

// ----------------------------------------------------------------------------
// 5. Tracks Table (Planned Routes & Recorded Paths)
// ----------------------------------------------------------------------------
export const tracks = pgTable('tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  description: text('description'),
  location: text('location').notNull().default(''),
  difficulty: text('difficulty').notNull().default('Средне'),
  distance: text('distance').notNull().default('0 км'),
  distanceKm: doublePrecision('distance_km').notNull().default(0.0),
  time: text('time').notNull().default('1 ч'),
  type: text('type').notNull().default('Пеший'),
  altitude: text('altitude').notNull().default('0 м'),
  coordinates: text('coordinates').notNull().default(''),
  estimatedDurationMin: integer('estimated_duration_min').default(0),
  elevationGainM: doublePrecision('elevation_gain_m').default(0.0),
  elevationLossM: doublePrecision('elevation_loss_m').default(0.0),
  trackType: text('track_type', { enum: ['PLANNED', 'RECORDED', 'RESCUE_SEARCH_CORRIDOR', 'PATROL'] }).notNull().default('PLANNED'),
  path: jsonb('path').notNull().default('[]'),
  pathGeom: geometry('path_geom'),
  corridorWidthMeters: doublePrecision('corridor_width_meters').notNull().default(50.0),
  isCustom: boolean('is_custom').notNull().default(false),
  isArchived: boolean('is_archived').notNull().default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_tracks_user').on(table.userId),
  index('idx_tracks_team').on(table.teamId),
  index('idx_tracks_archived').on(table.isArchived),
]);

// ----------------------------------------------------------------------------
// 6. Waypoints Table
// ----------------------------------------------------------------------------
export const waypoints = pgTable('waypoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  trackId: uuid('track_id').references(() => tracks.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  description: text('description'),
  symbol: text('symbol').notNull().default('WAYPOINT'),
  milStd2525Code: text('mil_std_2525_code'),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  altitude: doublePrecision('altitude'),
  geom: geometry('geom'),
  sequenceOrder: integer('sequence_order').notNull().default(0),
  isHazard: boolean('is_hazard').notNull().default(false),
  hazardRadiusMeters: doublePrecision('hazard_radius_meters').default(0.0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_waypoints_track').on(table.trackId),
  index('idx_waypoints_team').on(table.teamId),
]);

// ----------------------------------------------------------------------------
// 7. Geofences Table
// ----------------------------------------------------------------------------
export const geofences = pgTable('geofences', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  fenceType: text('fence_type', {
    enum: ['SAFETY_BUFFER', 'EXCLUSION_ZONE', 'HAZARD_ZONE', 'SEARCH_SECTOR', 'CAMP_PERIMETER']
  }).notNull().default('SAFETY_BUFFER'),
  shapeType: text('shape_type', { enum: ['CIRCLE', 'POLYGON'] }).notNull().default('CIRCLE'),
  centerLatitude: doublePrecision('center_latitude'),
  centerLongitude: doublePrecision('center_longitude'),
  radiusMeters: doublePrecision('radius_meters'),
  polygonCoordinates: jsonb('polygon_coordinates'),
  geom: geometry('geom'),
  breachAction: text('breach_action', {
    enum: ['LOG_ONLY', 'ALERT_USER', 'ALERT_TEAM', 'TRIGGER_SOS']
  }).notNull().default('ALERT_TEAM'),
  isActive: boolean('is_active').notNull().default(true),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_geofences_team').on(table.teamId),
]);

// ----------------------------------------------------------------------------
// 8. Emergencies Table
// ----------------------------------------------------------------------------
export const emergencies = pgTable('emergencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderId: text('sender_id').notNull(),
  senderName: text('sender_name').notNull(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  type: text('type').notNull().default('SOS_SIGNAL'),
  message: text('message').notNull(),
  status: text('status', { enum: ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED'] }).notNull().default('ACTIVE'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  altitude: doublePrecision('altitude'),
  accuracy: doublePrecision('accuracy'),
  geom: geometry('geom'),
  batteryLevel: integer('battery_level'),
  acknowledgedBy: jsonb('acknowledged_by').notNull().default('[]'),
  resolvedBy: text('resolved_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_emergencies_status').on(table.status),
  index('idx_emergencies_team').on(table.teamId),
]);

// ----------------------------------------------------------------------------
// 9. Mesh Nodes Table
// ----------------------------------------------------------------------------
export const meshNodes = pgTable('mesh_nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  nodeNum: bigint('node_num', { mode: 'number' }).notNull().unique(),
  nodeIdStr: text('node_id_str').notNull().unique(),
  longName: text('long_name'),
  shortName: text('short_name'),
  hwModel: text('hw_model'),
  macAddress: text('mac_address'),
  publicKey: text('public_key'),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  role: text('role').notNull().default('ROUTER_CLIENT'),
  batteryLevel: integer('battery_level'),
  voltage: doublePrecision('voltage'),
  channelUtilization: doublePrecision('channel_utilization'),
  airUtilTx: doublePrecision('air_util_tx'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  altitude: doublePrecision('altitude'),
  geom: geometry('geom'),
  lastHeard: timestamp('last_heard', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_mesh_nodes_node_num').on(table.nodeNum),
  index('idx_mesh_nodes_id_str').on(table.nodeIdStr),
  index('idx_mesh_nodes_team').on(table.teamId),
]);

// ----------------------------------------------------------------------------
// 10. Telemetry Table
// ----------------------------------------------------------------------------
export const telemetry = pgTable('telemetry', {
  id: uuid('id').defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  meshNodeId: uuid('mesh_node_id').references(() => meshNodes.id, { onDelete: 'set null' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  hikerId: text('hiker_id'),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  altitude: doublePrecision('altitude'),
  accuracyM: doublePrecision('accuracy_m'),
  speedMps: doublePrecision('speed_mps'),
  headingDeg: doublePrecision('heading_deg'),
  batteryLevel: integer('battery_level'),
  transportType: text('transport_type', {
    enum: ['INTERNET', 'MESH_LORA', 'OFFLINE_BUFFER', 'BLE_GATEWAY']
  }).notNull().default('INTERNET'),
  privacyMode: text('privacy_mode', {
    enum: ['NORMAL', 'REDUCED', 'STEALTH', 'EMERGENCY']
  }).notNull().default('NORMAL'),
  isEmergency: boolean('is_emergency').notNull().default(false),
  rawMetadata: jsonb('raw_metadata').default('{}'),
  geom: geometry('geom'),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_telemetry_user_time').on(table.userId, table.recordedAt),
  index('idx_telemetry_team_time').on(table.teamId, table.recordedAt),
  index('idx_telemetry_node_time').on(table.meshNodeId, table.recordedAt),
]);

// ----------------------------------------------------------------------------
// 11. LoRa Messages Table
// ----------------------------------------------------------------------------
export const loraMessages = pgTable('lora_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  packetId: bigint('packet_id', { mode: 'number' }),
  fromNodeId: bigint('from_node_id', { mode: 'number' }).notNull(),
  toNodeId: bigint('to_node_id', { mode: 'number' }).notNull(),
  channel: integer('channel').notNull().default(0),
  portnum: text('portnum').notNull().default('TEXT_MESSAGE_APP'),
  hopLimit: integer('hop_limit').notNull().default(3),
  hopStart: integer('hop_start').notNull().default(3),
  rxSnr: doublePrecision('rx_snr'),
  rxRssi: integer('rx_rssi'),
  senderUserId: uuid('sender_user_id').references(() => users.id, { onDelete: 'set null' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  payloadText: text('payload_text'),
  isEncrypted: boolean('is_encrypted').notNull().default(false),
  isEmergency: boolean('is_emergency').notNull().default(false),
  deliveryStatus: text('delivery_status').notNull().default('RECEIVED'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_lora_messages_from').on(table.fromNodeId),
  index('idx_lora_messages_to').on(table.toNodeId),
  index('idx_lora_messages_team').on(table.teamId),
  index('idx_lora_messages_received').on(table.receivedAt),
]);

// ----------------------------------------------------------------------------
// Relations Definitions
// ----------------------------------------------------------------------------
export const usersRelations = relations(users, ({ many }) => ({
  tokens: many(userTokens),
  teamMemberships: many(teamMembers),
  createdTeams: many(teams, { relationName: 'creator' }),
  createdTracks: many(tracks),
  meshNodes: many(meshNodes),
  telemetryEntries: many(telemetry),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  creator: one(users, {
    fields: [teams.createdByUserId],
    references: [users.id],
    relationName: 'creator',
  }),
  members: many(teamMembers),
  tracks: many(tracks),
  waypoints: many(waypoints),
  geofences: many(geofences),
  emergencies: many(emergencies),
  meshNodes: many(meshNodes),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

export const tracksRelations = relations(tracks, ({ one, many }) => ({
  team: one(teams, {
    fields: [tracks.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [tracks.userId],
    references: [users.id],
  }),
  waypoints: many(waypoints),
}));

export const waypointsRelations = relations(waypoints, ({ one }) => ({
  track: one(tracks, {
    fields: [waypoints.trackId],
    references: [tracks.id],
  }),
  team: one(teams, {
    fields: [waypoints.teamId],
    references: [teams.id],
  }),
}));

export const emergenciesRelations = relations(emergencies, ({ one }) => ({
  team: one(teams, {
    fields: [emergencies.teamId],
    references: [teams.id],
  }),
}));

export const meshNodesRelations = relations(meshNodes, ({ one }) => ({
  user: one(users, {
    fields: [meshNodes.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [meshNodes.teamId],
    references: [teams.id],
  }),
}));
