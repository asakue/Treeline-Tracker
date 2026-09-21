/**
 * @fileoverview LocalStorage / In-Memory Implementation of ILocationRepository
 * Stores location telemetry and GPS tracking history.
 */

import type { ILocationRepository } from './interfaces';
import type { LocationUpdate } from '../domain/types';
import { LocationUpdateSchema } from '../domain/schemas';

const LOCATION_HISTORY_KEY = 'hiker_location_history';
const MAX_HISTORY_POINTS_PER_HIKER = 1000;

export class LocalStorageLocationRepository implements ILocationRepository {
  private isClient(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  async getLastKnownLocation(hikerId: string): Promise<LocationUpdate | null> {
    const history = await this.getLocationHistory(hikerId);
    if (history.length === 0) return null;
    return history[history.length - 1];
  }

  async saveLocation(location: LocationUpdate): Promise<void> {
    const validated = LocationUpdateSchema.parse(location);
    if (!this.isClient()) return;

    try {
      const allHistory = this.getAllHistoryMap();
      const hikerHistory = allHistory[validated.hikerId] || [];

      // Append new point and trim to max limit
      const updatedHikerHistory = [...hikerHistory, validated].slice(-MAX_HISTORY_POINTS_PER_HIKER);
      allHistory[validated.hikerId] = updatedHikerHistory;

      localStorage.setItem(LOCATION_HISTORY_KEY, JSON.stringify(allHistory));
    } catch (err) {
      console.error('Failed to save location point:', err);
    }
  }

  async getLocationHistory(hikerId: string, sinceTimestamp?: number): Promise<LocationUpdate[]> {
    if (!this.isClient()) return [];

    try {
      const allHistory = this.getAllHistoryMap();
      const history = allHistory[hikerId] || [];

      if (sinceTimestamp) {
        return history.filter((p) => p.timestamp >= sinceTimestamp);
      }
      return history;
    } catch (err) {
      console.warn('Failed to retrieve location history:', err);
      return [];
    }
  }

  async clearHistory(hikerId?: string): Promise<void> {
    if (!this.isClient()) return;

    if (!hikerId) {
      localStorage.removeItem(LOCATION_HISTORY_KEY);
      return;
    }

    const allHistory = this.getAllHistoryMap();
    delete allHistory[hikerId];
    localStorage.setItem(LOCATION_HISTORY_KEY, JSON.stringify(allHistory));
  }

  private getAllHistoryMap(): Record<string, LocationUpdate[]> {
    if (!this.isClient()) return {};
    try {
      const raw = localStorage.getItem(LOCATION_HISTORY_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
}
