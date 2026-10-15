/**
 * @fileoverview TransportManager Orchestrator
 * Conforms to FR-010: Transparent channel selection (Internet -> MeshCore -> OfflineQueue)
 * and FR-014: Automatic queue flushing on reconnection
 */

import { ITransport, TransportPacket, TransportStatus } from './interfaces';
import { InternetTransport } from './internet-transport';
import { MockMeshCoreTransport } from './meshcore-transport';
import { OfflineQueue } from './offline-queue';
import { ChaosSimulator } from './chaos-simulator';
import { AuditLogger } from './audit-logger';

type StatusListener = (status: TransportStatus) => void;

class TransportManagerService {
  private internetTransport = new InternetTransport();
  private meshCoreTransport = new MockMeshCoreTransport();
  private offlineQueue = new OfflineQueue();

  private totalPacketsSent = 0;
  private totalPacketsDropped = 0;
  private lastTransmissionTimestamp?: number;
  private isFlushing = false;
  private listeners: Set<StatusListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange());
      window.addEventListener('offline', () => this.handleNetworkChange());
    }
    ChaosSimulator.subscribe(() => this.handleNetworkChange());
  }

  private handleNetworkChange() {
    this.notifyStatus();
    // If internet or mesh became available, flush offline queue
    if (ChaosSimulator.isInternetAvailable() || ChaosSimulator.isMeshAvailable()) {
      this.flushQueue();
    }
  }

  public getStatus(): TransportStatus {
    const isInternetOnline = ChaosSimulator.isInternetAvailable();
    const isMeshOnline = ChaosSimulator.isMeshAvailable();

    let activeChannel: TransportStatus['activeChannel'] = 'OFFLINE_QUEUE';
    if (isInternetOnline) {
      activeChannel = 'INTERNET';
    } else if (isMeshOnline) {
      activeChannel = 'MESH_CORE';
    }

    return {
      activeChannel,
      isInternetOnline,
      isMeshOnline,
      queuedCount: this.offlineQueue.count(),
      totalPacketsSent: this.totalPacketsSent,
      totalPacketsDropped: this.totalPacketsDropped,
      lastTransmissionTimestamp: this.lastTransmissionTimestamp,
      meshSignalDbm: isMeshOnline ? -82 : undefined,
    };
  }

  public async sendPacket(packet: Omit<TransportPacket, 'id' | 'createdAt'>): Promise<{
    delivered: boolean;
    channel: 'INTERNET' | 'MESH_CORE' | 'OFFLINE_QUEUE';
    error?: string;
  }> {
    const fullPacket: TransportPacket = {
      ...packet,
      id: `pkt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
    };

    // 1. Try Internet Transport (Primary)
    if (await this.internetTransport.isAvailable()) {
      const result = await this.internetTransport.send(fullPacket);
      if (result.success) {
        this.totalPacketsSent++;
        this.lastTransmissionTimestamp = Date.now();
        this.notifyStatus();
        return { delivered: true, channel: 'INTERNET' };
      }
      // If internet send failed, fall through to Mesh
      AuditLogger.log(
        'TRANSPORT',
        `[ОТКАЗОУСТОЙЧИВОСТЬ] Интернет-канал дал сбой (${result.error || 'таймаут'}), переключение на MeshCore`
      );
    }

    // 2. Try MeshCore Transport (Secondary)
    if (await this.meshCoreTransport.isAvailable()) {
      const meshResult = await this.meshCoreTransport.send(fullPacket);
      if (meshResult.success) {
        this.totalPacketsSent++;
        this.lastTransmissionTimestamp = Date.now();
        this.notifyStatus();
        return { delivered: true, channel: 'MESH_CORE' };
      }
      AuditLogger.log(
        'TRANSPORT',
        `[ОТКАЗОУСТОЙЧИВОСТЬ] Радиоканал MeshCore недоступен (${meshResult.error || 'помехи'}), перевод пакета в оффлайн-буфер`
      );
    }

    // 3. Fallback to Persistent Offline Store-and-Forward Queue
    const enqueued = this.offlineQueue.enqueue(fullPacket);
    if (!enqueued) {
      this.totalPacketsDropped++;
    }
    this.notifyStatus();
    return { delivered: false, channel: 'OFFLINE_QUEUE' };
  }

  private currentFlushPromise: Promise<number> | null = null;

  public async flushQueue(): Promise<number> {
    if (this.currentFlushPromise) {
      return this.currentFlushPromise;
    }

    const pending = this.offlineQueue.getPendingPackets();
    if (pending.length === 0) return 0;

    this.isFlushing = true;

    this.currentFlushPromise = (async () => {
      let flushedCount = 0;
      try {
        AuditLogger.log(
          'TRANSPORT',
          `[ОФФЛАЙН-СИНХРОНИЗАЦИЯ] Начат сброс оффлайн-очереди (${pending.length} пакетов)...`
        );

        for (const packet of pending) {
          let sent = false;

          if (await this.internetTransport.isAvailable()) {
            const res = await this.internetTransport.send(packet);
            if (res.success) sent = true;
          }

          if (!sent && (await this.meshCoreTransport.isAvailable())) {
            const res = await this.meshCoreTransport.send(packet);
            if (res.success) sent = true;
          }

          if (sent) {
            this.offlineQueue.markAsDelivered(packet.id);
            this.totalPacketsSent++;
            flushedCount++;
          } else {
            // Stop flushing if all channels failed
            break;
          }
        }
      } finally {
        this.isFlushing = false;
        this.currentFlushPromise = null;
        this.lastTransmissionTimestamp = Date.now();
        this.notifyStatus();
      }

      if (flushedCount > 0) {
        AuditLogger.log(
          'TRANSPORT',
          `[ОФФЛАЙН-СИНХРОНИЗАЦИЯ] Успешно синхронизировано ${flushedCount} пакетов из очереди. Остаток: ${this.offlineQueue.count()}`
        );
      }

      return flushedCount;
    })();

    return this.currentFlushPromise;
  }

  public getOfflineQueueCount(): number {
    return this.offlineQueue.count();
  }

  public clearQueue() {
    this.offlineQueue.clear();
    this.notifyStatus();
  }

  public subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private notifyStatus() {
    const status = this.getStatus();
    this.listeners.forEach((l) => {
      try {
        l(status);
      } catch {
        // ignore
      }
    });
  }
}

export const TransportManager = new TransportManagerService();
