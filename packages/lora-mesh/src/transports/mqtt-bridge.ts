/**
 * MQTT Bridge Transport for Meshtastic networks.
 * Subscribes to msh/# topics, encodes/decodes ServiceEnvelope protobuf and JSON.
 */

import { ILoRaMeshTransport, MeshTransportStatus, DeliveryResult, PacketHandler, StatusHandler } from './interfaces';
import { MeshPacket, ServiceEnvelope } from '../protobuf/types';
import { encodeServiceEnvelope, decodeServiceEnvelope } from '../protobuf/service-envelope';
import { decodeMeshPacket } from '../protobuf/mesh-packet';

export interface MqttClientLike {
  connect?(): void;
  end?(force?: boolean, cb?: () => void): void;
  subscribe(topic: string | string[], opts?: any, callback?: (err: Error | null) => void): any;
  unsubscribe(topic: string | string[], opts?: any, callback?: (err: Error | null) => void): any;
  publish(topic: string, message: Buffer | string | Uint8Array, opts?: any, callback?: (err?: Error) => void): any;
  on(event: string, cb: (...args: any[]) => void): any;
  removeListener?(event: string, cb: (...args: any[]) => void): any;
}

export interface MqttBridgeOptions {
  client?: MqttClientLike;
  brokerUrl?: string;
  topicPrefix?: string;
  channelId?: string;
  gatewayId?: string;
}

export class MqttBridgeTransport implements ILoRaMeshTransport {
  public readonly name = 'MQTT Bridge (msh/#)';
  public readonly transportType = 'mqtt';

  private status: MeshTransportStatus = 'DISCONNECTED';
  private client: MqttClientLike | null = null;
  private topicPrefix: string;
  private channelId: string;
  private gatewayId: string;

  private packetHandlers = new Set<PacketHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private messageListener?: (topic: string, message: Buffer | Uint8Array) => void;

  constructor(options: MqttBridgeOptions = {}) {
    this.client = options.client || null;
    this.topicPrefix = options.topicPrefix || 'msh';
    this.channelId = options.channelId || 'LongFast';
    this.gatewayId = options.gatewayId || '!00000000';
  }

  public getStatus(): MeshTransportStatus {
    return this.status;
  }

  private setStatus(newStatus: MeshTransportStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      for (const handler of this.statusHandlers) {
        handler(newStatus);
      }
    }
  }

  public setClient(client: MqttClientLike): void {
    this.client = client;
  }

  public async connect(): Promise<void> {
    if (this.status === 'CONNECTED') return;

    if (!this.client) {
      // Mock / standalone offline mode
      this.setStatus('CONNECTED');
      return;
    }

    this.setStatus('CONNECTING');
    try {
      this.messageListener = (topic: string, message: Buffer | Uint8Array) => {
        this.handleIncomingMessage(topic, message);
      };

      this.client.on('message', this.messageListener);
      this.client.on('connect', () => {
        this.setStatus('CONNECTED');
        this.client?.subscribe(`${this.topicPrefix}/#`);
      });
      this.client.on('error', () => {
        this.setStatus('ERROR');
      });
      this.client.on('close', () => {
        this.setStatus('DISCONNECTED');
      });

      this.client.subscribe(`${this.topicPrefix}/#`);
      this.setStatus('CONNECTED');
    } catch (err: any) {
      this.setStatus('ERROR');
      throw new Error(`MQTT connection failed: ${err.message}`);
    }
  }

  public handleIncomingMessage(topic: string, message: Buffer | Uint8Array): void {
    const bytes = message instanceof Uint8Array ? message : new Uint8Array(message);

    // 1. Try protobuf ServiceEnvelope
    try {
      const envelope = decodeServiceEnvelope(bytes);
      if (envelope.packet) {
        for (const handler of this.packetHandlers) {
          handler(envelope.packet);
        }
        return;
      }
    } catch {
      // Not a binary ServiceEnvelope
    }

    // 2. Try raw MeshPacket protobuf
    try {
      const packet = decodeMeshPacket(bytes);
      if (packet.from !== 0 || packet.to !== 0) {
        for (const handler of this.packetHandlers) {
          handler(packet);
        }
        return;
      }
    } catch {
      // Not a raw binary MeshPacket
    }

    // 3. Try JSON representation
    try {
      const text = new TextDecoder().decode(bytes);
      const json = JSON.parse(text);
      if (json && typeof json === 'object') {
        const packet: MeshPacket = {
          from: json.from ?? 0,
          to: json.to ?? 0xffffffff,
          channel: json.channel ?? 0,
          id: json.id ?? Math.floor(Math.random() * 0xffffffff),
          hop_limit: json.hops_away ?? 3,
          want_ack: false,
          priority: json.priority ?? 64,
          rx_time: json.payload?.time ?? Math.floor(Date.now() / 1000),
          rx_snr: json.snr,
          rx_rssi: json.rssi
        };
        for (const handler of this.packetHandlers) {
          handler(packet);
        }
      }
    } catch {
      // Ignore unrecognized frame
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.client) {
        if (this.messageListener && this.client.removeListener) {
          this.client.removeListener('message', this.messageListener);
        }
        if (this.client.end) {
          await new Promise<void>((resolve) => {
            this.client!.end!(false, () => resolve());
          });
        }
      }
    } finally {
      this.setStatus('DISCONNECTED');
    }
  }

  public async sendPacket(packet: MeshPacket): Promise<DeliveryResult> {
    if (this.status !== 'CONNECTED') {
      return { success: false, packetId: packet.id, error: 'MQTT transport not connected' };
    }

    try {
      const envelope: ServiceEnvelope = {
        packet,
        channel_id: this.channelId,
        gateway_id: this.gatewayId
      };
      const bytes = encodeServiceEnvelope(envelope);
      const topic = `${this.topicPrefix}/2/e/${this.channelId}/downlink`;

      if (this.client) {
        await new Promise<void>((resolve, reject) => {
          this.client!.publish(topic, bytes, {}, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      return { success: true, packetId: packet.id, latencyMs: 10 };
    } catch (err: any) {
      return { success: false, packetId: packet.id, error: err.message };
    }
  }

  public onPacket(handler: PacketHandler): () => void {
    this.packetHandlers.add(handler);
    return () => this.packetHandlers.delete(handler);
  }

  public onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }
}
