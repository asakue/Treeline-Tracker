/**
 * Packet Deduplicator for LoRa Mesh.
 * Uses a sliding window ring buffer cache (from, packetId) to reject duplicate flood packets.
 */

import { MeshPacket } from '../protobuf/types';

export class PacketDeduplicator {
  private cache = new Map<string, number>(); // key -> timestamp ms
  private windowMs: number;
  private maxEntries: number;

  constructor(windowMs = 30000, maxEntries = 1000) {
    this.windowMs = windowMs;
    this.maxEntries = maxEntries;
  }

  public isDuplicate(packet: MeshPacket): boolean {
    const key = `${packet.from}:${packet.id}`;
    const now = Date.now();

    const existingTime = this.cache.get(key);
    if (existingTime !== undefined && now - existingTime < this.windowMs) {
      return true; // Duplicate!
    }

    // Evict old entries if size limit exceeded
    if (this.cache.size >= this.maxEntries) {
      this.purgeExpired(now);
      if (this.cache.size >= this.maxEntries) {
        // Drop oldest key
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, now);
    return false;
  }

  public purgeExpired(now = Date.now()): void {
    const cutoff = now - this.windowMs;
    for (const [key, timestamp] of this.cache.entries()) {
      if (timestamp < cutoff) {
        this.cache.delete(key);
      }
    }
  }

  public clear(): void {
    this.cache.clear();
  }

  public get size(): number {
    return this.cache.size;
  }
}
