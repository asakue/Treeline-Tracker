/**
 * @fileoverview Offline Store-and-Forward Queue
 * Conforms to FR-013 & FR-014: Persistent queuing and automatic deduplication upon reconnection
 */

import { TransportPacket } from './interfaces';
import { AuditLogger } from './audit-logger';

const QUEUE_STORAGE_KEY = 'treeline_offline_packet_queue';
const DEDUP_CACHE_KEY = 'treeline_dedup_packet_ids';
const MAX_QUEUE_SIZE = 300;

export class OfflineQueue {
  private queue: TransportPacket[] = [];
  private sentPacketIds: Set<string> = new Set();

  constructor() {
    this.load();
  }

  private isClient(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private load() {
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
      console.warn('Failed to load offline queue:', e);
    }
  }

  private persist() {
    if (!this.isClient()) return;
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
      localStorage.setItem(
        DEDUP_CACHE_KEY,
        JSON.stringify(Array.from(this.sentPacketIds).slice(-500))
      );
    } catch (e) {
      console.warn('Failed to persist offline queue:', e);
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
        this.queue.splice(normalIndex, 1);
      } else {
        this.queue.pop();
      }
    }

    this.persist();
    AuditLogger.log(
      'TRANSPORT',
      `[ОФФЛАЙН-ОЧЕРЕДЬ] Пакет ${packet.id} (${packet.type}) помещен в оффлайн-буфер. В очереди: ${this.queue.length}`
    );
    return true;
  }

  public markAsDelivered(packetId: string) {
    this.queue = this.queue.filter((p) => p.id !== packetId);
    this.sentPacketIds.add(packetId);
    this.persist();
  }

  public getPendingPackets(): TransportPacket[] {
    return [...this.queue];
  }

  public count(): number {
    return this.queue.length;
  }

  public clear() {
    this.queue = [];
    this.persist();
  }
}
