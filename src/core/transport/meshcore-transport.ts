/**
 * @fileoverview MockMeshCoreTransport (LoRa Mesh Simulation)
 * Conforms to FR-012 and ADR-004: Simulates transmission over decentralized LoRa / 868MHz packet mesh
 */

import { ITransport, TransportPacket } from './interfaces';
import { ChaosSimulator } from './chaos-simulator';
import { AuditLogger } from './audit-logger';

export class MockMeshCoreTransport implements ITransport {
  public readonly name = 'MeshCore (LoRa 868MHz)';

  public async isAvailable(): Promise<boolean> {
    return ChaosSimulator.isMeshAvailable();
  }

  public async send(
    packet: TransportPacket
  ): Promise<{ success: boolean; error?: string; latencyMs?: number }> {
    if (!ChaosSimulator.isMeshAvailable()) {
      return { success: false, error: 'Радиомодем MeshCore выключен или находится в мертвой зоне' };
    }

    if (ChaosSimulator.shouldDropPacket()) {
      return { success: false, error: 'Коллизия радиопакета в эфире LoRa Mesh' };
    }

    // Simulate mesh propagation delay (5ms in test mode, 250ms - 600ms in field runtime)
    const hops = Math.floor(Math.random() * 3) + 1;
    const rssi = -70 - Math.floor(Math.random() * 35); // -70 to -105 dBm
    const latencyMs = process.env.NODE_ENV === 'test' ? 5 : hops * (150 + Math.floor(Math.random() * 100));

    await new Promise((resolve) => setTimeout(resolve, latencyMs));

    AuditLogger.log(
      'TRANSPORT',
      `[MESH-CORE] Пакет ${packet.id.slice(0, 8)} успешно ретранслирован через ${hops} хоп(а). RSSI: ${rssi} dBm, задержка: ${latencyMs}мс`,
      { packetId: packet.id, hops, rssi, type: packet.type }
    );

    return { success: true, latencyMs };
  }
}
