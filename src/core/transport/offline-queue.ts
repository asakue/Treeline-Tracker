/**
 * @fileoverview Offline Store-and-Forward Queue with IndexedDB & LocalStorage
 * Conforms to FR-013 & FR-014: Persistent queuing (IndexedDB/LocalStorage) and
 * automatic deduplication upon reconnection.
 */

import { TransportPacket } from './interfaces';
import { AuditLogger } from './audit-logger';
import { IndexedDBQueueStorage } from './indexeddb-queue-storage';

const QUEUE_STORAGE_KEY = 'treeline_offline_packet_queue';
const DEDUP_CACHE_KEY = 'treeline_dedup_packet_ids';
const MAX_QUEUE_SIZE = 300;

export class OfflineQueue {
  private queue: TransportPacket[] = [];
  private sentPacketIds: Set<string> = new Set();
  private isHydratedFromIndexedDB = false;

  constructor() {
    this.loadFromLocalStorage();
    this.hydrateFromIndexedDB();
  }

  private isClient(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private loadFromLocalStorage() {
    if (!this.isClient()) return;
    try {
      const rawQueue = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (rawQueue) {
        this.queue = JSON.parse(rawQueue);
      }
      const rawDedup = localStorage.getItem(DEDUP_CACHE_KEY);
      if (rawDedup) {
        const arr = JSON.parse(rawDedup);
        this.sentPacketIds = new Set(arr);
      }
    } catch (e) {
      console.warn('Failed to load offline queue from LocalStorage:', e);
    }
  }

  private async hydrateFromIndexedDB() {
    if (!IndexedDBQueueStorage.isSupported()) return;

    try {
      const [idbPackets, idbDedupIds] = await Promise.all([
        IndexedDBQueueStorage.getAllPackets(),
        IndexedDBQueueStorage.getAllDedupIds(),
      ]);

      if (idbPackets.length > 0) {
        // Merge with existing queue without duplicates
        const existingIds = new Set(this.queue.map((p) => p.id));
        for (const p of idbPackets) {
          if (!existingIds.has(p.id)) {
            this.queue.push(p);
            existingIds.add(p.id);
          }
        }
        // Ensure priority ordering (EMERGENCY_SOS first)
        this.queue.sort((a, b) => {
          if (a.priority === 'EMERGENCY_SOS' && b.priority !== 'EMERGENCY_SOS') return -1;
          if (b.priority === 'EMERGENCY_SOS' && a.priority !== 'EMERGENCY_SOS') return 1;
          return a.timestamp - b.timestamp;
        });
      }

      for (const id of idbDedupIds) {
        this.sentPacketIds.add(id);
      }

      this.isHydratedFromIndexedDB = true;
      this.persistToLocalStorage();
    } catch (err) {
      console.warn('Failed to hydrate offline queue from IndexedDB:', err);
    }
  }

  private persistToLocalStorage() {
    if (!this.isClient()) return;
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
      localStorage.setItem(
        DEDUP_CACHE_KEY,
        JSON.stringify(Array.from(this.sentPacketIds).slice(-500))
      );
    } catch (e) {
      console.warn('Failed to persist offline queue to LocalStorage:', e);
    }
  }

  public enqueue(packet: TransportPacket): boolean {
    // Deduplication check
    if (this.sentPacketIds.has(packet.id)) {
      AuditLogger.log(
        'SECURITY',
        `[ОФФЛАЙН-ОЧЕРЕДЬ] Дубликат пакета ${packet.id} проигнорирован (Anti-Replay / Dedup)`
      );
      return false;
    }

    // Check if already in queue
    if (this.queue.some((p) => p.id === packet.id)) {
      return false;
    }

    // High/Emergency priority items jump to front of queue
    if (packet.priority === 'EMERGENCY_SOS') {
      this.queue.unshift(packet);
    } else {
      this.queue.push(packet);
    }

    if (this.queue.length > MAX_QUEUE_SIZE) {
      // Remove oldest normal priority packets
      const normalIndex = this.queue.findIndex((p) => p.priority === 'NORMAL');
      if (normalIndex >= 0) {
        const removed = this.queue.splice(normalIndex, 1)[0];
        if (removed) {
          IndexedDBQueueStorage.removePacket(removed.id).catch(() => {});
        }
      } else {
        const removed = this.queue.pop();
        if (removed) {
          IndexedDBQueueStorage.removePacket(removed.id).catch(() => {});
        }
      }
    }

    this.persistToLocalStorage();
    IndexedDBQueueStorage.putPacket(packet).catch(() => {});

    AuditLogger.log(
      'TRANSPORT',
      `[ОФФЛАЙН-ОЧЕРЕДЬ (IndexedDB)] Пакет ${packet.id} (${packet.type}, ${packet.priority}) помещен в оффлайн-буфер. В очереди: ${this.queue.length}`
    );
    return true;
  }

  public markAsDelivered(packetId: string) {
    this.queue = this.queue.filter((p) => p.id !== packetId);
    this.sentPacketIds.add(packetId);

    this.persistToLocalStorage();
    IndexedDBQueueStorage.removePacket(packetId).catch(() => {});
    IndexedDBQueueStorage.putDedupId(packetId).catch(() => {});
  }

  public getPendingPackets(): TransportPacket[] {
    return [...this.queue];
  }

  public count(): number {
    return this.queue.length;
  }

  public clear() {
    this.queue = [];
    this.persistToLocalStorage();
    IndexedDBQueueStorage.clearAll().catch(() => {});
  }
}
