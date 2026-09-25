/**
 * @fileoverview Core Domain Entities and Value Objects
 * Conforms to Architectural Decision Records (ADR 001 - ADR 009)
 * and System Security Model (docs/04-security/threat-model.md)
 */

export type PrivacyMode = 'NORMAL' | 'REDUCED' | 'STEALTH';

export type TransportType = 'INTERNET' | 'MESH_CORE' | 'OFFLINE_BUFFER';

export type MemberStatus = 'На тропе' | 'На воде' | 'В лагере' | 'SOS' | 'Оффлайн';

export type RouteDifficulty = 'Легко' | 'Средне' | 'Сложно' | 'Очень сложно';

export interface GeoPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
}

export interface LocationUpdate {
  hikerId: string;
  timestamp: number; // Unix epoch ms
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number; // meters
  speed?: number; // m/s
  heading?: number; // degrees 0..360
  batteryLevel?: number; // 0..100%
  privacyMode: PrivacyMode;
}

export interface Member {
  id: string;
  name: string;
  avatar: string;
  role?: 'LEADER' | 'GUIDE' | 'MEMBER' | 'MEDIC';
  status: MemberStatus;
  battery: number;
  coords: string; // Formatted coordinate string (e.g. "43.3550° с.ш., 42.4392° в.д.")
  lastLocation?: LocationUpdate;
  lastUpdate: string; // Human readable (e.g. "2 минуты назад")
  lastUpdateTimestamp: number; // Unix epoch ms
  publicKey?: string; // Ed25519 public key hex string
  isVerified?: boolean;
  keyFingerprint?: string;
  privacyMode?: PrivacyMode;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  location: string;
  distance: string;
  difficulty: RouteDifficulty;
  hikers: Member[];
  routeId?: string;
  sharedKeyId?: string;
  adminId?: string;
  createdAt?: number;
}

export interface Route {
  id: string;
  name: string;
  location: string;
  difficulty: RouteDifficulty;
  distance: string;
  time: string;
  type: string;
  altitude: string;
  coordinates: string;
  path: [number, number][]; // [latitude, longitude][]
  isCustom?: boolean;
  isArchived?: boolean;
  archivedAt?: number;
  createdAt?: number;
}

export interface EmergencyEvent {
  id: string;
  senderId: string;
  senderName: string;
  timestamp: number; // Unix epoch ms
  location: {
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracy?: number;
  };
  type: 'SOS_SIGNAL' | 'MEDICAL_EMERGENCY' | 'LOST_PERSON' | 'GEAR_FAILURE' | 'WEATHER_HAZARD';
  message: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  batteryLevel?: number;
  acknowledgedBy: string[];
}

export interface SecurePacket {
  version: number;
  packetId: string;
  senderPublicKey: string;
  recipientOrGroupId: string;
  timestamp: number;
  sequenceNumber: number;
  privacyMode: PrivacyMode;
  payloadCiphertext: string; // Base64 or Hex encoded AES-GCM ciphertext
  iv: string; // 12-byte initialization vector Base64/Hex
  authTag: string; // 16-byte authentication tag Base64/Hex
  signature: string; // 64-byte Ed25519 signature of the header + ciphertext
}

export interface UserIdentity {
  userId: string;
  publicKey: string; // Ed25519 public key in Base64 or Hex
  privateKey?: string; // PKCS#8 or raw private key (only stored in secure local state)
  displayName: string;
  createdAt: number;
}

