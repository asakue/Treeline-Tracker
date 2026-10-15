/**
 * @fileoverview Transport Layer Contracts and Interfaces
 * Conforms to FR-010 – FR-014 (TransportManager, Internet, MeshCore, OfflineQueue)
 */

import { SecurePacket } from '../domain/types';

export type PacketPriority = 'NORMAL' | 'HIGH' | 'EMERGENCY_SOS';

export interface TransportPacket {
  id: string; // Unique packet UUID
  type: 'LOCATION_UPDATE' | 'SOS_ALERT' | 'CHAT_MESSAGE' | 'GROUP_SYNC' | 'ROUTE_SYNC';
  timestamp: number;
  priority: PacketPriority;
  securePacket?: SecurePacket;
  payload: Record<string, unknown>;
  retryCount?: number;
  createdAt: number;
}

export interface ITransport {
  name: string;
  isAvailable(): Promise<boolean> | boolean;
  send(packet: TransportPacket): Promise<{ success: boolean; error?: string; latencyMs?: number }>;
}

export interface TransportStatus {
  activeChannel: 'INTERNET' | 'MESH_CORE' | 'OFFLINE_QUEUE';
  isInternetOnline: boolean;
  isMeshOnline: boolean;
  queuedCount: number;
  totalPacketsSent: number;
  totalPacketsDropped: number;
  lastTransmissionTimestamp?: number;
  meshSignalDbm?: number; // Simulated RSSI (e.g. -78 dBm)
}
