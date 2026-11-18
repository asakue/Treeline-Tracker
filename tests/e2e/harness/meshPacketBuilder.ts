/**
 * Pure TypeScript Meshtastic Protobuf Wire Codec & Hardware Transports Framing
 * Treeline Tracker E2E Test Suite - Opaque-box Test Harness
 * 
 * Implements:
 * - Pure TypeScript Protobuf binary encoding/decoding (varint, zigzag, fixed32/64, length-delimited)
 * - Meshtastic proto models: MeshPacket, Data, Position, NodeInfo/User, Telemetry, Waypoint
 * - WebSerial streaming FSM framing (magic bytes 0x94 0xC3, length <= 512)
 * - Mock WebBluetooth GATT Transport
 * - Mock MQTT Bridge Transport
 */

export enum PortNum {
  UNKNOWN_APP = 0,
  TEXT_MESSAGE_APP = 1,
  REMOTE_HARDWARE_APP = 2,
  POSITION_APP = 3,
  NODEINFO_APP = 4,
  ROUTING_APP = 5,
  ADMIN_APP = 6,
  TEXT_MESSAGE_COMPACT_APP = 7,
  WAYPOINT_APP = 8,
  AUDIO_APP = 9,
  DETECTION_SENSOR_APP = 10,
  REPLY_APP = 32,
  IP_TUNNEL_APP = 33,
  PAXCOUNTER_APP = 34,
  SERIAL_APP = 64,
  STORE_FORWARD_APP = 65,
  RANGE_TEST_APP = 66,
  TELEMETRY_APP = 67,
  ZPS_APP = 68,
  SIMULATOR_APP = 69,
  TRACEROUTE_APP = 70,
  NEIGHBORINFO_APP = 71,
  ALERT_APP = 100,
  PRIVATE_APP = 256,
  ATAK_PLUGIN = 257,
  MAX = 511,
}

export enum MeshPriority {
  UNSET = 0,
  MIN = 1,
  BACKGROUND = 10,
  DEFAULT = 64,
  RELIABLE = 70,
  ALERT = 110,
  ACK = 120,
  MAX = 127,
}

export enum HardwareModel {
  UNSET = 0,
  TLORA_V2 = 1,
  TLORA_V1 = 2,
  TLORA_V2_1_1P6 = 3,
  T_BEAM = 4,
  HELTEC_V2_0 = 5,
  T_ECHO = 6,
  TLORA_V1_1P3 = 7,
  RAK4631 = 8,
  HELTEC_V2_1 = 9,
  HELTEC_V1 = 10,
  LILYGO_TBEAM_S3_CORE = 11,
  RAK11200 = 12,
  NANO_G1 = 13,
  TLORA_V2_1_1P8 = 14,
  TLORA_T3_S3 = 15,
  NANO_G1_EXPLORER = 16,
  NANO_G2_ULTRA = 17,
  STATION_G1 = 25,
  RAK11310 = 26,
  SENSECAP_INDICATOR = 27,
  TRACKER_T1000_E = 28,
  PRIVATE_HW = 255,
}

export interface PositionMessage {
  latitude_i: number; // sfixed32
  longitude_i: number; // sfixed32
  altitude?: number; // int32
  time?: number; // fixed32
}

export interface UserMessage {
  id: string; // "!28ab1234"
  long_name: string; // max 30 chars
  short_name: string; // max 4 chars
  macaddr?: Uint8Array;
  hw_model?: HardwareModel;
}

export interface DeviceMetrics {
  battery_level?: number; // uint32
  voltage?: number; // float
  channel_utilization?: number; // float
  air_util_tx?: number; // float
}

export interface EnvironmentMetrics {
  temperature?: number; // float
  relative_humidity?: number; // float
  barometric_pressure?: number; // float
}

export interface TelemetryMessage {
  time?: number; // fixed32
  device_metrics?: DeviceMetrics;
  environment_metrics?: EnvironmentMetrics;
}

export interface WaypointMessage {
  id: number; // uint32
  latitude_i: number; // sfixed32
  longitude_i: number; // sfixed32
  name: string;
  description?: string;
  icon?: number;
  geofence_radius?: number; // uint32 meters
}

export interface DataPayload {
  portnum: PortNum;
  payload: Uint8Array;
  want_response?: boolean;
  dest?: number;
  source?: number;
  request_id?: number;
}

export interface MeshPacketEnvelope {
  from: number;
  to: number; // 0xFFFFFFFF for broadcast
  channel?: number;
  decoded?: DataPayload;
  id: number;
  rx_time?: number;
  rx_snr?: number;
  hop_limit?: number;
  want_ack?: boolean;
  priority?: MeshPriority;
}

// ============================================================================
// LOW-LEVEL PROTOBUF BINARY CODEC
// ============================================================================

export class ProtobufWriter {
  private buffer: number[] = [];

  writeVarint(val: number): void {
    let v = Math.floor(val);
    if (v < 0) {
      // 64-bit two's complement for negative numbers
      let big = BigInt.asUintN(64, BigInt(v));
      while (big >= 0x80n) {
        this.buffer.push(Number((big & 0x7fn) | 0x80n));
        big >>= 7n;
      }
      this.buffer.push(Number(big & 0x7fn));
      return;
    }
    while (v >= 0x80) {
      this.buffer.push((v & 0x7f) | 0x80);
      v = Math.floor(v / 128);
    }
    this.buffer.push(v & 0x7f);
  }

  writeTag(fieldNumber: number, wireType: number): void {
    this.writeVarint((fieldNumber << 3) | wireType);
  }

  writeUint32(fieldNumber: number, val: number): void {
    if (val === undefined || val === null || val === 0) return;
    this.writeTag(fieldNumber, 0);
    this.writeVarint(val);
  }

  writeInt32(fieldNumber: number, val: number): void {
    if (val === undefined || val === null || val === 0) return;
    this.writeTag(fieldNumber, 0);
    this.writeVarint(val);
  }

  writeBool(fieldNumber: number, val: boolean): void {
    if (!val) return;
    this.writeTag(fieldNumber, 0);
    this.writeVarint(1);
  }

  writeFixed32(fieldNumber: number, val: number): void {
    if (val === undefined || val === null) return;
    this.writeTag(fieldNumber, 5);
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setUint32(0, val >>> 0, true);
    for (let i = 0; i < 4; i++) this.buffer.push(buf[i]);
  }

  writeSFixed32(fieldNumber: number, val: number): void {
    if (val === undefined || val === null) return;
    this.writeTag(fieldNumber, 5);
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setInt32(0, val, true);
    for (let i = 0; i < 4; i++) this.buffer.push(buf[i]);
  }

  writeFloat(fieldNumber: number, val: number): void {
    if (val === undefined || val === null) return;
    this.writeTag(fieldNumber, 5);
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setFloat32(0, val, true);
    for (let i = 0; i < 4; i++) this.buffer.push(buf[i]);
  }

  writeString(fieldNumber: number, str: string): void {
    if (!str) return;
    const bytes = new TextEncoder().encode(str);
    this.writeBytes(fieldNumber, bytes);
  }

  writeBytes(fieldNumber: number, bytes: Uint8Array): void {
    if (!bytes || bytes.length === 0) return;
    this.writeTag(fieldNumber, 2);
    this.writeVarint(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
  }

  writeSubMessage(fieldNumber: number, subWriter: ProtobufWriter): void {
    const bytes = subWriter.toBytes();
    if (bytes.length === 0) return;
    this.writeBytes(fieldNumber, bytes);
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

export class ProtobufReader {
  private view: DataView;
  private offset = 0;

  constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  isAtEnd(): boolean {
    return this.offset >= this.buffer.length;
  }

  get remaining(): number {
    return this.buffer.length - this.offset;
  }

  readVarint(): number {
    let result = 0;
    let shift = 0;
    while (true) {
      if (this.offset >= this.buffer.length) {
        throw new Error("Protobuf decode error: truncated varint");
      }
      const b = this.buffer[this.offset++];
      result |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
      if (shift >= 64) {
        throw new Error("Protobuf decode error: varint overflow");
      }
    }
    return result;
  }

  readSignedVarint(): number {
    let result = 0n;
    let shift = 0n;
    while (true) {
      if (this.offset >= this.buffer.length) {
        throw new Error("Protobuf decode error: truncated varint");
      }
      const b = BigInt(this.buffer[this.offset++]);
      result |= (b & 0x7fn) << shift;
      if ((b & 0x80n) === 0n) break;
      shift += 7n;
      if (shift >= 70n) {
        throw new Error("Protobuf decode error: varint overflow");
      }
    }
    return Number(BigInt.asIntN(32, result));
  }

  readFixed32(): number {
    if (this.offset + 4 > this.buffer.length) {
      throw new Error("Protobuf decode error: truncated fixed32");
    }
    const val = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readSFixed32(): number {
    if (this.offset + 4 > this.buffer.length) {
      throw new Error("Protobuf decode error: truncated sfixed32");
    }
    const val = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readFloat(): number {
    if (this.offset + 4 > this.buffer.length) {
      throw new Error("Protobuf decode error: truncated float");
    }
    const val = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readBytes(): Uint8Array {
    const len = this.readVarint();
    if (this.offset + len > this.buffer.length) {
      throw new Error(`Protobuf decode error: truncated bytes length ${len}`);
    }
    const slice = this.buffer.subarray(this.offset, this.offset + len);
    this.offset += len;
    return slice;
  }

  readString(): string {
    const bytes = this.readBytes();
    return new TextDecoder().decode(bytes);
  }

  skipField(wireType: number): void {
    switch (wireType) {
      case 0: // Varint
        this.readVarint();
        break;
      case 1: // Fixed64
        this.offset += 8;
        break;
      case 2: // Length-delimited
        const len = this.readVarint();
        this.offset += len;
        break;
      case 5: // Fixed32
        this.offset += 4;
        break;
      default:
        throw new Error(`Unsupported protobuf wire type ${wireType}`);
    }
  }

  readTag(): { fieldNumber: number; wireType: number } | null {
    if (this.isAtEnd()) return null;
    const tag = this.readVarint();
    return {
      fieldNumber: tag >>> 3,
      wireType: tag & 0x07,
    };
  }
}

// ============================================================================
// MESHTASTIC PROTOBUF SERIALIZERS & PARSERS
// ============================================================================

export class MeshtasticCodec {
  // --- Position ---
  static encodePosition(pos: PositionMessage): Uint8Array {
    const writer = new ProtobufWriter();
    writer.writeSFixed32(1, pos.latitude_i);
    writer.writeSFixed32(2, pos.longitude_i);
    if (pos.altitude !== undefined) writer.writeInt32(3, pos.altitude);
    if (pos.time !== undefined) writer.writeFixed32(4, pos.time);
    return writer.toBytes();
  }

  static decodePosition(buf: Uint8Array): PositionMessage {
    const reader = new ProtobufReader(buf);
    const pos: PositionMessage = { latitude_i: 0, longitude_i: 0 };
    while (!reader.isAtEnd()) {
      const tag = reader.readTag();
      if (!tag) break;
      switch (tag.fieldNumber) {
        case 1:
          pos.latitude_i = reader.readSFixed32();
          break;
        case 2:
          pos.longitude_i = reader.readSFixed32();
          break;
        case 3:
          pos.altitude = reader.readSignedVarint();
          break;
        case 4:
          pos.time = reader.readFixed32();
          break;
        default:
          reader.skipField(tag.wireType);
      }
    }
    return pos;
  }

  // --- User / NodeInfo ---
  static encodeUser(user: UserMessage): Uint8Array {
    const writer = new ProtobufWriter();
    writer.writeString(1, user.id);
    // Enforce protocol length limit
    const longName = user.long_name ? user.long_name.substring(0, 30) : "";
    writer.writeString(2, longName);
    const shortName = user.short_name ? user.short_name.substring(0, 4) : "";
    writer.writeString(3, shortName);
    if (user.macaddr) writer.writeBytes(4, user.macaddr);
    if (user.hw_model !== undefined) writer.writeUint32(5, user.hw_model);
    return writer.toBytes();
  }

  static decodeUser(buf: Uint8Array): UserMessage {
    const reader = new ProtobufReader(buf);
    const user: UserMessage = { id: "", long_name: "", short_name: "" };
    while (!reader.isAtEnd()) {
      const tag = reader.readTag();
      if (!tag) break;
      switch (tag.fieldNumber) {
        case 1:
          user.id = reader.readString();
          break;
        case 2:
          user.long_name = reader.readString();
          break;
        case 3:
          user.short_name = reader.readString();
          break;
        case 4:
          user.macaddr = reader.readBytes();
          break;
        case 5:
          user.hw_model = reader.readVarint();
          break;
        default:
          reader.skipField(tag.wireType);
      }
    }
    return user;
  }

  // --- Telemetry ---
  static encodeTelemetry(telem: TelemetryMessage): Uint8Array {
    const writer = new ProtobufWriter();
    if (telem.time !== undefined) writer.writeFixed32(1, telem.time);

    if (telem.device_metrics) {
      const sub = new ProtobufWriter();
      if (telem.device_metrics.battery_level !== undefined) {
        sub.writeUint32(1, telem.device_metrics.battery_level);
      }
      if (telem.device_metrics.voltage !== undefined) {
        sub.writeFloat(2, telem.device_metrics.voltage);
      }
      if (telem.device_metrics.channel_utilization !== undefined) {
        sub.writeFloat(3, telem.device_metrics.channel_utilization);
      }
      if (telem.device_metrics.air_util_tx !== undefined) {
        sub.writeFloat(4, telem.device_metrics.air_util_tx);
      }
      writer.writeSubMessage(2, sub);
    }

    if (telem.environment_metrics) {
      const sub = new ProtobufWriter();
      if (telem.environment_metrics.temperature !== undefined) {
        sub.writeFloat(1, telem.environment_metrics.temperature);
      }
      if (telem.environment_metrics.relative_humidity !== undefined) {
        sub.writeFloat(2, telem.environment_metrics.relative_humidity);
      }
      if (telem.environment_metrics.barometric_pressure !== undefined) {
        sub.writeFloat(3, telem.environment_metrics.barometric_pressure);
      }
      writer.writeSubMessage(3, sub);
    }

    return writer.toBytes();
  }

  static decodeTelemetry(buf: Uint8Array): TelemetryMessage {
    const reader = new ProtobufReader(buf);
    const telem: TelemetryMessage = {};
    while (!reader.isAtEnd()) {
      const tag = reader.readTag();
      if (!tag) break;
      switch (tag.fieldNumber) {
        case 1:
          telem.time = reader.readFixed32();
          break;
        case 2: {
          const subBytes = reader.readBytes();
          const subReader = new ProtobufReader(subBytes);
          telem.device_metrics = {};
          while (!subReader.isAtEnd()) {
            const subTag = subReader.readTag();
            if (!subTag) break;
            switch (subTag.fieldNumber) {
              case 1:
                telem.device_metrics.battery_level = subReader.readVarint();
                break;
              case 2:
                telem.device_metrics.voltage = subReader.readFloat();
                break;
              case 3:
                telem.device_metrics.channel_utilization = subReader.readFloat();
                break;
              case 4:
                telem.device_metrics.air_util_tx = subReader.readFloat();
                break;
              default:
                subReader.skipField(subTag.wireType);
            }
          }
          break;
        }
        case 3: {
          const subBytes = reader.readBytes();
          const subReader = new ProtobufReader(subBytes);
          telem.environment_metrics = {};
          while (!subReader.isAtEnd()) {
            const subTag = subReader.readTag();
            if (!subTag) break;
            switch (subTag.fieldNumber) {
              case 1:
                telem.environment_metrics.temperature = subReader.readFloat();
                break;
              case 2:
                telem.environment_metrics.relative_humidity = subReader.readFloat();
                break;
              case 3:
                telem.environment_metrics.barometric_pressure = subReader.readFloat();
                break;
              default:
                subReader.skipField(subTag.wireType);
            }
          }
          break;
        }
        default:
          reader.skipField(tag.wireType);
      }
    }
    return telem;
  }

  // --- Waypoint ---
  static encodeWaypoint(wp: WaypointMessage): Uint8Array {
    const writer = new ProtobufWriter();
    writer.writeUint32(1, wp.id);
    writer.writeSFixed32(2, wp.latitude_i);
    writer.writeSFixed32(3, wp.longitude_i);
    writer.writeString(4, wp.name);
    if (wp.description) writer.writeString(5, wp.description);
    if (wp.icon) writer.writeUint32(6, wp.icon);
    if (wp.geofence_radius) writer.writeUint32(7, wp.geofence_radius);
    return writer.toBytes();
  }

  static decodeWaypoint(buf: Uint8Array): WaypointMessage {
    const reader = new ProtobufReader(buf);
    const wp: WaypointMessage = { id: 0, latitude_i: 0, longitude_i: 0, name: "" };
    while (!reader.isAtEnd()) {
      const tag = reader.readTag();
      if (!tag) break;
      switch (tag.fieldNumber) {
        case 1:
          wp.id = reader.readVarint();
          break;
        case 2:
          wp.latitude_i = reader.readSFixed32();
          break;
        case 3:
          wp.longitude_i = reader.readSFixed32();
          break;
        case 4:
          wp.name = reader.readString();
          break;
        case 5:
          wp.description = reader.readString();
          break;
        case 6:
          wp.icon = reader.readVarint();
          break;
        case 7:
          wp.geofence_radius = reader.readVarint();
          break;
        default:
          reader.skipField(tag.wireType);
      }
    }
    return wp;
  }

  // --- Data Payload ---
  static encodeData(data: DataPayload): Uint8Array {
    const writer = new ProtobufWriter();
    writer.writeUint32(1, data.portnum);
    writer.writeBytes(2, data.payload);
    if (data.want_response) writer.writeBool(3, true);
    if (data.dest) writer.writeUint32(4, data.dest);
    if (data.source) writer.writeUint32(5, data.source);
    if (data.request_id) writer.writeUint32(6, data.request_id);
    return writer.toBytes();
  }

  static decodeData(buf: Uint8Array): DataPayload {
    const reader = new ProtobufReader(buf);
    const data: DataPayload = { portnum: PortNum.UNKNOWN_APP, payload: new Uint8Array(0) };
    while (!reader.isAtEnd()) {
      const tag = reader.readTag();
      if (!tag) break;
      switch (tag.fieldNumber) {
        case 1:
          data.portnum = reader.readVarint();
          break;
        case 2:
          data.payload = reader.readBytes();
          break;
        case 3:
          data.want_response = reader.readVarint() !== 0;
          break;
        case 4:
          data.dest = reader.readVarint();
          break;
        case 5:
          data.source = reader.readVarint();
          break;
        case 6:
          data.request_id = reader.readVarint();
          break;
        default:
          reader.skipField(tag.wireType);
      }
    }
    return data;
  }

  // --- MeshPacket Envelope ---
  static encodeMeshPacket(packet: MeshPacketEnvelope): Uint8Array {
    const writer = new ProtobufWriter();
    writer.writeFixed32(1, packet.from);
    writer.writeFixed32(2, packet.to);
    if (packet.channel) writer.writeUint32(3, packet.channel);
    if (packet.decoded) {
      writer.writeBytes(4, MeshtasticCodec.encodeData(packet.decoded));
    }
    writer.writeUint32(6, packet.id);
    if (packet.rx_time !== undefined) writer.writeFixed32(7, packet.rx_time);
    if (packet.rx_snr !== undefined) writer.writeFloat(8, packet.rx_snr);
    if (packet.hop_limit !== undefined) writer.writeUint32(9, packet.hop_limit);
    if (packet.want_ack) writer.writeBool(10, true);
    if (packet.priority !== undefined) writer.writeUint32(11, packet.priority);
    return writer.toBytes();
  }

  static decodeMeshPacket(buf: Uint8Array): MeshPacketEnvelope {
    if (!buf || buf.length === 0) {
      throw new Error("Cannot decode empty packet buffer");
    }
    const reader = new ProtobufReader(buf);
    const packet: MeshPacketEnvelope = { from: 0, to: 0, id: 0 };
    while (!reader.isAtEnd()) {
      const tag = reader.readTag();
      if (!tag) break;
      switch (tag.fieldNumber) {
        case 1:
          packet.from = reader.readFixed32();
          break;
        case 2:
          packet.to = reader.readFixed32();
          break;
        case 3:
          packet.channel = reader.readVarint();
          break;
        case 4:
          packet.decoded = MeshtasticCodec.decodeData(reader.readBytes());
          break;
        case 6:
          packet.id = reader.readVarint();
          break;
        case 7:
          packet.rx_time = reader.readFixed32();
          break;
        case 8:
          packet.rx_snr = reader.readFloat();
          break;
        case 9:
          packet.hop_limit = reader.readVarint();
          break;
        case 10:
          packet.want_ack = reader.readVarint() !== 0;
          break;
        case 11:
          packet.priority = reader.readVarint();
          break;
        default:
          reader.skipField(tag.wireType);
      }
    }
    return packet;
  }
}

// ============================================================================
// HARDWARE TRANSPORTS FRAMING (WebSerial, WebBluetooth, MQTT)
// ============================================================================

export class WebSerialFramer {
  static readonly MAGIC_1 = 0x94;
  static readonly MAGIC_2 = 0xc3;
  static readonly MAX_PAYLOAD_SIZE = 512;

  /**
   * Encloses a binary protobuf payload into WebSerial wire framing:
   * [0x94, 0xC3, (len >> 8) & 0xFF, len & 0xFF, ...payload]
   */
  static frame(payload: Uint8Array): Uint8Array {
    if (payload.length > WebSerialFramer.MAX_PAYLOAD_SIZE) {
      throw new Error(`Frame length ${payload.length} exceeds maximum allowable ${WebSerialFramer.MAX_PAYLOAD_SIZE} bytes`);
    }
    const framed = new Uint8Array(4 + payload.length);
    framed[0] = WebSerialFramer.MAGIC_1;
    framed[1] = WebSerialFramer.MAGIC_2;
    framed[2] = (payload.length >> 8) & 0xff;
    framed[3] = payload.length & 0xff;
    framed.set(payload, 4);
    return framed;
  }
}

export enum SerialFsmState {
  SEEK_HEADER_1,
  SEEK_HEADER_2,
  READ_LEN_HI,
  READ_LEN_LO,
  COLLECT_PAYLOAD,
}

export class SerialFSMParser {
  private state: SerialFsmState = SerialFsmState.SEEK_HEADER_1;
  private expectedLength = 0;
  private payloadBuffer: number[] = [];
  private onPacketCallback?: (packet: Uint8Array) => void;

  onPacket(cb: (packet: Uint8Array) => void): void {
    this.onPacketCallback = cb;
  }

  getState(): SerialFsmState {
    return this.state;
  }

  reset(): void {
    this.state = SerialFsmState.SEEK_HEADER_1;
    this.expectedLength = 0;
    this.payloadBuffer = [];
  }

  processBytes(chunk: Uint8Array): Uint8Array[] {
    const emitted: Uint8Array[] = [];

    for (let i = 0; i < chunk.length; i++) {
      const b = chunk[i];

      switch (this.state) {
        case SerialFsmState.SEEK_HEADER_1:
          if (b === WebSerialFramer.MAGIC_1) {
            this.state = SerialFsmState.SEEK_HEADER_2;
          }
          break;

        case SerialFsmState.SEEK_HEADER_2:
          if (b === WebSerialFramer.MAGIC_2) {
            this.state = SerialFsmState.READ_LEN_HI;
          } else if (b === WebSerialFramer.MAGIC_1) {
            // Consecutive 0x94 0x94, stay in SEEK_HEADER_2
            this.state = SerialFsmState.SEEK_HEADER_2;
          } else {
            this.state = SerialFsmState.SEEK_HEADER_1;
          }
          break;

        case SerialFsmState.READ_LEN_HI:
          this.expectedLength = b << 8;
          this.state = SerialFsmState.READ_LEN_LO;
          break;

        case SerialFsmState.READ_LEN_LO:
          this.expectedLength |= b;
          if (this.expectedLength > WebSerialFramer.MAX_PAYLOAD_SIZE || this.expectedLength === 0) {
            // Oversized or zero frame, reject and reset to header search
            this.reset();
          } else {
            this.payloadBuffer = [];
            this.state = SerialFsmState.COLLECT_PAYLOAD;
          }
          break;

        case SerialFsmState.COLLECT_PAYLOAD:
          this.payloadBuffer.push(b);
          if (this.payloadBuffer.length === this.expectedLength) {
            const completePacket = new Uint8Array(this.payloadBuffer);
            emitted.push(completePacket);
            if (this.onPacketCallback) {
              this.onPacketCallback(completePacket);
            }
            this.reset();
          }
          break;
      }
    }

    return emitted;
  }
}

// ============================================================================
// BLE GATT TRANSPORT MOCK
// ============================================================================

export class MockBleGattTransport {
  static readonly SERVICE_UUID = "6ba1b218-15a8-461f-9fa8-5dcae273eafd";
  static readonly CHAR_TO_RADIO = "f75c76d2-129e-4dad-a1dd-7866124401e7";
  static readonly CHAR_FROM_RADIO = "2c55e69e-4993-11ed-b878-0242ac120002";
  static readonly CHAR_FROM_NUM = "ed9da18c-a800-4f66-a670-aa7547e34453";

  private isConnected = false;
  private toRadioBuffer: Uint8Array[] = [];
  private fromRadioQueue: Uint8Array[] = [];
  private fromNumListeners: Array<(count: number) => void> = [];

  connect(): void {
    this.isConnected = true;
  }

  disconnect(): void {
    this.isConnected = false;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  async writeToRadio(bytes: Uint8Array): Promise<void> {
    if (!this.isConnected) {
      throw new Error("BLE Transport disconnected");
    }
    if (bytes.length > WebSerialFramer.MAX_PAYLOAD_SIZE) {
      throw new Error("Chunk exceeds MTU size 512 bytes");
    }
    this.toRadioBuffer.push(new Uint8Array(bytes));
  }

  getWrittenToRadio(): Uint8Array[] {
    return [...this.toRadioBuffer];
  }

  pushFromRadioPacket(packet: Uint8Array): void {
    this.fromRadioQueue.push(packet);
    for (const listener of this.fromNumListeners) {
      listener(this.fromRadioQueue.length);
    }
  }

  async readFromRadio(): Promise<Uint8Array | null> {
    if (!this.isConnected) {
      throw new Error("BLE Transport disconnected");
    }
    return this.fromRadioQueue.shift() || null;
  }

  onFromNum(callback: (count: number) => void): () => void {
    this.fromNumListeners.push(callback);
    return () => {
      this.fromNumListeners = this.fromNumListeners.filter((l) => l !== callback);
    };
  }
}

// ============================================================================
// MQTT BRIDGE TRANSPORT MOCK
// ============================================================================

export interface ServiceEnvelope {
  channel_id: string;
  gateway_id: string;
  packet: MeshPacketEnvelope;
}

export class MockMqttBridge {
  private subscriptions = new Map<string, Array<(topic: string, message: Uint8Array | string) => void>>();
  private messageHistory: Array<{ topic: string; message: Uint8Array | string }> = [];
  private connected = true;

  setConnected(status: boolean): void {
    this.connected = status;
  }

  subscribe(topicPattern: string, handler: (topic: string, message: Uint8Array | string) => void): void {
    const list = this.subscriptions.get(topicPattern) || [];
    list.push(handler);
    this.subscriptions.set(topicPattern, list);
  }

  publish(topic: string, message: Uint8Array | string): boolean {
    if (!this.connected) return false;
    this.messageHistory.push({ topic, message });

    for (const [pattern, handlers] of this.subscriptions.entries()) {
      if (this.topicMatches(pattern, topic)) {
        for (const handler of handlers) {
          handler(topic, message);
        }
      }
    }
    return true;
  }

  private topicMatches(pattern: string, topic: string): boolean {
    if (pattern === "#" || pattern === topic) return true;
    const pParts = pattern.split("/");
    const tParts = topic.split("/");
    for (let i = 0; i < pParts.length; i++) {
      if (pParts[i] === "#") return true;
      if (pParts[i] === "+") continue;
      if (pParts[i] !== tParts[i]) return false;
    }
    return pParts.length === tParts.length;
  }

  getMessages(): Array<{ topic: string; message: Uint8Array | string }> {
    return [...this.messageHistory];
  }
}
