/**
 * WebSocket Test Client for Treeline Tracker E2E Testing
 * Treeline Tracker - Opaque-box Test Harness
 * 
 * Provides:
 * - Room pub/sub (`team:<id>`, `emergency:broadcast`, `mesh:channel:<id>`)
 * - Message queueing and deterministic predicate matching (`waitForMessage`, `collectMessages`)
 * - Inbound and outbound message assertion helpers
 * - Close code tracking (e.g. 4401 on auth failure, 1009 on oversized payload)
 */

export class TestWebSocketClient {
  private ws: any;
  private messageQueue: any[] = [];
  private messageListeners: Array<(msg: any) => void> = [];
  public lastCloseCode?: number;
  public lastCloseReason?: string;
  private _isOpen = false;

  constructor(private wsUrl = 'ws://127.0.0.1:3001/ws') {}

  get isOpen(): boolean {
    return this._isOpen;
  }

  async connect(options: { token?: string; timeoutMs?: number } = {}): Promise<void> {
    const timeout = options.timeoutMs || 4000;
    let url = this.wsUrl;
    if (options.token) {
      url += (url.includes('?') ? '&' : '?') + `token=${encodeURIComponent(options.token)}`;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`WebSocket connection to ${url} timed out after ${timeout}ms`));
      }, timeout);

      try {
        // Node v26 provides global WebSocket
        const WSClass = (globalThis as any).WebSocket;
        if (!WSClass) {
          throw new Error('globalThis.WebSocket is not defined in this Node.js runtime');
        }

        this.ws = new WSClass(url);

        this.ws.onopen = () => {
          clearTimeout(timer);
          this._isOpen = true;
          resolve();
        };

        this.ws.onmessage = (event: any) => {
          try {
            const raw = typeof event.data === 'string' ? event.data : event.data.toString();
            const parsed = JSON.parse(raw);
            this.messageQueue.push(parsed);
            for (const listener of this.messageListeners) {
              listener(parsed);
            }
          } catch (e) {
            // Raw binary or unparsed text
            this.messageQueue.push(event.data);
          }
        };

        this.ws.onclose = (event: any) => {
          clearTimeout(timer);
          this._isOpen = false;
          this.lastCloseCode = event.code;
          this.lastCloseReason = event.reason;
        };

        this.ws.onerror = (err: any) => {
          clearTimeout(timer);
          // If not open yet, reject
          if (!this._isOpen) {
            reject(new Error(`WebSocket error: ${err.message || 'connection failed'}`));
          }
        };
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  send(data: any): void {
    if (!this.ws || this.ws.readyState !== 1) {
      throw new Error('WebSocket is not open');
    }
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    this.ws.send(payload);
  }

  sendAuth(token: string): void {
    this.send({ type: 'AUTH', token });
  }

  async subscribe(channels: string | string[]): Promise<any> {
    const channelList = Array.isArray(channels) ? channels : [channels];
    this.send({ type: 'SUBSCRIBE', channels: channelList });
    return this.waitForMessage((m) => m.type === 'SUBSCRIBED', 3000);
  }

  sendTelemetry(coords: { latitude: number; longitude: number; altitude?: number; battery?: number }): void {
    this.send({
      type: 'SEND_TELEMETRY',
      ...coords,
    });
  }

  sendChat(channelId: string, text: string, recipientNodeNum?: number): void {
    this.send({
      type: 'SEND_CHAT',
      channelId,
      text,
      recipientNodeNum,
    });
  }

  sendSos(sos: { emergencyType: string; latitude: number; longitude: number; notes?: string }): void {
    this.send({
      type: 'SEND_SOS',
      ...sos,
    });
  }

  sendPing(): void {
    this.send({ type: 'PING' });
  }

  waitForMessage<T = any>(predicate: (msg: any) => boolean, timeoutMs = 3000): Promise<T> {
    // Check existing queue first
    for (let i = 0; i < this.messageQueue.length; i++) {
      if (predicate(this.messageQueue[i])) {
        const found = this.messageQueue.splice(i, 1)[0];
        return Promise.resolve(found as T);
      }
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`waitForMessage timed out after ${timeoutMs}ms waiting for matching frame`));
      }, timeoutMs);

      const listener = (msg: any) => {
        if (predicate(msg)) {
          cleanup();
          resolve(msg as T);
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.messageListeners = this.messageListeners.filter((l) => l !== listener);
      };

      this.messageListeners.push(listener);
    });
  }

  async collectMessages(predicate: (msg: any) => boolean, durationMs = 500): Promise<any[]> {
    const matched: any[] = [];
    const remainingQueue: any[] = [];

    for (const msg of this.messageQueue) {
      if (predicate(msg)) matched.push(msg);
      else remainingQueue.push(msg);
    }
    this.messageQueue = remainingQueue;

    const listener = (msg: any) => {
      if (predicate(msg)) matched.push(msg);
    };

    this.messageListeners.push(listener);
    await new Promise((r) => setTimeout(r, durationMs));
    this.messageListeners = this.messageListeners.filter((l) => l !== listener);

    return matched;
  }

  clearQueue(): void {
    this.messageQueue = [];
  }

  async close(): Promise<void> {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (_) {}
    }
    this._isOpen = false;
  }
}
