/**
 * In-Memory W3C IndexedDB & CacheStorage Mocks for Node.js
 * Treeline Tracker E2E Test Suite - Opaque-box Test Harness
 * 
 * Provides:
 * - Pure TypeScript in-memory implementation of IDBFactory, IDBDatabase, IDBObjectStore, IDBIndex, IDBTransaction
 * - Priority-aware offline packet queue drainage (ALERT -> HIGH -> NORMAL)
 * - Pure TypeScript CacheStorage & Cache mock for Slippy map tiles
 * - Slippy map coordinate math (lat/lon <-> tile x/y/z)
 * - Offline fallback SVG tile generator (256x256 grid + "OFFLINE" watermark)
 * - Storage quota emulation (navigator.storage.estimate)
 */

export interface TileCoordinate {
  z: number;
  x: number;
  y: number;
}

export interface BoundingBox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

// ============================================================================
// SLIPPY MAP COORDINATE HELPERS
// ============================================================================

export class SlippyMath {
  static lon2tile(lon: number, zoom: number): number {
    return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
  }

  static lat2tile(lat: number, zoom: number): number {
    const rad = (lat * Math.PI) / 180;
    return Math.floor(
      ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
    );
  }

  static tile2lon(x: number, zoom: number): number {
    return (x / Math.pow(2, zoom)) * 360 - 180;
  }

  static tile2lat(y: number, zoom: number): number {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }

  /**
   * Generates all required Slippy tile coordinates for a bounding box at a given zoom level
   */
  static calculateTileBounds(bbox: BoundingBox, zoom: number): TileCoordinate[] {
    const clampedZoom = Math.max(0, Math.min(18, zoom));
    const xMin = SlippyMath.lon2tile(bbox.minLon, clampedZoom);
    const xMax = SlippyMath.lon2tile(bbox.maxLon, clampedZoom);
    const yMin = SlippyMath.lat2tile(bbox.maxLat, clampedZoom);
    const yMax = SlippyMath.lat2tile(bbox.minLat, clampedZoom);

    const tiles: TileCoordinate[] = [];
    const startX = Math.min(xMin, xMax);
    const endX = Math.max(xMin, xMax);
    const startY = Math.min(yMin, yMax);
    const endY = Math.max(yMin, yMax);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        tiles.push({ z: clampedZoom, x, y });
      }
    }
    return tiles;
  }

  /**
   * Generates a 256x256 SVG tile with topographic grid lines and OFFLINE watermark
   */
  static generateSvgTile(z: number, x: number, y: number): Uint8Array {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" fill="#1e293b" />
  <path d="M0 64 H256 M0 128 H256 M0 192 H256 M64 0 V256 M128 0 V256 M192 0 V256" stroke="#334155" stroke-width="1" stroke-dasharray="2,2"/>
  <rect x="2" y="2" width="252" height="252" fill="none" stroke="#475569" stroke-width="1"/>
  <text x="128" y="110" fill="#94a3b8" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">OFFLINE MAP</text>
  <text x="128" y="135" fill="#64748b" font-family="monospace" font-size="11" text-anchor="middle">${z} / ${x} / ${y}</text>
  <text x="128" y="160" fill="#ef4444" font-family="sans-serif" font-size="10" text-anchor="middle">TREELINE TRACKER</text>
</svg>`;
    return new TextEncoder().encode(svg);
  }
}

// ============================================================================
// IN-MEMORY W3C INDEXEDDB MOCK
// ============================================================================

export interface IDBIndexOptions {
  unique?: boolean;
  multiEntry?: boolean;
}

export class MockIDBIndex {
  constructor(
    public name: string,
    public keyPath: string,
    public options: IDBIndexOptions = {},
    private store: MockIDBObjectStore
  ) {}

  get(key: any): any {
    const all = this.store.getAll();
    return all.find((item) => item[this.keyPath] === key);
  }

  getAll(query?: any): any[] {
    const all = this.store.getAll();
    if (query === undefined) return all;
    return all.filter((item) => item[this.keyPath] === query);
  }

  count(): number {
    return this.store.count();
  }
}

export class MockIDBObjectStore {
  private data = new Map<any, any>();
  private indices = new Map<string, MockIDBIndex>();

  constructor(
    public name: string,
    public keyPath?: string,
    public autoIncrement = false
  ) {}

  createIndex(name: string, keyPath: string, options?: IDBIndexOptions): MockIDBIndex {
    const idx = new MockIDBIndex(name, keyPath, options, this);
    this.indices.set(name, idx);
    return idx;
  }

  index(name: string): MockIDBIndex {
    const idx = this.indices.get(name);
    if (!idx) throw new Error(`Index '${name}' not found on store '${this.name}'`);
    return idx;
  }

  put(value: any, key?: any): any {
    const resolvedKey = key !== undefined ? key : (this.keyPath ? value[this.keyPath] : undefined);
    if (resolvedKey === undefined) {
      throw new Error("Key not specified and cannot be derived from keyPath");
    }
    this.data.set(resolvedKey, typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
    return resolvedKey;
  }

  add(value: any, key?: any): any {
    const resolvedKey = key !== undefined ? key : (this.keyPath ? value[this.keyPath] : undefined);
    if (this.data.has(resolvedKey)) {
      throw new Error(`Key '${resolvedKey}' already exists in object store '${this.name}'`);
    }
    return this.put(value, key);
  }

  get(key: any): any {
    const item = this.data.get(key);
    if (!item) return undefined;
    return typeof structuredClone === 'function' ? structuredClone(item) : JSON.parse(JSON.stringify(item));
  }

  delete(key: any): boolean {
    return this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }

  count(): number {
    return this.data.size;
  }

  getAll(): any[] {
    return Array.from(this.data.values()).map((v) =>
      typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v))
    );
  }
}

export class MockIDBDatabase {
  private objectStores = new Map<string, MockIDBObjectStore>();

  constructor(public name: string, public version: number) {}

  createObjectStore(name: string, options?: { keyPath?: string; autoIncrement?: boolean }): MockIDBObjectStore {
    const store = new MockIDBObjectStore(name, options?.keyPath, options?.autoIncrement);
    this.objectStores.set(name, store);
    return store;
  }

  deleteObjectStore(name: string): void {
    this.objectStores.delete(name);
  }

  objectStoreNames(): string[] {
    return Array.from(this.objectStores.keys());
  }

  transaction(storeNames: string | string[], mode = "readonly"): MockIDBTransaction {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    const stores = names.map((n) => {
      const s = this.objectStores.get(n);
      if (!s) throw new Error(`ObjectStore '${n}' does not exist`);
      return s;
    });
    return new MockIDBTransaction(this, stores, mode);
  }

  close(): void {}
}

export class MockIDBTransaction {
  private aborted = false;

  constructor(
    public db: MockIDBDatabase,
    private stores: MockIDBObjectStore[],
    public mode: string
  ) {}

  objectStore(name: string): MockIDBObjectStore {
    if (this.aborted) throw new Error("Transaction is aborted");
    const found = this.stores.find((s) => s.name === name);
    if (!found) throw new Error(`Store '${name}' not part of transaction`);
    return found;
  }

  abort(): void {
    this.aborted = true;
  }

  commit(): void {}
}

export class MockIDBFactory {
  private databases = new Map<string, MockIDBDatabase>();

  open(name: string, version = 1): Promise<MockIDBDatabase> {
    return new Promise((resolve) => {
      let db = this.databases.get(name);
      if (!db) {
        db = new MockIDBDatabase(name, version);
        this.databases.set(name, db);
      }
      resolve(db);
    });
  }

  deleteDatabase(name: string): Promise<void> {
    return new Promise((resolve) => {
      this.databases.delete(name);
      resolve();
    });
  }
}

// ============================================================================
// PRIORITY-AWARE OFFLINE PACKET QUEUE
// ============================================================================

export interface QueuedPacket {
  id: string;
  payload: Uint8Array | string | Record<string, any>;
  priority: number; // e.g. 110 for ALERT, 70 for RELIABLE, 64 for DEFAULT, 10 for BACKGROUND
  timestamp: number;
  attempts: number;
}

export class OfflinePacketQueue {
  private store: MockIDBObjectStore;

  constructor(private db: MockIDBDatabase) {
    if (!db.objectStoreNames().includes("offline_packets")) {
      this.store = db.createObjectStore("offline_packets", { keyPath: "id" });
      this.store.createIndex("priority", "priority");
      this.store.createIndex("timestamp", "timestamp");
    } else {
      const tx = db.transaction("offline_packets", "readwrite");
      this.store = tx.objectStore("offline_packets");
    }
  }

  enqueue(packet: Omit<QueuedPacket, "attempts">): void {
    const item: QueuedPacket = {
      ...packet,
      attempts: 0,
    };
    this.store.put(item);
  }

  dequeue(): QueuedPacket | null {
    const all = this.peekAll();
    if (all.length === 0) return null;
    const top = all[0];
    this.store.delete(top.id);
    return top;
  }

  peekAll(): QueuedPacket[] {
    const all = this.store.getAll() as QueuedPacket[];
    // Sort descending by priority, then ascending by timestamp
    all.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });
    return all;
  }

  size(): number {
    return this.store.count();
  }

  clear(): void {
    this.store.clear();
  }
}

// ============================================================================
// IN-MEMORY W3C CACHESTORAGE & CACHE MOCK
// ============================================================================

export interface MockCacheEntry {
  url: string;
  body: Uint8Array;
  status: number;
  headers: Record<string, string>;
  timestamp: number;
}

export class MockCache {
  private entries = new Map<string, MockCacheEntry>();

  constructor(public name: string) {}

  async put(urlOrRequest: string | { url: string }, response: { status?: number; headers?: Record<string, string>; body: Uint8Array | string }): Promise<void> {
    const url = typeof urlOrRequest === "string" ? urlOrRequest : urlOrRequest.url;
    const bodyBytes = typeof response.body === "string" ? new TextEncoder().encode(response.body) : response.body;

    this.entries.set(url, {
      url,
      body: bodyBytes,
      status: response.status || 200,
      headers: response.headers || { "Content-Type": "image/png" },
      timestamp: Date.now(),
    });
  }

  async match(urlOrRequest: string | { url: string }): Promise<MockCacheEntry | null> {
    const url = typeof urlOrRequest === "string" ? urlOrRequest : urlOrRequest.url;
    const entry = this.entries.get(url);
    if (!entry) return null;
    return { ...entry };
  }

  async delete(urlOrRequest: string | { url: string }): Promise<boolean> {
    const url = typeof urlOrRequest === "string" ? urlOrRequest : urlOrRequest.url;
    return this.entries.delete(url);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.entries.keys());
  }

  async count(): Promise<number> {
    return this.entries.size;
  }

  async totalBytes(): Promise<number> {
    let sum = 0;
    for (const e of this.entries.values()) {
      sum += e.body.length;
    }
    return sum;
  }
}

export class MockCacheStorage {
  private caches = new Map<string, MockCache>();

  async open(cacheName: string): Promise<MockCache> {
    let cache = this.caches.get(cacheName);
    if (!cache) {
      cache = new MockCache(cacheName);
      this.caches.set(cacheName, cache);
    }
    return cache;
  }

  async has(cacheName: string): Promise<boolean> {
    return this.caches.has(cacheName);
  }

  async delete(cacheName: string): Promise<boolean> {
    return this.caches.delete(cacheName);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.caches.keys());
  }

  async match(urlOrRequest: string | { url: string }): Promise<MockCacheEntry | null> {
    for (const cache of this.caches.values()) {
      const match = await cache.match(urlOrRequest);
      if (match) return match;
    }
    return null;
  }
}

// ============================================================================
// STORAGE QUOTA EMULATION
// ============================================================================

export class MockStorageQuotaManager {
  constructor(
    private totalQuotaBytes: number = 500 * 1024 * 1024, // 500 MB
    private currentUsageBytes: number = 0
  ) {}

  setUsage(bytes: number): void {
    this.currentUsageBytes = bytes;
  }

  setQuota(bytes: number): void {
    this.totalQuotaBytes = bytes;
  }

  async estimate(): Promise<{ quota: number; usage: number; available: number }> {
    return {
      quota: this.totalQuotaBytes,
      usage: this.currentUsageBytes,
      available: Math.max(0, this.totalQuotaBytes - this.currentUsageBytes),
    };
  }

  checkQuotaOrThrow(requiredBytes: number): void {
    if (this.currentUsageBytes + requiredBytes > this.totalQuotaBytes) {
      throw new Error(`QUOTA_EXCEEDED: Requested ${requiredBytes} bytes exceeds available quota ${this.totalQuotaBytes - this.currentUsageBytes} bytes`);
    }
  }
}
