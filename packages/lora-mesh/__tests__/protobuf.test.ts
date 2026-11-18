import { describe, it, expect } from 'vitest';
import {
  encodeVarint,
  decodeVarint,
  decodeVarintBigInt,
  encodeZigZag32,
  decodeZigZag32
} from '../src/protobuf/varint';
import { WireWriter, WireReader, WireType } from '../src/protobuf/wire';
import { encodePosition, decodePosition } from '../src/protobuf/position';
import { encodeTelemetry, decodeTelemetry } from '../src/protobuf/telemetry';
import { encodeUser, decodeUser, encodeNodeInfo, decodeNodeInfo } from '../src/protobuf/user';
import { encodeWaypoint, decodeWaypoint } from '../src/protobuf/waypoint';
import { encodeData, decodeData } from '../src/protobuf/data';
import { encodeMeshPacket, decodeMeshPacket } from '../src/protobuf/mesh-packet';
import { encodeToRadio, decodeToRadio } from '../src/protobuf/to-radio';
import { encodeFromRadio, decodeFromRadio } from '../src/protobuf/from-radio';
import { encodeServiceEnvelope, decodeServiceEnvelope } from '../src/protobuf/service-envelope';
import { PortNum, PacketPriority, LocationSource } from '../src/protobuf/types';

describe('Protobuf Wire Codecs', () => {
  describe('Varint & ZigZag', () => {
    it('should roundtrip standard unsigned varints', () => {
      const testValues = [0, 1, 127, 128, 300, 16384, 2097151, 0xffffffff];
      for (const val of testValues) {
        const encoded = encodeVarint(val);
        const { value, bytesRead } = decodeVarint(encoded);
        expect(value).toBe(val);
        expect(bytesRead).toBe(encoded.length);
      }
    });

    it('should roundtrip 64-bit BigInt varints', () => {
      const testValues = [0n, 123456789012345n, 0x7fffffffffffffffn];
      for (const val of testValues) {
        const encoded = encodeVarint(val);
        const { value, bytesRead } = decodeVarintBigInt(encoded);
        expect(value).toBe(val);
        expect(bytesRead).toBe(encoded.length);
      }
    });

    it('should roundtrip ZigZag signed integers', () => {
      const testSigned = [0, -1, 1, -2, 2, -2147483648, 2147483647];
      for (const n of testSigned) {
        const zz = encodeZigZag32(n);
        expect(decodeZigZag32(zz)).toBe(n);
      }
    });
  });

  describe('WireReader and WireWriter primitives', () => {
    it('should write and read all protobuf wire types', () => {
      const writer = new WireWriter();
      writer.writeVarint(1, 42);
      writer.writeFixed32(2, 0x12345678);
      writer.writeSFixed32(3, -98765);
      writer.writeFloat(4, 3.14159);
      writer.writeFixed64(5, 0x0102030405060708n);
      writer.writeDouble(6, 123456.789);
      writer.writeString(7, 'Hello Meshtastic!');
      writer.writeBytes(8, new Uint8Array([0xde, 0xad, 0xbe, 0xef]));

      const bytes = writer.finish();
      const reader = new WireReader(bytes);

      const f1 = reader.readTag();
      expect(f1).toEqual({ fieldNumber: 1, wireType: WireType.VARINT });
      expect(reader.readVarint()).toBe(42);

      const f2 = reader.readTag();
      expect(f2).toEqual({ fieldNumber: 2, wireType: WireType.FIXED32 });
      expect(reader.readFixed32()).toBe(0x12345678);

      const f3 = reader.readTag();
      expect(f3).toEqual({ fieldNumber: 3, wireType: WireType.FIXED32 });
      expect(reader.readSFixed32()).toBe(-98765);

      const f4 = reader.readTag();
      expect(f4).toEqual({ fieldNumber: 4, wireType: WireType.FIXED32 });
      expect(reader.readFloat()).toBeCloseTo(3.14159, 4);

      const f5 = reader.readTag();
      expect(f5).toEqual({ fieldNumber: 5, wireType: WireType.FIXED64 });
      expect(reader.readFixed64()).toBe(0x0102030405060708n);

      const f6 = reader.readTag();
      expect(f6).toEqual({ fieldNumber: 6, wireType: WireType.FIXED64 });
      expect(reader.readDouble()).toBeCloseTo(123456.789, 2);

      const f7 = reader.readTag();
      expect(f7).toEqual({ fieldNumber: 7, wireType: WireType.LENGTH_DELIMITED });
      expect(reader.readString()).toBe('Hello Meshtastic!');

      const f8 = reader.readTag();
      expect(f8).toEqual({ fieldNumber: 8, wireType: WireType.LENGTH_DELIMITED });
      expect(reader.readBytes()).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));

      expect(reader.hasMore()).toBe(false);
    });
  });

  describe('Position message codec', () => {
    it('should serialize and deserialize PositionMessage with negative scaled integers', () => {
      const pos = {
        latitude_i: -433550123,
        longitude_i: 424392456,
        altitude: 2840,
        time: 1716038400,
        location_source: LocationSource.LOC_INTERNAL,
        sats_in_view: 9,
        gps_accuracy: 1500
      };

      const encoded = encodePosition(pos);
      const decoded = decodePosition(encoded);

      expect(decoded.latitude_i).toBe(-433550123);
      expect(decoded.longitude_i).toBe(424392456);
      expect(decoded.altitude).toBe(2840);
      expect(decoded.time).toBe(1716038400);
      expect(decoded.location_source).toBe(LocationSource.LOC_INTERNAL);
      expect(decoded.sats_in_view).toBe(9);
      expect(decoded.gps_accuracy).toBe(1500);
    });
  });

  describe('Telemetry message codec', () => {
    it('should serialize and deserialize TelemetryMessage with DeviceMetrics and EnvironmentMetrics', () => {
      const telemetry = {
        time: 1716038400,
        device_metrics: {
          battery_level: 87,
          voltage: 4.12,
          channel_utilization: 12.5,
          air_util_tx: 1.2,
          uptime_seconds: 3600
        },
        environment_metrics: {
          temperature: 18.5,
          relative_humidity: 62.3,
          barometric_pressure: 1013.25,
          gas_resistance: 125000,
          iaq: 45
        }
      };

      const encoded = encodeTelemetry(telemetry);
      const decoded = decodeTelemetry(encoded);

      expect(decoded.time).toBe(1716038400);
      expect(decoded.device_metrics?.battery_level).toBe(87);
      expect(decoded.device_metrics?.voltage).toBeCloseTo(4.12, 2);
      expect(decoded.device_metrics?.uptime_seconds).toBe(3600);

      expect(decoded.environment_metrics?.temperature).toBeCloseTo(18.5, 1);
      expect(decoded.environment_metrics?.relative_humidity).toBeCloseTo(62.3, 1);
      expect(decoded.environment_metrics?.barometric_pressure).toBeCloseTo(1013.25, 2);
      expect(decoded.environment_metrics?.iaq).toBe(45);
    });
  });

  describe('User & NodeInfo message codecs', () => {
    it('should serialize and deserialize User and NodeInfo', () => {
      const node = {
        num: 0x28a4c1f0,
        user: {
          id: '!28a4c1f0',
          long_name: 'Alex Field Rescuer',
          short_name: 'ALEX',
          hw_model: 'T_BEAM',
          role: 'rescuer'
        },
        position: {
          latitude_i: 433550000,
          longitude_i: 424390000,
          altitude: 2100
        },
        snr: 8.5,
        last_heard: 1716038400,
        channel: 0,
        via_mqtt: false,
        hops_away: 1
      };

      const encoded = encodeNodeInfo(node);
      const decoded = decodeNodeInfo(encoded);

      expect(decoded.num).toBe(0x28a4c1f0);
      expect(decoded.user?.long_name).toBe('Alex Field Rescuer');
      expect(decoded.user?.short_name).toBe('ALEX');
      expect(decoded.position?.latitude_i).toBe(433550000);
      expect(decoded.snr).toBeCloseTo(8.5, 1);
      expect(decoded.last_heard).toBe(1716038400);
      expect(decoded.hops_away).toBe(1);
    });
  });

  describe('Waypoint message codec', () => {
    it('should serialize and deserialize Waypoint with emoji and description', () => {
      const wp = {
        id: 101,
        latitude_i: 433500000,
        longitude_i: 424300000,
        expire: 1716124800,
        locked_to: 0,
        name: 'Camp 1 Base',
        description: 'Tent site with freshwater stream',
        icon: 0x26fa // Tent emoji Unicode codepoint
      };

      const encoded = encodeWaypoint(wp);
      const decoded = decodeWaypoint(encoded);

      expect(decoded.id).toBe(101);
      expect(decoded.name).toBe('Camp 1 Base');
      expect(decoded.description).toBe('Tent site with freshwater stream');
      expect(decoded.icon).toBe(0x26fa);
    });
  });

  describe('MeshPacket & Data codecs', () => {
    it('should serialize and deserialize MeshPacket with embedded Data payload', () => {
      const payloadBytes = new TextEncoder().encode('Rendezvous at pass 3');
      const packet = {
        from: 0x11223344,
        to: 0xffffffff,
        channel: 0,
        id: 998877,
        hop_limit: 3,
        want_ack: true,
        priority: PacketPriority.ALERT,
        rx_rssi: -75,
        rx_snr: 6.5,
        rx_time: 1716038450,
        decoded: {
          portnum: PortNum.TEXT_MESSAGE_APP,
          payload: payloadBytes,
          want_response: true
        }
      };

      const encoded = encodeMeshPacket(packet);
      const decoded = decodeMeshPacket(encoded);

      expect(decoded.from).toBe(0x11223344);
      expect(decoded.to).toBe(0xffffffff);
      expect(decoded.channel).toBe(0);
      expect(decoded.id).toBe(998877);
      expect(decoded.priority).toBe(PacketPriority.ALERT);
      expect(decoded.want_ack).toBe(true);
      expect(decoded.hop_limit).toBe(3);
      expect(decoded.rx_rssi).toBe(-75);
      expect(decoded.rx_snr).toBeCloseTo(6.5, 1);
      expect(decoded.decoded?.portnum).toBe(PortNum.TEXT_MESSAGE_APP);
      expect(new TextDecoder().decode(decoded.decoded?.payload)).toBe('Rendezvous at pass 3');
    });
  });

  describe('ToRadio, FromRadio, and ServiceEnvelope codecs', () => {
    it('should roundtrip ToRadio command packet', () => {
      const toRadio = {
        want_config_id: 1,
        disconnect: false,
        packet: {
          from: 100,
          to: 200,
          channel: 0,
          id: 55,
          hop_limit: 3,
          want_ack: false,
          priority: PacketPriority.DEFAULT
        }
      };

      const encoded = encodeToRadio(toRadio);
      const decoded = decodeToRadio(encoded);

      expect(decoded.want_config_id).toBe(1);
      expect(decoded.packet?.from).toBe(100);
      expect(decoded.packet?.id).toBe(55);
    });

    it('should roundtrip FromRadio with my_info and packet', () => {
      const fromRadio = {
        id: 1234,
        rebooted: true,
        my_info: {
          my_node_num: 0x28a4c1f0,
          reboot_count: 3,
          has_gps: true
        }
      };

      const encoded = encodeFromRadio(fromRadio);
      const decoded = decodeFromRadio(encoded);

      expect(decoded.id).toBe(1234);
      expect(decoded.rebooted).toBe(true);
      expect(decoded.my_info?.my_node_num).toBe(0x28a4c1f0);
      expect(decoded.my_info?.has_gps).toBe(true);
    });

    it('should roundtrip MQTT ServiceEnvelope', () => {
      const envelope = {
        channel_id: 'LongFast',
        gateway_id: '!28a4c1f0',
        packet: {
          from: 0x11111111,
          to: 0xffffffff,
          channel: 0,
          id: 42,
          hop_limit: 3,
          want_ack: false,
          priority: PacketPriority.DEFAULT
        }
      };

      const encoded = encodeServiceEnvelope(envelope);
      const decoded = decodeServiceEnvelope(encoded);

      expect(decoded.channel_id).toBe('LongFast');
      expect(decoded.gateway_id).toBe('!28a4c1f0');
      expect(decoded.packet.from).toBe(0x11111111);
      expect(decoded.packet.id).toBe(42);
    });
  });
});
