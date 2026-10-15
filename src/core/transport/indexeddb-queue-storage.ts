/**
 * @fileoverview IndexedDB Persistence Engine for OfflineQueue
 * Conforms to Requirement 3.1.2 & FR-013/FR-014:
 * Durable, browser-native IndexedDB queue storage with priority ordering
 */

import { TransportPacket } from './interfaces';

const DB_NAME = 'treeline_tracker_db';
const DB_VERSION = 1;
const STORE_PACKETS = 'offline_packets';
const STORE_DEDUP = 'dedup_ids';

export class IndexedDBQueueStorage {
  private static dbPromise: Promise<IDBDatabase | null> | null = null;

  public static isSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
  }

  private static getDB(): Promise<IDBDatabase | null> {
    if (!this.isSupported()) {
      return Promise.resolve(null);
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_PACKETS)) {
            const packetStore = db.createObjectStore(STORE_PACKETS, { keyPath: 'id' });
            packetStore.createIndex('timestamp', 'timestamp', { unique: false });
            packetStore.createIndex('priority', 'priority', { unique: false });
          }
          if (!db.objectStoreNames.contains(STORE_DEDUP)) {
            db.createObjectStore(STORE_DEDUP, { keyPath: 'id' });
          }
        };

        request.onsuccess = (event) => {
          resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = (e) => {
          console.warn('IndexedDB initialization failed, falling back to LocalStorage:', e);
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB open error:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  public static async putPacket(packet: TransportPacket): Promise<void> {
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_PACKETS, 'readwrite');
        const store = tx.objectStore(STORE_PACKETS);
        const req = store.put(packet);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  public static async removePacket(packetId: string): Promise<void> {
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_PACKETS, 'readwrite');
        const store = tx.objectStore(STORE_PACKETS);
        const req = store.delete(packetId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  public static async getAllPackets(): Promise<TransportPacket[]> {
    const db = await this.getDB();
    if (!db) return [];

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_PACKETS, 'readonly');
        const store = tx.objectStore(STORE_PACKETS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  public static async putDedupId(packetId: string): Promise<void> {
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_DEDUP, 'readwrite');
        const store = tx.objectStore(STORE_DEDUP);
        store.put({ id: packetId, timestamp: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  public static async getAllDedupIds(): Promise<string[]> {
    const db = await this.getDB();
    if (!db) return [];

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_DEDUP, 'readonly');
        const store = tx.objectStore(STORE_DEDUP);
        const req = store.getAll();
        req.onsuccess = () => {
          const items = (req.result || []) as Array<{ id: string }>;
          resolve(items.map((i) => i.id));
        };
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  public static async clearAll(): Promise<void> {
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_PACKETS, STORE_DEDUP], 'readwrite');
        tx.objectStore(STORE_PACKETS).clear();
        tx.objectStore(STORE_DEDUP).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}
