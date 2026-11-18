/**
 * MockMeshTransport for testing and non-hardware environments.
 * Simulates RF delivery, latency, and peer-to-peer packet routing.
 */

import { ILoRaMeshTransport, MeshTransportStatus, DeliveryResult, PacketHandler, StatusHandler } from './interfaces';
import { MeshPacket } from '../protobuf/types';

export class MockMeshTransport implements ILoRaMeshTransport {
  public readonly name = 'MockLoRaTransport (In-Memory Simulation)';
  public readonly transportType = 'mock';

  private status: MeshTransportStatus = 'CONNECTED';
  private packetHandlers = new Set<PacketHandler>();
  private statusHandlers = new Set<StatusHandler>();
  public sentPackets: MeshPacket[] = [];
  public failNextSend = false;
  public simulatedLatencyMs = 5;

  public getStatus(): MeshTransportStatus {
    return this.status;
  }

  public setStatus(newStatus: MeshTransportStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      for (const handler of this.statusHandlers) {
        handler(newStatus);
      }
    }
  }

  public async connect(): Promise<void> {
    this.setStatus('CONNECTED');
  }

  public async disconnect(): Promise<void> {
    this.setStatus('DISCONNECTED');
  }

  public async sendPacket(packet: MeshPacket): Promise<DeliveryResult> {
    if (this.status !== 'CONNECTED') {
      return { success: false, packetId: packet.id, error: 'Transport disconnected' };
    }

    if (this.failNextSend) {
      this.failNextSend = false;
      return { success: false, packetId: packet.id, error: 'Simulated RF transmission failure' };
    }

    this.sentPackets.push(packet);

    if (this.simulatedLatencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.simulatedLatencyMs));
    }

    return {
      success: true,
      packetId: packet.id,
      latencyMs: this.simulatedLatencyMs
    };
  }

  public injectIncomingPacket(packet: MeshPacket): void {
    for (const handler of this.packetHandlers) {
      handler(packet);
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
