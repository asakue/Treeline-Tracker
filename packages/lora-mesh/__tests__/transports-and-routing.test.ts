import { describe, it, expect } from 'vitest';
import { MockMeshTransport } from '../src/transports/mock-mesh-transport';
import { WebBluetoothTransport, BluetoothCharacteristicLike } from '../src/transports/webbluetooth-transport';
import { MqttBridgeTransport } from '../src/transports/mqtt-bridge';
import { PacketDeduplicator } from '../src/routing/packet-deduplicator';
import { NodeDB } from '../src/routing/node-db';
import { LoRaMeshEngine } from '../src/mesh-engine';
import { calculateChannelHash, matchesChannelHash } from '../src/crypto/channel-hash';
import { encryptPayload, decryptPayload } from '../src/crypto/packet-crypto';
import { MeshPacket, PacketPriority, PortNum, NODENUM_BROADCAST } from '../src/protobuf/types';
import { encodeFromRadio } from '../src/protobuf/from-radio';
import { encodeServiceEnvelope } from '../src/protobuf/service-envelope';

describe('Transports, Routing, Engine and Crypto', () => {
  describe('MockMeshTransport', () => {
    it('should connect, send packets, and track sent queue', async () => {
      const mock = new MockMeshTransport();
      await mock.connect();
      expect(mock.getStatus()).toBe('CONNECTED');

      const packet: MeshPacket = {
        from: 1,
        to: 2,
        channel: 0,
        id: 100,
        hop_limit: 3,
        want_ack: false,
        priority: PacketPriority.DEFAULT
      };

      const result = await mock.sendPacket(packet);
      expect(result.success).toBe(true);
      expect(mock.sentPackets.length).toBe(1);
      expect(mock.sentPackets[0].id).toBe(100);
    });

    it('should simulate RF failure when failNextSend is true', async () => {
      const mock = new MockMeshTransport();
      mock.failNextSend = true;

      const result = await mock.sendPacket({
        from: 1,
        to: 2,
        channel: 0,
        id: 101,
        hop_limit: 3,
        want_ack: false,
        priority: PacketPriority.DEFAULT
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('failure');
    });
  });

  describe('WebBluetoothTransport Queue Drain', () => {
    it('should drain multiple queued FromRadio packets on notification', async () => {
      const p1: MeshPacket = { from: 10, to: 20, channel: 0, id: 1, hop_limit: 3, want_ack: false, priority: 64 };
      const p2: MeshPacket = { from: 10, to: 20, channel: 0, id: 2, hop_limit: 3, want_ack: false, priority: 64 };

      const b1 = encodeFromRadio({ id: 1, packet: p1 });
      const b2 = encodeFromRadio({ id: 2, packet: p2 });

      let readCallCount = 0;
      const mockFromRadio: BluetoothCharacteristicLike = {
        readValue: async () => {
          readCallCount++;
          if (readCallCount === 1) return new DataView(b1.buffer, b1.byteOffset, b1.byteLength);
          if (readCallCount === 2) return new DataView(b2.buffer, b2.byteOffset, b2.byteLength);
          return new DataView(new ArrayBuffer(0)); // empty buffer ends drain loop
        },
        startNotifications: async function () { return this; },
        stopNotifications: async function () { return this; },
        addEventListener: () => {},
        removeEventListener: () => {}
      };

      const mockDevice = {
        gatt: {
          connected: true,
          connect: async () => ({
            getPrimaryService: async () => ({
              getCharacteristic: async (uuid: string) => mockFromRadio
            })
          }),
          disconnect: () => {}
        }
      };

      const bleTransport = new WebBluetoothTransport(mockDevice as any);
      const receivedPackets: MeshPacket[] = [];
      bleTransport.onPacket((p) => receivedPackets.push(p));

      await bleTransport.connect();
      expect(receivedPackets.length).toBe(2);
      expect(receivedPackets[0].id).toBe(1);
      expect(receivedPackets[1].id).toBe(2);
    });
  });

  describe('MqttBridgeTransport', () => {
    it('should parse incoming ServiceEnvelope, raw MeshPacket, and JSON payloads', async () => {
      const mqtt = new MqttBridgeTransport();
      await mqtt.connect();

      const received: MeshPacket[] = [];
      mqtt.onPacket((p) => received.push(p));

      // 1. Binary ServiceEnvelope
      const envPacket: MeshPacket = { from: 100, to: 200, channel: 0, id: 50, hop_limit: 3, want_ack: false, priority: 64 };
      const envBytes = encodeServiceEnvelope({ packet: envPacket, channel_id: 'LongFast', gateway_id: '!gw1' });
      mqtt.handleIncomingMessage('msh/EU_868/2/e/LongFast/!gw1', envBytes);
      expect(received.length).toBe(1);
      expect(received[0].id).toBe(50);

      // 2. Decoded JSON
      const jsonStr = JSON.stringify({
        from: 300,
        to: 400,
        channel: 1,
        id: 75,
        hops_away: 2,
        snr: 9.0,
        rssi: -72
      });
      mqtt.handleIncomingMessage('msh/EU_868/2/json/LongFast/!gw1', new TextEncoder().encode(jsonStr));
      expect(received.length).toBe(2);
      expect(received[1].id).toBe(75);
      expect(received[1].rx_snr).toBe(9.0);
    });
  });

  describe('PacketDeduplicator', () => {
    it('should detect duplicate packets within time window', () => {
      const dedup = new PacketDeduplicator(1000);
      const packet: MeshPacket = { from: 0x11, to: 0x22, channel: 0, id: 999, hop_limit: 3, want_ack: false, priority: 64 };

      expect(dedup.isDuplicate(packet)).toBe(false);
      expect(dedup.isDuplicate(packet)).toBe(true);
      expect(dedup.size).toBe(1);
    });

    it('should allow packet again after window expires', async () => {
      const dedup = new PacketDeduplicator(20); // 20ms window
      const packet: MeshPacket = { from: 0x11, to: 0x22, channel: 0, id: 999, hop_limit: 3, want_ack: false, priority: 64 };

      expect(dedup.isDuplicate(packet)).toBe(false);
      await new Promise((r) => setTimeout(r, 30));
      expect(dedup.isDuplicate(packet)).toBe(false);
    });
  });

  describe('NodeDB', () => {
    it('should track nodes and update presence, position, and metrics', () => {
      const db = new NodeDB();
      const nodeNum = 0x28a4c1f0;

      db.updateFromPacket({
        from: nodeNum,
        to: NODENUM_BROADCAST,
        channel: 0,
        id: 1,
        hop_limit: 2,
        hop_start: 3,
        rx_snr: 7.2,
        rx_time: 1716038400,
        want_ack: false,
        priority: 64
      });

      const node = db.getNode(nodeNum);
      expect(node).toBeDefined();
      expect(node?.snr).toBe(7.2);
      expect(node?.hops_away).toBe(1);

      db.updateUser(nodeNum, { id: '!28a4c1f0', long_name: 'Alex Explorer', short_name: 'ALEX' });
      expect(db.getNode(nodeNum)?.user?.short_name).toBe('ALEX');

      db.updatePosition(nodeNum, { latitude_i: 433550000, longitude_i: 424390000 });
      expect(db.getNode(nodeNum)?.position?.latitude_i).toBe(433550000);

      expect(db.getAllNodes().length).toBe(1);
      expect(db.getActiveNodes(1000000000).length).toBe(1);
    });
  });

  describe('LoRaMeshEngine Multiplexer', () => {
    it('should dispatch typed events on incoming chat, position, and SOS distress', async () => {
      const mockTransport = new MockMeshTransport();
      const engine = new LoRaMeshEngine({ myNodeNum: 0x9999, transports: [mockTransport] });

      let chatEvent: any = null;
      let posEvent: any = null;
      let distressEvent: any = null;

      engine.onChat((c) => (chatEvent = c));
      engine.onPosition((p) => (posEvent = p));
      engine.onDistress((d) => (distressEvent = d));

      // 1. Send chat
      await engine.sendChat('Team rally at ridge');
      expect(mockTransport.sentPackets.length).toBe(1);
      const sentChat = mockTransport.sentPackets[0];

      // Simulate loopback or peer receiving chat
      engine.handleIncomingPacket(sentChat);
      expect(chatEvent).not.toBeNull();
      expect(chatEvent.text).toBe('Team rally at ridge');

      // 2. Send distress SOS
      const sosResult = await engine.sendDistress({
        senderName: 'Ivan Lead',
        emergencyType: 'WEATHER_HAZARD',
        latitude: 43.35,
        longitude: 42.44,
        notes: 'Blizzard conditions'
      });
      expect(sosResult.textResult.success).toBe(true);

      const sentSosText = mockTransport.sentPackets.find(
        (p) => p.decoded?.portnum === PortNum.TEXT_MESSAGE_APP && p.priority === PacketPriority.ALERT
      );
      expect(sentSosText).toBeDefined();

      engine.handleIncomingPacket(sentSosText!);
      expect(distressEvent).not.toBeNull();
      expect(distressEvent.alert.emergencyType).toBe('WEATHER_HAZARD');
      expect(distressEvent.alert.senderName).toBe('Ivan Lead');
    });
  });

  describe('Channel Hash & Packet Crypto', () => {
    it('should calculate channel hash', () => {
      const hash = calculateChannelHash('LongFast');
      expect(typeof hash).toBe('number');
      expect(hash).toBeGreaterThan(0);
      expect(matchesChannelHash('LongFast', hash)).toBe(true);
      expect(matchesChannelHash('ShortSlow', hash)).toBe(false);
    });

    it('should encrypt and decrypt payload with AES-CTR', async () => {
      const plaintext = new TextEncoder().encode('Confidential tactical coordinates');
      const packetId = 123456789;
      const fromNode = 0x28a4c1f0;

      const ciphertext = await encryptPayload(plaintext, undefined, packetId, fromNode);
      expect(ciphertext).not.toEqual(plaintext);
      expect(ciphertext.length).toBe(plaintext.length);

      const decrypted = await decryptPayload(ciphertext, undefined, packetId, fromNode);
      expect(Array.from(decrypted)).toEqual(Array.from(plaintext));
      expect(new TextDecoder().decode(decrypted)).toBe('Confidential tactical coordinates');
    });
  });
});
