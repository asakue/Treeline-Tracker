/**
 * @fileoverview MeshEventBridge: In-Memory Pub/Sub connecting WebSocket to LoRa Transports
 */

import { EventEmitter } from 'events';
import { MeshPacketDTO } from './types.js';

export interface InboundMeshEvent {
  packet: MeshPacketDTO;
  rssi?: number;
  snr?: number;
  transport?: 'webserial' | 'webbluetooth' | 'mqtt' | 'simulation' | string;
}

export interface OutboundMeshEvent {
  packet: MeshPacketDTO;
  isEmergency?: boolean;
}

export class MeshEventBridge extends EventEmitter {
  private static instance: MeshEventBridge;

  public static getInstance(): MeshEventBridge {
    if (!MeshEventBridge.instance) {
      MeshEventBridge.instance = new MeshEventBridge();
    }
    return MeshEventBridge.instance;
  }

  /**
   * Hardware or MQTT bridge emits packet received from RF mesh
   */
  public emitInboundPacket(event: InboundMeshEvent): boolean {
    return this.emit('lora:packet:received', event);
  }

  /**
   * Listen to packets received from RF mesh
   */
  public onInboundPacket(handler: (event: InboundMeshEvent) => void): this {
    return this.on('lora:packet:received', handler);
  }

  /**
   * WebSocket client sends packet to be broadcast over RF mesh
   */
  public emitOutboundPacket(event: OutboundMeshEvent): boolean {
    if (event.isEmergency) {
      this.emit('lora:sos:outbound', event);
    }
    return this.emit('lora:packet:outbound', event);
  }

  /**
   * Transports listen for outbound packets from clients
   */
  public onOutboundPacket(handler: (event: OutboundMeshEvent) => void): this {
    return this.on('lora:packet:outbound', handler);
  }

  public onOutboundSos(handler: (event: OutboundMeshEvent) => void): this {
    return this.on('lora:sos:outbound', handler);
  }
}
