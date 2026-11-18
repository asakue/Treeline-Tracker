import { describe, it, expect } from 'vitest';
import {
  clampLatitude,
  clampLongitude,
  degreesToScaledInt,
  scaledIntToDegrees,
  encodeGps,
  decodeGps,
  buildPositionPacket,
  parsePositionPacket
} from '../src/codec/gps-codec';
import { DistressCodec } from '../src/codec/distress-codec';
import {
  encodeChatMessage,
  decodeChatMessage,
  buildChatPacket,
  parseChatPacket,
  MAX_MESH_TEXT_LENGTH
} from '../src/codec/chat-codec';
import { PacketPriority, NODENUM_BROADCAST, PortNum } from '../src/protobuf/types';

describe('GPS & Distress & Chat Codecs', () => {
  describe('GPS Codec', () => {
    it('should clamp latitude between -90 and 90 and longitude between -180 and 180', () => {
      expect(clampLatitude(95.5)).toBe(90);
      expect(clampLatitude(-100)).toBe(-90);
      expect(clampLatitude(45.123)).toBe(45.123);

      expect(clampLongitude(185.0)).toBe(180);
      expect(clampLongitude(-195.0)).toBe(-180);
      expect(clampLongitude(37.5)).toBe(37.5);
    });

    it('should accurately convert degrees to scaled integers and back', () => {
      const originalLat = 43.3550123;
      const originalLon = 42.4392456;

      const scaledLat = degreesToScaledInt(originalLat);
      const scaledLon = degreesToScaledInt(originalLon);

      expect(scaledLat).toBe(433550123);
      expect(scaledLon).toBe(424392456);

      expect(scaledIntToDegrees(scaledLat)).toBeCloseTo(originalLat, 7);
      expect(scaledIntToDegrees(scaledLon)).toBeCloseTo(originalLon, 7);
    });

    it('should build and parse Position packets', () => {
      const packet = buildPositionPacket(0x12345678, NODENUM_BROADCAST, 43.355, 42.439, 2150);
      expect(packet.from).toBe(0x12345678);
      expect(packet.to).toBe(NODENUM_BROADCAST);
      expect(packet.decoded?.portnum).toBe(PortNum.POSITION_APP);

      const parsed = parsePositionPacket(packet);
      expect(parsed).not.toBeNull();
      expect(parsed?.latitude).toBeCloseTo(43.355, 5);
      expect(parsed?.longitude).toBeCloseTo(42.439, 5);
      expect(parsed?.altitude).toBe(2150);
    });
  });

  describe('Distress Beacon SOS Codec', () => {
    it('should construct high-priority distress SOS beacon with Priority.ALERT = 110 and broadcast 0xFFFFFFFF', () => {
      const beacon = DistressCodec.buildSosBeacon({
        fromNode: 0x28a4c1f0,
        senderName: 'Alex Guide',
        emergencyType: 'MEDICAL_EMERGENCY',
        latitude: 43.355,
        longitude: 42.439,
        altitude: 2840,
        batteryPercent: 42,
        notes: 'Severe hypothermia'
      });

      // 1. Text Packet Invariants
      expect(beacon.textPacket.priority).toBe(PacketPriority.ALERT);
      expect(beacon.textPacket.priority).toBe(110);
      expect(beacon.textPacket.to).toBe(NODENUM_BROADCAST);
      expect(beacon.textPacket.to).toBe(0xffffffff);
      expect(beacon.textPacket.want_ack).toBe(true);
      expect(beacon.textPacket.hop_limit).toBe(5);

      // 2. Position Packet Invariants
      expect(beacon.positionPacket.priority).toBe(PacketPriority.ALERT);
      expect(beacon.positionPacket.priority).toBe(110);
      expect(beacon.positionPacket.to).toBe(0xffffffff);
      expect(beacon.positionPacket.want_ack).toBe(true);

      // 3. Text formatting
      const text = new TextDecoder().decode(beacon.textPacket.decoded?.payload);
      expect(text).toContain('[SOS:MEDICAL_EMERGENCY]');
      expect(text).toContain('Hiker: Alex Guide');
      expect(text).toContain('Bat: 42%');
      expect(text).toContain('Severe hypothermia');
    });

    it('should correctly identify distress packets and parse alert details', () => {
      const beacon = DistressCodec.buildSosBeacon({
        fromNode: 0x99887766,
        senderName: 'Ivan Rescuer',
        emergencyType: 'LOST_PERSON',
        latitude: -43.1234,
        longitude: 172.5678,
        batteryPercent: 88,
        notes: 'Trapped in ravine'
      });

      expect(DistressCodec.isDistressPacket(beacon.textPacket)).toBe(true);
      expect(DistressCodec.isDistressPacket(beacon.positionPacket)).toBe(true);

      const parsedText = DistressCodec.parseSosPacket(beacon.textPacket);
      expect(parsedText).not.toBeNull();
      expect(parsedText?.emergencyType).toBe('LOST_PERSON');
      expect(parsedText?.senderName).toBe('Ivan Rescuer');
      expect(parsedText?.latitude).toBeCloseTo(-43.1234, 4);
      expect(parsedText?.longitude).toBeCloseTo(172.5678, 4);
      expect(parsedText?.batteryPercent).toBe(88);
    });
  });

  describe('Chat Codec', () => {
    it('should encode and decode chat messages within 228-byte limit', () => {
      const msg = 'Check in at waypoint 4';
      const encoded = encodeChatMessage(msg);
      expect(decodeChatMessage(encoded)).toBe(msg);
    });

    it('should clamp text exceeding MAX_MESH_TEXT_LENGTH (228 bytes)', () => {
      const longMessage = 'A'.repeat(300);
      const encoded = encodeChatMessage(longMessage);
      expect(encoded.length).toBe(MAX_MESH_TEXT_LENGTH);
      expect(decodeChatMessage(encoded).length).toBe(MAX_MESH_TEXT_LENGTH);
    });

    it('should build and parse chat packets for broadcast and direct messages', () => {
      const chatPacket = buildChatPacket(0x1111, 0x2222, 'Direct radio ping');
      expect(chatPacket.from).toBe(0x1111);
      expect(chatPacket.to).toBe(0x2222);
      expect(chatPacket.want_ack).toBe(true); // DM requests ACK

      const parsed = parseChatPacket(chatPacket);
      expect(parsed?.text).toBe('Direct radio ping');
      expect(parsed?.from).toBe(0x1111);
      expect(parsed?.to).toBe(0x2222);
      expect(parsed?.isBroadcast).toBe(false);

      const broadcastPacket = buildChatPacket(0x1111, NODENUM_BROADCAST, 'Team squad all-hands');
      const parsedBroadcast = parseChatPacket(broadcastPacket);
      expect(parsedBroadcast?.isBroadcast).toBe(true);
    });
  });
});
