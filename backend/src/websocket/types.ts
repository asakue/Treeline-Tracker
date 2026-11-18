/**
 * @fileoverview WebSocket Interface Types for Treeline Tracker
 * Conforms to PROJECT.md § Interface Contract 2 & Feature Inventory 8
 */

export type RoomName =
  | `team:${string}`
  | 'emergency:broadcast'
  | `mesh:channel:${number}`
  | 'mesh:nodes'
  | `user:${string}`;

export interface MeshPacketDTO {
  from: number;              // 32-bit Meshtastic node ID integer
  to: number;                // 32-bit node ID (0xFFFFFFFF = broadcast)
  channel: number;           // Channel index (0-7)
  id: number;                // Packet sequence ID
  rxTime?: number;           // Unix epoch seconds
  rxSnr?: number;            // SNR in dB
  rxRssi?: number;           // RSSI in dBm
  hopLimit?: number;         // Remaining hops
  wantAck?: boolean;         // Acknowledgment requested
  priority: number | 'ALERT' | 'DEFAULT' | 'BACKGROUND';
  portnum: number | string;  // e.g. TEXT_MESSAGE_APP (1), POSITION_APP (3), etc.
  payload: string | Record<string, unknown>; // Base64 raw bytes or decoded object
}

// ----------------------------------------------------------------------------
// INBOUND CLIENT FRAMES (Client -> Server)
// ----------------------------------------------------------------------------

export interface AuthInboundFrame {
  type: 'AUTH';
  token: string;
}

export interface SubscribeInboundFrame {
  type: 'SUBSCRIBE';
  channels: string[];
}

export interface UnsubscribeInboundFrame {
  type: 'UNSUBSCRIBE';
  channels: string[];
}

export interface SendMeshPacketInboundFrame {
  type: 'SEND_MESH_PACKET';
  packet: MeshPacketDTO;
}

export interface SendChatInboundFrame {
  type: 'SEND_CHAT';
  channelId: string;         // Team ID or Channel ID
  text: string;
  recipientNodeNum?: number; // Optional direct node target
}

export interface SendTelemetryInboundFrame {
  type: 'SEND_TELEMETRY';
  latitude: number;
  longitude: number;
  altitude?: number;
  battery?: number;
  speed?: number;
  heading?: number;
}

export interface SendSosInboundFrame {
  type: 'SEND_SOS';
  emergencyType: string;     // 'SOS_SIGNAL' | 'MEDICAL_EMERGENCY' | 'LOST_PERSON' | etc.
  latitude: number;
  longitude: number;
  notes?: string;
  altitude?: number;
}

export interface PingInboundFrame {
  type: 'PING';
}

export type InboundWsFrame =
  | AuthInboundFrame
  | SubscribeInboundFrame
  | UnsubscribeInboundFrame
  | SendMeshPacketInboundFrame
  | SendChatInboundFrame
  | SendTelemetryInboundFrame
  | SendSosInboundFrame
  | PingInboundFrame;

// ----------------------------------------------------------------------------
// OUTBOUND SERVER FRAMES (Server -> Client)
// ----------------------------------------------------------------------------

export interface MeshPacketReceivedOutboundFrame {
  type: 'MESH_PACKET_RECEIVED';
  packet: MeshPacketDTO;
  rssi?: number;
  snr?: number;
}

export interface TelemetryBroadcastOutboundFrame {
  type: 'TELEMETRY_BROADCAST';
  userId: string;
  nodeNum?: number;
  coords: [number, number];   // [lat, lng]
  altitude?: number;
  battery: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

export interface EmergencyAlertOutboundFrame {
  type: 'EMERGENCY_ALERT';
  emergencyId: string;
  sender: string;             // User display name or callsign
  senderId?: string;          // User UUID
  location: [number, number]; // [lat, lng]
  emergencyType?: string;
  notes?: string;
  timestamp: number;
  priority: 'ALERT';
}

export interface NodeStatusUpdateOutboundFrame {
  type: 'NODE_STATUS_UPDATE';
  nodeNum: number;
  shortName: string;
  longName?: string;
  battery: number;
  voltage?: number;
  lastHeard: number;
  role?: string;
}

export interface AuthSuccessOutboundFrame {
  type: 'AUTH_SUCCESS';
  userId: string;
  role: string;
  displayName: string;
  teams: string[];
}

export interface SubscribedAckOutboundFrame {
  type: 'SUBSCRIBED';
  channels: string[];
}

export interface UnsubscribedAckOutboundFrame {
  type: 'UNSUBSCRIBED';
  channels: string[];
}

export interface SosAckOutboundFrame {
  type: 'SOS_ACK';
  emergencyId: string;
  status: 'BROADCAST_ACTIVE';
  dispatchedAt: number;
}

export interface RateLimitExceededOutboundFrame {
  type: 'RATE_LIMIT_EXCEEDED';
  message: string;
  retryAfterMs: number;
}

export interface ErrorOutboundFrame {
  type: 'ERROR';
  code: string;
  message: string;
}

export interface PongOutboundFrame {
  type: 'PONG';
  timestamp: number;
}

export type OutboundWsFrame =
  | MeshPacketReceivedOutboundFrame
  | TelemetryBroadcastOutboundFrame
  | EmergencyAlertOutboundFrame
  | NodeStatusUpdateOutboundFrame
  | AuthSuccessOutboundFrame
  | SubscribedAckOutboundFrame
  | UnsubscribedAckOutboundFrame
  | SosAckOutboundFrame
  | RateLimitExceededOutboundFrame
  | ErrorOutboundFrame
  | PongOutboundFrame;

// ----------------------------------------------------------------------------
// SESSION & REGISTRY INTERFACES
// ----------------------------------------------------------------------------

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'hiker' | 'guide' | 'rescuer' | 'admin' | string;
  displayName: string;
  teams: string[];
  nodeNum?: number;
}

export interface WebSocketLike {
  readyState: number;
  send(data: string | Buffer | Uint8Array, cb?: (err?: Error) => void): void;
  close(code?: number, data?: string): void;
  terminate?(): void;
  ping?(): void;
  on(event: string, listener: (...args: any[]) => void): this;
  removeListener?(event: string, listener: (...args: any[]) => void): this;
}

export interface ClientSession {
  sessionId: string;
  socket: WebSocketLike;
  ip: string;
  isAuthenticated: boolean;
  user?: AuthenticatedUser;
  authTimer?: any;
  connectedAt: number;
  lastActivity: number;
  isAlive: boolean;
  rateLimitBucket: {
    chatCount: number[];
    telemetryCount: number[];
    meshCount: number[];
  };
}
