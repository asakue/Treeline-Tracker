/**
 * Common Transport Interface and Types for LoRa Mesh Transports
 */

import { MeshPacket } from '../protobuf/types';

export type MeshTransportStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'ERROR';

export interface DeliveryResult {
  success: boolean;
  packetId?: number;
  error?: string;
  latencyMs?: number;
}

export type PacketHandler = (packet: MeshPacket) => void;
export type StatusHandler = (status: MeshTransportStatus) => void;

export interface ILoRaMeshTransport {
  readonly name: string;
  readonly transportType: 'serial' | 'bluetooth' | 'mqtt' | 'mock';

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): MeshTransportStatus;

  sendPacket(packet: MeshPacket): Promise<DeliveryResult>;
  onPacket(handler: PacketHandler): () => void;
  onStatusChange?(handler: StatusHandler): () => void;
}
