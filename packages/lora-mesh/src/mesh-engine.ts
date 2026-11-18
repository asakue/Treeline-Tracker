/**
 * LoRaMeshEngine: Central multiplexer and event dispatcher for Meshtastic networks.
 * Connects hardware transports, maintains NodeDB, rejects duplicate packets, and routes application messages.
 */

import { ILoRaMeshTransport, DeliveryResult, MeshTransportStatus } from './transports/interfaces';
import { MeshPacket, PortNum, PacketPriority, NODENUM_BROADCAST } from './protobuf/types';
import { PacketDeduplicator } from './routing/packet-deduplicator';
import { NodeDB } from './routing/node-db';
import { decodePosition } from './protobuf/position';
import { decodeUser, decodeNodeInfo } from './protobuf/user';
import { decodeTelemetry } from './protobuf/telemetry';
import { decodeWaypoint } from './protobuf/waypoint';
import { decodeChatMessage, buildChatPacket } from './codec/chat-codec';
import { buildPositionPacket, decodeGps, DecodedGps } from './codec/gps-codec';
import { DistressCodec, SosBeaconOptions, ParsedSosAlert } from './codec/distress-codec';

export type MeshEngineEventHandler<T> = (data: T) => void;

export interface LoRaMeshEngineOptions {
  myNodeNum?: number;
  transports?: ILoRaMeshTransport[];
  dedupWindowMs?: number;
}

export class LoRaMeshEngine {
  public myNodeNum: number;
  public readonly nodeDb = new NodeDB();
  public readonly deduplicator: PacketDeduplicator;

  private transports = new Map<string, ILoRaMeshTransport>();
  private unsubscribeMap = new Map<string, () => void>();

  // Event Listeners
  private packetListeners = new Set<MeshEngineEventHandler<MeshPacket>>();
  private chatListeners = new Set<MeshEngineEventHandler<{ from: number; to: number; text: string; packet: MeshPacket }>>();
  private positionListeners = new Set<MeshEngineEventHandler<{ from: number; position: DecodedGps; packet: MeshPacket }>>();
  private distressListeners = new Set<MeshEngineEventHandler<{ from: number; alert: ParsedSosAlert; packet: MeshPacket }>>();
  private nodeUpdateListeners = new Set<MeshEngineEventHandler<{ from: number; packet: MeshPacket }>>();
  private statusListeners = new Set<MeshEngineEventHandler<{ transportName: string; status: MeshTransportStatus }>>();

  constructor(options: LoRaMeshEngineOptions = {}) {
    this.myNodeNum = options.myNodeNum ?? Math.floor(Math.random() * 0xffffffff);
    this.deduplicator = new PacketDeduplicator(options.dedupWindowMs ?? 30000);

    if (options.transports) {
      for (const t of options.transports) {
        this.addTransport(t);
      }
    }
  }

  public addTransport(transport: ILoRaMeshTransport): void {
    this.transports.set(transport.name, transport);

    const unsubPacket = transport.onPacket((packet) => {
      this.handleIncomingPacket(packet, transport.name);
    });

    let unsubStatus: (() => void) | undefined;
    if (transport.onStatusChange) {
      unsubStatus = transport.onStatusChange((status) => {
        for (const listener of this.statusListeners) {
          listener({ transportName: transport.name, status });
        }
      });
    }

    this.unsubscribeMap.set(transport.name, () => {
      unsubPacket();
      if (unsubStatus) unsubStatus();
    });
  }

  public removeTransport(name: string): boolean {
    const unsub = this.unsubscribeMap.get(name);
    if (unsub) {
      unsub();
      this.unsubscribeMap.delete(name);
    }
    return this.transports.delete(name);
  }

  public getTransports(): ILoRaMeshTransport[] {
    return Array.from(this.transports.values());
  }

  public async connectAll(): Promise<void> {
    for (const t of this.transports.values()) {
      try {
        await t.connect();
      } catch {
        // Continue attempting other transports
      }
    }
  }

  public async disconnectAll(): Promise<void> {
    for (const t of this.transports.values()) {
      await t.disconnect().catch(() => {});
    }
  }

  public handleIncomingPacket(packet: MeshPacket, sourceTransport?: string): void {
    // 1. Packet Deduplication
    if (this.deduplicator.isDuplicate(packet)) {
      return; // Reject flood duplicates
    }

    // 2. Update Node Database
    this.nodeDb.updateFromPacket(packet);

    // 3. Emit raw packet
    for (const listener of this.packetListeners) {
      listener(packet);
    }

    // 4. Check for High-Priority Distress / SOS
    if (DistressCodec.isDistressPacket(packet)) {
      const alert = DistressCodec.parseSosPacket(packet);
      if (alert) {
        for (const listener of this.distressListeners) {
          listener({ from: packet.from, alert, packet });
        }
      }
    }

    // 5. Decode application payload if present
    if (packet.decoded) {
      this.routeApplicationPayload(packet);
    }
  }

  private routeApplicationPayload(packet: MeshPacket): void {
    const { portnum, payload } = packet.decoded!;

    switch (portnum) {
      case PortNum.TEXT_MESSAGE_APP: {
        const text = decodeChatMessage(payload);
        for (const listener of this.chatListeners) {
          listener({ from: packet.from, to: packet.to, text, packet });
        }
        break;
      }

      case PortNum.POSITION_APP: {
        try {
          const rawPos = decodePosition(payload);
          this.nodeDb.updatePosition(packet.from, rawPos);
          const decodedGps = decodeGps(rawPos);
          for (const listener of this.positionListeners) {
            listener({ from: packet.from, position: decodedGps, packet });
          }
        } catch {
          // ignore corrupted position payload
        }
        break;
      }

      case PortNum.NODEINFO_APP: {
        try {
          const user = decodeUser(payload);
          this.nodeDb.updateUser(packet.from, user);
          for (const listener of this.nodeUpdateListeners) {
            listener({ from: packet.from, packet });
          }
        } catch {
          // ignore corrupted user payload
        }
        break;
      }

      case PortNum.TELEMETRY_APP: {
        try {
          const telemetry = decodeTelemetry(payload);
          this.nodeDb.updateTelemetry(packet.from, telemetry);
          for (const listener of this.nodeUpdateListeners) {
            listener({ from: packet.from, packet });
          }
        } catch {
          // ignore corrupted telemetry payload
        }
        break;
      }

      case PortNum.WAYPOINT_APP: {
        try {
          const wp = decodeWaypoint(payload);
          // Waypoints can also update map points
        } catch {
          // ignore
        }
        break;
      }
    }
  }

  public async sendPacket(packet: MeshPacket): Promise<DeliveryResult> {
    const connectedTransports = Array.from(this.transports.values()).filter(
      (t) => t.getStatus() === 'CONNECTED'
    );

    if (connectedTransports.length === 0) {
      return { success: false, packetId: packet.id, error: 'No connected transports available' };
    }

    // High priority SOS or broadcast to all active transports
    let lastResult: DeliveryResult = { success: false, packetId: packet.id };
    for (const t of connectedTransports) {
      const res = await t.sendPacket(packet);
      if (res.success) {
        lastResult = res;
      }
    }

    return lastResult;
  }

  public async sendChat(text: string, toNode: number = NODENUM_BROADCAST): Promise<DeliveryResult> {
    const packet = buildChatPacket(this.myNodeNum, toNode, text);
    return this.sendPacket(packet);
  }

  public async sendPosition(latitude: number, longitude: number, altitude?: number): Promise<DeliveryResult> {
    const packet = buildPositionPacket(this.myNodeNum, NODENUM_BROADCAST, latitude, longitude, altitude);
    return this.sendPacket(packet);
  }

  public async sendDistress(
    options: Omit<SosBeaconOptions, 'fromNode'>
  ): Promise<{ textResult: DeliveryResult; positionResult: DeliveryResult }> {
    const beacon = DistressCodec.buildSosBeacon({
      ...options,
      fromNode: this.myNodeNum
    });

    const textResult = await this.sendPacket(beacon.textPacket);
    const positionResult = await this.sendPacket(beacon.positionPacket);

    return { textResult, positionResult };
  }

  // Event Subscription Helpers
  public onPacket(handler: MeshEngineEventHandler<MeshPacket>): () => void {
    this.packetListeners.add(handler);
    return () => this.packetListeners.delete(handler);
  }

  public onChat(
    handler: MeshEngineEventHandler<{ from: number; to: number; text: string; packet: MeshPacket }>
  ): () => void {
    this.chatListeners.add(handler);
    return () => this.chatListeners.delete(handler);
  }

  public onPosition(
    handler: MeshEngineEventHandler<{ from: number; position: DecodedGps; packet: MeshPacket }>
  ): () => void {
    this.positionListeners.add(handler);
    return () => this.positionListeners.delete(handler);
  }

  public onDistress(
    handler: MeshEngineEventHandler<{ from: number; alert: ParsedSosAlert; packet: MeshPacket }>
  ): () => void {
    this.distressListeners.add(handler);
    return () => this.distressListeners.delete(handler);
  }

  public onNodeUpdate(handler: MeshEngineEventHandler<{ from: number; packet: MeshPacket }>): () => void {
    this.nodeUpdateListeners.add(handler);
    return () => this.nodeUpdateListeners.delete(handler);
  }

  public onStatus(
    handler: MeshEngineEventHandler<{ transportName: string; status: MeshTransportStatus }>
  ): () => void {
    this.statusListeners.add(handler);
    return () => this.statusListeners.delete(handler);
  }
}
