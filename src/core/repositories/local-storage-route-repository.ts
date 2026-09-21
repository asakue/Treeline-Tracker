/**
 * @fileoverview LocalStorage Implementation of IRouteRepository
 * Provides resilient persistence and CRUD operations for routes.
 */

import type { IRouteRepository } from './interfaces';
import type { Route } from '../domain/types';
import { RouteSchema } from '../domain/schemas';
import { savedRoutes as defaultRoutes } from '@/entities/route/model/routes-data';

const STORAGE_KEY = 'hiker_routes_data';

export class LocalStorageRouteRepository implements IRouteRepository {
  private isClient(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  async getRoutes(includeArchived = false): Promise<Route[]> {
    if (!this.isClient()) {
      return (defaultRoutes as Route[]).filter((r) => includeArchived || !r.isArchived);
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        await this.resetToDefaults();
        return (defaultRoutes as Route[]).filter((r) => includeArchived || !r.isArchived);
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return (parsed as Route[]).filter((r) => includeArchived || !r.isArchived);
      }

      return (defaultRoutes as Route[]).filter((r) => includeArchived || !r.isArchived);
    } catch (err) {
      console.warn('Failed to parse routes from localStorage, using defaults:', err);
      return (defaultRoutes as Route[]).filter((r) => includeArchived || !r.isArchived);
    }
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
      return defaultRoutes as Route[];
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        return defaultRoutes as Route[];
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as Route[];
      }
      return defaultRoutes as Route[];
    } catch (err) {
      return defaultRoutes as Route[];
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
    return validated;
  }

  async updateRoute(route: Route): Promise<Route> {
    const validated = RouteSchema.parse(route);
    const routes = await this.getAllRoutesInternal();
    const index = routes.findIndex((r) => r.id === validated.id);

    if (index === -1) {
      throw new Error(`Route with id ${validated.id} not found`);
    }

    const updated = [...routes];
    updated[index] = validated;
    this.save(updated);
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
    return validated;
  }

  async deleteRoute(id: string): Promise<boolean> {
    const routes = await this.getAllRoutesInternal();
    const filtered = routes.filter((r) => r.id !== id);
    if (filtered.length === routes.length) return false;
    this.save(filtered);
    return true;
  }

  async clearArchive(): Promise<boolean> {
    const routes = await this.getAllRoutesInternal();
    const filtered = routes.filter((r) => !r.isArchived);
    this.save(filtered);
    return true;
  }

  async resetToDefaults(): Promise<Route[]> {
    this.save(defaultRoutes as Route[]);
    return defaultRoutes as Route[];
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
