/**
 * @fileoverview Zod Validation Schemas for Core Domain
 * Guarantees schema validation across all inputs, storage, and network boundaries
 */

import { z } from 'zod';

export const PrivacyModeSchema = z.enum(['NORMAL', 'REDUCED', 'STEALTH']);

export const TransportTypeSchema = z.enum(['INTERNET', 'MESH_CORE', 'OFFLINE_BUFFER']);

export const MemberStatusSchema = z.enum(['На тропе', 'На воде', 'В лагере', 'SOS', 'Оффлайн']);

export const RouteDifficultySchema = z.enum(['Легко', 'Средне', 'Сложно', 'Очень сложно']);

export const GeoPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().optional(),
});

export const LocationUpdateSchema = z.object({
  hikerId: z.string().min(1),
  timestamp: z.number().positive(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().optional(),
  accuracy: z.number().nonnegative().optional(),
  speed: z.number().nonnegative().optional(),
  heading: z.number().min(0).max(360).optional(),
  batteryLevel: z.number().min(0).max(100).optional(),
  privacyMode: PrivacyModeSchema.default('NORMAL'),
});

export const MemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  avatar: z.string(),
  role: z.enum(['LEADER', 'GUIDE', 'MEMBER', 'MEDIC']).optional(),
  status: MemberStatusSchema,
  battery: z.number().min(0).max(100),
  coords: z.string(),
  lastLocation: LocationUpdateSchema.optional(),
  lastUpdate: z.string(),
  lastUpdateTimestamp: z.number().default(() => Date.now()),
  publicKey: z.string().optional(),
});

export const GroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  location: z.string().min(1),
  distance: z.string(),
  difficulty: RouteDifficultySchema,
  hikers: z.array(MemberSchema),
  routeId: z.string().optional(),
  sharedKeyId: z.string().optional(),
  adminId: z.string().optional(),
  createdAt: z.number().optional(),
});

export const RouteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  location: z.string().min(1),
  difficulty: RouteDifficultySchema,
  distance: z.string(),
  time: z.string(),
  type: z.string(),
  altitude: z.string(),
  coordinates: z.string(),
  path: z.array(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])),
  isCustom: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  archivedAt: z.number().optional(),
  createdAt: z.number().optional(),
});

export const EmergencyEventSchema = z.object({
  id: z.string().min(1),
  senderId: z.string().min(1),
  senderName: z.string().min(1),
  timestamp: z.number().positive(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    altitude: z.number().optional(),
    accuracy: z.number().nonnegative().optional(),
  }),
  type: z.enum(['SOS_SIGNAL', 'MEDICAL_EMERGENCY', 'LOST_PERSON', 'GEAR_FAILURE', 'WEATHER_HAZARD']),
  message: z.string(),
  status: z.enum(['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED']).default('ACTIVE'),
  batteryLevel: z.number().min(0).max(100).optional(),
  acknowledgedBy: z.array(z.string()).default([]),
});

export const SecurePacketSchema = z.object({
  version: z.number().int().positive(),
  packetId: z.string().uuid(),
  senderPublicKey: z.string().min(32),
  recipientOrGroupId: z.string().min(1),
  timestamp: z.number().positive(),
  sequenceNumber: z.number().int().nonnegative(),
  privacyMode: PrivacyModeSchema,
  payloadCiphertext: z.string().min(1),
  iv: z.string().min(12),
  authTag: z.string().min(16),
  signature: z.string().min(32),
});

export const UserIdentitySchema = z.object({
  userId: z.string().min(1),
  publicKey: z.string().min(16),
  privateKey: z.string().optional(),
  displayName: z.string().min(1),
  createdAt: z.number().positive(),
});

