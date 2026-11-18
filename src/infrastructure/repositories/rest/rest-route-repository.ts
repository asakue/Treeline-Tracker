/**
 * @fileoverview REST Implementation of IRouteRepository with Resilient LocalStorage Fallback
 */

import type { IRouteRepository } from '@/core/repositories/interfaces';
import type { Route } from '@/core/domain/types';
import { RouteSchema } from '@/core/domain/schemas';
import { LocalStorageRouteRepository } from '@/core/repositories/local-storage-route-repository';
import { BaseRestRepository } from './base-rest-repository';

export class RestRouteRepository extends BaseRestRepository implements IRouteRepository {
  private fallback: LocalStorageRouteRepository;
  private endpoint = '/api/routes';

  constructor(fallback?: LocalStorageRouteRepository) {
    super();
    this.fallback = fallback || new LocalStorageRouteRepository();
  }

  async getRoutes(includeArchived = false): Promise<Route[]> {
    if (!this.isOnline()) {
      return this.fallback.getRoutes(includeArchived);
    }

    try {
      const url = this.toUrl(`${this.endpoint}?includeArchived=${includeArchived}`);
      const routes = await this.fetchWithTimeout<Route[]>(url, { method: 'GET' });
      if (Array.isArray(routes)) {
        for (const r of routes) {
          await this.fallback.createRoute(r).catch(() => {});
        }
        return includeArchived ? routes : routes.filter((r) => !r.isArchived);
      }
      return this.fallback.getRoutes(includeArchived);
    } catch (err) {
      console.warn('[RestRouteRepository] getRoutes network failure, serving from fallback:', err);
      return this.fallback.getRoutes(includeArchived);
    }
  }

  async getActiveRoutes(): Promise<Route[]> {
    return this.getRoutes(false);
  }

  async getArchivedRoutes(): Promise<Route[]> {
    const all = await this.getRoutes(true);
    return all.filter((r) => !!r.isArchived);
  }

  async getRouteById(id: string): Promise<Route | null> {
    const cached = await this.fallback.getRouteById(id);
    if (!this.isOnline()) return cached;

    try {
      const routes = await this.getRoutes(true);
      return routes.find((r) => r.id === id) || cached;
    } catch {
      return cached;
    }
  }

  async createRoute(route: Route): Promise<Route> {
    const validated = RouteSchema.parse({
      ...route,
      isArchived: route.isArchived ?? false,
      createdAt: route.createdAt || Date.now(),
    });

    // Optimistic local update & window event dispatch
    await this.fallback.createRoute(validated).catch(() => {});

    if (this.isOnline()) {
      try {
        const created = await this.fetchWithTimeout<Route>(this.toUrl(this.endpoint), {
          method: 'POST',
          body: JSON.stringify(validated),
        });
        return (created && created.id) ? created : validated;
      } catch (err) {
        console.warn('[RestRouteRepository] createRoute offline fallback preserved:', err);
      }
    }
    return validated;
  }

  async updateRoute(route: Route): Promise<Route> {
    const validated = RouteSchema.parse({
      ...route,
      version: (route.version || 1) + 1,
      updatedAt: Date.now(),
    });

    // Optimistic local update & window event dispatch
    await this.fallback.updateRoute(validated).catch(() => {});

    if (this.isOnline()) {
      try {
        const updated = await this.fetchWithTimeout<Route>(this.toUrl(this.endpoint), {
          method: 'PUT',
          body: JSON.stringify(validated),
        });
        return (updated && updated.id) ? updated : validated;
      } catch (err) {
        console.warn('[RestRouteRepository] updateRoute offline fallback preserved:', err);
      }
    }
    return validated;
  }

  async archiveRoute(id: string): Promise<Route | null> {
    const route = await this.getRouteById(id);
    if (!route) return null;

    const updated: Route = {
      ...route,
      isArchived: true,
      archivedAt: Date.now(),
    };
    return this.updateRoute(updated);
  }

  async restoreRoute(id: string): Promise<Route | null> {
    const route = await this.getRouteById(id);
    if (!route) return null;

    const updated: Route = {
      ...route,
      isArchived: false,
      archivedAt: undefined,
    };
    return this.updateRoute(updated);
  }

  async deleteRoute(id: string): Promise<boolean> {
    await this.fallback.deleteRoute(id).catch(() => {});

    if (this.isOnline()) {
      try {
        await this.fetchWithTimeout<{ success: boolean }>(
          this.toUrl(`${this.endpoint}?id=${encodeURIComponent(id)}`),
          { method: 'DELETE' }
        );
        return true;
      } catch (err) {
        console.warn('[RestRouteRepository] deleteRoute network failure:', err);
      }
    }
    return true;
  }

  async clearArchive(): Promise<boolean> {
    return this.fallback.clearArchive();
  }

  async resetToDefaults(): Promise<Route[]> {
    return this.fallback.resetToDefaults();
  }
}
