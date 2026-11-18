/**
 * Meshtastic Protocol Types & Wire Enums
 * Pure TypeScript, zero external dependencies.
 */

export enum PortNum {
  UNKNOWN_APP = 0,
  TEXT_MESSAGE_APP = 1,
  REMOTE_HARDWARE_APP = 2,
  POSITION_APP = 3,
  NODEINFO_APP = 4,
  ROUTING_APP = 5,
  ADMIN_APP = 6,
  TEXT_MESSAGE_COMPRESSED_APP = 7,
  WAYPOINT_APP = 8,
  AUDIO_APP = 9,
  DETECTION_SENSOR_APP = 10,
  REPLY_APP = 32,
  IP_TUNNEL_APP = 33,
  PAXCOUNTER_APP = 34,
  STORE_FORWARD_PLUSPLUS_APP = 35,
  NODE_STATUS_APP = 36,
  MESH_BEACON_APP = 37,
  PAGING_APP = 38,
  SERIAL_APP = 64,
  STORE_FORWARD_APP = 65,
  RANGE_TEST_APP = 66,
  TELEMETRY_APP = 67,
  ZPS_APP = 68,
  SIMULATOR_APP = 69,
  TRACEROUTE_APP = 70,
  NEIGHBORINFO_APP = 71,
  ATAK_PLUGIN = 72,
  MAP_REPORT_APP = 73,
  POWERSTRESS_APP = 74,
  PRIVATE_APP = 256,
  ATAK_FORWARDER = 257,
  MAX = 511
}

export enum PacketPriority {
  UNSET = 0,
  MIN = 1,
  BACKGROUND = 10,
  DEFAULT = 64,
  RELIABLE = 70,
  RESPONSE = 80,
  HIGH = 100,
  ALERT = 110,
  ACK = 120,
  MAX = 127
}

export enum LocationSource {
  LOC_UNSET = 0,
  LOC_MANUAL = 1,
  LOC_INTERNAL = 2,
  LOC_EXTERNAL = 3
}

export const NODENUM_BROADCAST = 0xffffffff;

export interface PositionMessage {
  latitude_i: number;        // sfixed32: degrees * 1e7
  longitude_i: number;       // sfixed32: degrees * 1e7
  altitude?: number;         // int32: meters MSL
  time?: number;             // fixed32: epoch seconds
  location_source?: LocationSource;
  timestamp?: number;        // fixed32: fix epoch seconds
  gps_accuracy?: number;     // uint32: mm/cm
  ground_speed?: number;     // uint32: m/s
  ground_track?: number;     // uint32: degrees * 1e5
  sats_in_view?: number;     // uint32
  precision_bits?: number;   // uint32
}

export interface DeviceMetrics {
  battery_level?: number;         // uint32: 0 - 100%
  voltage?: number;               // float: Volts
  channel_utilization?: number;   // float: %
  air_util_tx?: number;           // float: %
  uptime_seconds?: number;        // uint32: seconds
}

export interface EnvironmentMetrics {
  temperature?: number;           // float: Celsius
  relative_humidity?: number;     // float: %
  barometric_pressure?: number;   // float: hPa
  gas_resistance?: number;        // float: Ohms
  iaq?: number;                   // uint32: 0 - 500
}

export interface TelemetryMessage {
  time?: number;                  // fixed32: epoch seconds
  device_metrics?: DeviceMetrics;
  environment_metrics?: EnvironmentMetrics;
}

export interface UserMessage {
  id: string;                     // "!28a4c1f0"
  long_name: string;              // "Alex Explorer"
  short_name: string;             // "ALEX"
  macaddr?: Uint8Array;
  hw_model?: string;
  role?: string;
  public_key?: Uint8Array;
}

export interface NodeInfoMessage {
  num: number;                    // uint32 node ID
  user?: UserMessage;
  position?: PositionMessage;
  snr?: number;
  last_heard?: number;            // epoch seconds
  device_metrics?: DeviceMetrics;
  channel?: number;
  via_mqtt?: boolean;
  hops_away?: number;
}

export interface WaypointMessage {
  id: number;                     // uint32
  latitude_i?: number;            // sfixed32
  longitude_i?: number;           // sfixed32
  expire?: number;                // epoch seconds
  locked_to?: number;             // node ID if locked
  name: string;                   // max 30 chars
  description?: string;           // max 100 chars
  icon?: number;                  // Unicode emoji codepoint
}

export interface DataPayload {
  portnum: PortNum;
  payload: Uint8Array;
  want_response?: boolean;
  dest?: number;
  source?: number;
  request_id?: number;
  reply_id?: number;
  emoji?: number;
}

export interface MeshPacket {
  from: number;                   // fixed32
  to: number;                     // fixed32 (0xFFFFFFFF = broadcast)
  channel: number;                // uint32 (0-7)
  decoded?: DataPayload;          // unencrypted / unpacked
  encrypted?: Uint8Array;         // ciphertext
  id: number;                     // fixed32
  rx_time?: number;               // fixed32
  rx_snr?: number;                // float
  hop_limit: number;              // uint32
  want_ack: boolean;              // bool
  priority: PacketPriority;       // enum
  rx_rssi?: number;               // int32 dBm
  hop_start?: number;             // uint32
  pki_encrypted?: boolean;        // bool
}

export interface ToRadio {
  packet?: MeshPacket;
  want_config_id?: number;
  disconnect?: boolean;
}

export interface MyNodeInfo {
  my_node_num: number;
  reboot_count?: number;
  has_gps?: boolean;
}

export interface FromRadio {
  id: number;
  packet?: MeshPacket;
  my_info?: MyNodeInfo;
  node_info?: NodeInfoMessage;
  config_complete_id?: number;
  rebooted?: boolean;
}

export interface ServiceEnvelope {
  packet: MeshPacket;
  channel_id: string;
  gateway_id: string;
}
