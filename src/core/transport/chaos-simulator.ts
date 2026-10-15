/**
 * @fileoverview Chaos Testing Simulator Engine
 * Conforms to FR-024: Simulates internet dropouts, mesh radio noise, packet drops, and replay attacks
 */

import { AuditLogger } from './audit-logger';

export interface ChaosConfig {
  forceOfflineInternet: boolean;
  forceOfflineMesh: boolean;
  packetDropRate: number; // 0 to 1 (e.g. 0.25 = 25% drop)
  latencyMs: number; // added simulated network latency
  batteryOverride: number | null; // null for real battery, or 0-100
}

type ChaosListener = (config: ChaosConfig) => void;

class ChaosSimulatorService {
  private config: ChaosConfig = {
    forceOfflineInternet: false,
    forceOfflineMesh: false,
    packetDropRate: 0,
    latencyMs: 150,
    batteryOverride: null,
  };

  private listeners: Set<ChaosListener> = new Set();
  private storageKey = 'treeline_chaos_config';

  constructor() {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          this.config = { ...this.config, ...JSON.parse(raw) };
        }
      } catch {
        // ignore
      }
    }
  }

  public getConfig(): ChaosConfig {
    return { ...this.config };
  }

  public updateConfig(patch: Partial<ChaosConfig>) {
    this.config = { ...this.config, ...patch };
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.config));
      } catch {
        // ignore
      }
    }
    AuditLogger.log(
      'TRANSPORT',
      `[ХАОС-СИМУЛЯТОР] Обновлены параметры: Интернет=${!this.config.forceOfflineInternet ? 'ВКЛ' : 'ОТКЛ'}, Меш=${!this.config.forceOfflineMesh ? 'ВКЛ' : 'ОТКЛ'}, Потери=${Math.round(this.config.packetDropRate * 100)}%`,
      { config: this.config }
    );
    this.listeners.forEach((l) => l(this.config));
  }

  public shouldDropPacket(): boolean {
    if (this.config.packetDropRate <= 0) return false;
    const drop = Math.random() < this.config.packetDropRate;
    if (drop) {
      AuditLogger.log('TRANSPORT', `[ХАОС-СИМУЛЯТОР] Пакет искусственно сброшен симулятором помех (шанс: ${Math.round(this.config.packetDropRate * 100)}%)`);
    }
    return drop;
  }

  public isInternetAvailable(): boolean {
    if (this.config.forceOfflineInternet) return false;
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  public isMeshAvailable(): boolean {
    return !this.config.forceOfflineMesh;
  }

  public subscribe(listener: ChaosListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const ChaosSimulator = new ChaosSimulatorService();
