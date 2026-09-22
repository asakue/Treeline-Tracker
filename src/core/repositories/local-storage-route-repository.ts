/**
 * @fileoverview LocalStorage & Server-Synched Implementation of IRouteRepository
 * Provides resilient persistence and CRUD operations for user-created routes.
 */

import type { IRouteRepository } from './interfaces';
import type { Route } from '../domain/types';
import { RouteSchema } from '../domain/schemas';

const STORAGE_KEY = 'hiker_routes_data';

export class LocalStorageRouteRepository implements IRouteRepository {
  private isClient(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  async getRoutes(includeArchived = false): Promise<Route[]> {
    const all = await this.getAllRoutesInternal();
    return all.filter((r) => includeArchived || !r.isArchived);
  }

  async getActiveRoutes(): Promise<Route[]> {
    return this.getRoutes(false);
  }

  async getArchivedRoutes(): Promise<Route[]> {
    const all = await this.getAllRoutesInternal();
    return all.filter((r) => !!r.isArchived);
  }

  private async getAllRoutesInternal(): Promise<Route[]> {
    if (!this.isClient()) {
      return [];
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed as Route[];
        }
      }

      // Sync from server if local storage is empty
      try {
        const res = await fetch('/api/routes?includeArchived=true');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            this.save(json.data);
            return json.data;
          }
        }
      } catch {
        // Offline fallback
      }

      return [];
    } catch (err) {
      console.warn('Failed to parse routes from localStorage:', err);
      return [];
    }
  }

  async getRouteById(id: string): Promise<Route | null> {
    const routes = await this.getAllRoutesInternal();
    return routes.find((r) => r.id === id) || null;
  }

  async createRoute(route: Route): Promise<Route> {
    const validated = RouteSchema.parse({
      ...route,
      isArchived: false,
      createdAt: route.createdAt || Date.now(),
    });
    const routes = await this.getAllRoutesInternal();
    const updated = [validated, ...routes];
    this.save(updated);

    // Sync to server in background
    if (this.isClient()) {
      fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
      }).catch((e) => console.warn('Failed to sync route to server:', e));
    }

    return validated;
  }

  async updateRoute(route: Route): Promise<Route> {
    const validated = RouteSchema.parse(route);
    const routes = await this.getAllRoutesInternal();
    const index = routes.findIndex((r) => r.id === validated.id);

    if (index === -1) {
      const updated = [validated, ...routes];
      this.save(updated);
      return validated;
    }

    const updated = [...routes];
    updated[index] = validated;
    this.save(updated);

    if (this.isClient()) {
      fetch('/api/routes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
      }).catch((e) => console.warn('Failed to sync route update to server:', e));
    }

    return validated;
  }

  async archiveRoute(id: string): Promise<Route | null> {
    const routes = await this.getAllRoutesInternal();
    const index = routes.findIndex((r) => r.id === id);
    if (index === -1) return null;

    const updatedRoute: Route = {
      ...routes[index],
      isArchived: true,
      archivedAt: Date.now(),
    };

    const validated = RouteSchema.parse(updatedRoute);
    const updated = [...routes];
    updated[index] = validated;
    this.save(updated);

    if (this.isClient()) {
      fetch('/api/routes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
      }).catch((e) => console.warn('Failed to sync route archive to server:', e));
    }

    return validated;
  }

  async restoreRoute(id: string): Promise<Route | null> {
    const routes = await this.getAllRoutesInternal();
    const index = routes.findIndex((r) => r.id === id);
    if (index === -1) return null;

    const updatedRoute: Route = {
      ...routes[index],
      isArchived: false,
      archivedAt: undefined,
    };

    const validated = RouteSchema.parse(updatedRoute);
    const updated = [...routes];
    updated[index] = validated;
    this.save(updated);

    if (this.isClient()) {
      fetch('/api/routes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
      }).catch((e) => console.warn('Failed to sync route restore to server:', e));
    }

    return validated;
  }

  async deleteRoute(id: string): Promise<boolean> {
    const routes = await this.getAllRoutesInternal();
    const filtered = routes.filter((r) => r.id !== id);
    if (filtered.length === routes.length) return false;
    this.save(filtered);

    if (this.isClient()) {
      fetch(`/api/routes?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }).catch((e) => console.warn('Failed to sync route delete to server:', e));
    }

    return true;
  }

  async clearArchive(): Promise<boolean> {
    const routes = await this.getAllRoutesInternal();
    const filtered = routes.filter((r) => !r.isArchived);
    this.save(filtered);
    return true;
  }

  async resetToDefaults(): Promise<Route[]> {
    this.save([]);
    return [];
  }

  private save(routes: Route[]): void {
    if (!this.isClient()) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
      window.dispatchEvent(new Event('hiker_routes_updated'));
    } catch (err) {
      console.error('Failed to save routes to localStorage:', err);
    }
  }
}
