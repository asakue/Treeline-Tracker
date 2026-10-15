/**
 * @fileoverview Real-Time Audit Event Logger
 * Conforms to FR-025: Transparent event audit stream [GPS], [SECURITY], [TRANSPORT], [OCC], [SOS], [AUTH]
 */

import { AuditLogEntry } from '../domain/types';

type AuditListener = (entry: AuditLogEntry) => void;

class AuditLoggerService {
  private entries: AuditLogEntry[] = [];
  private listeners: Set<AuditListener> = new Set();
  private maxEntries = 500;
  private storageKey = 'treeline_audit_log';

  constructor() {
    this.loadFromStorage();
  }

  private isClient(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private loadFromStorage() {
    if (!this.isClient()) return;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.entries = parsed.slice(-this.maxEntries);
        }
      }
    } catch {
      // Ignore parse failure
    }
  }

  private persist() {
    if (!this.isClient()) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.entries.slice(-200)));
    } catch {
      // Ignore quota error
    }
  }

  public log(
    category: AuditLogEntry['category'],
    message: string,
    details?: Record<string, unknown>
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      category,
      message,
      details,
    };

    this.entries.unshift(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }

    this.persist();
    this.notify(entry);
    return entry;
  }

  public getEntries(category?: AuditLogEntry['category']): AuditLogEntry[] {
    if (category) {
      return this.entries.filter((e) => e.category === category);
    }
    return [...this.entries];
  }

  public clear() {
    this.entries = [];
    if (this.isClient()) {
      localStorage.removeItem(this.storageKey);
    }
    this.log('AUTH', 'Журнал аудита очищен оператором');
  }

  public subscribe(listener: AuditListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(entry: AuditLogEntry) {
    this.listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch (e) {
        console.warn('Audit listener error:', e);
      }
    });
  }
}

export const AuditLogger = new AuditLoggerService();
