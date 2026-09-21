'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Route } from '@/entities/route';
import { routeRepository } from '@/core/repositories';

export const useRoutes = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [archivedRoutes, setArchivedRoutes] = useState<Route[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadRoutes = useCallback(async () => {
    try {
      const [active, archived] = await Promise.all([
        routeRepository.getActiveRoutes(),
        routeRepository.getArchivedRoutes(),
      ]);
      setRoutes(active);
      setArchivedRoutes(archived);
    } catch (error) {
      console.error('Failed to load routes via repository:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadRoutes();

    const handleUpdate = () => {
      loadRoutes();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('hiker_routes_updated', handleUpdate);
      return () => {
        window.removeEventListener('hiker_routes_updated', handleUpdate);
      };
    }
  }, [loadRoutes]);

  const saveRoutes = useCallback(
    async (updatedRoutes: Route[]) => {
      try {
        setRoutes(updatedRoutes.filter((r) => !r.isArchived));
        setArchivedRoutes(updatedRoutes.filter((r) => !!r.isArchived));
        if (typeof window !== 'undefined') {
          localStorage.setItem('hiker_routes_data', JSON.stringify(updatedRoutes));
          window.dispatchEvent(new Event('hiker_routes_updated'));
        }
      } catch (error) {
        console.error('Failed to save routes:', error);
      }
    },
    []
  );

  const addRoute = useCallback(
    async (newRouteData: Omit<Route, 'id'>) => {
      const newRoute: Route = {
        ...newRouteData,
        id: `route-${Date.now()}`,
        isArchived: false,
        createdAt: Date.now(),
      };

      await routeRepository.createRoute(newRoute);
      setRoutes((prev) => [newRoute, ...prev.filter((r) => r.id !== newRoute.id)]);

      return newRoute;
    },
    []
  );

  const updateRoute = useCallback(
    async (id: string, updatedData: Omit<Route, 'id'>) => {
      const existing = routes.find((r) => r.id === id) || archivedRoutes.find((r) => r.id === id);
      if (!existing) return;

      const updatedRoute: Route = {
        ...existing,
        ...updatedData,
        id,
      };

      await routeRepository.updateRoute(updatedRoute);
      if (updatedRoute.isArchived) {
        setArchivedRoutes((prev) => prev.map((r) => (r.id === id ? updatedRoute : r)));
      } else {
        setRoutes((prev) => prev.map((r) => (r.id === id ? updatedRoute : r)));
      }
    },
    [routes, archivedRoutes]
  );

  const archiveRoute = useCallback(
    async (id: string) => {
      const target = routes.find((r) => r.id === id);
      if (!target) return null;

      const updated = await routeRepository.archiveRoute(id);
      if (updated) {
        setRoutes((prev) => prev.filter((r) => r.id !== id));
        setArchivedRoutes((prev) => [updated, ...prev.filter((r) => r.id !== id)]);
      }
      return updated;
    },
    [routes]
  );

  const restoreRoute = useCallback(
    async (id: string) => {
      const target = archivedRoutes.find((r) => r.id === id);
      if (!target) return null;

      const updated = await routeRepository.restoreRoute(id);
      if (updated) {
        setArchivedRoutes((prev) => prev.filter((r) => r.id !== id));
        setRoutes((prev) => [updated, ...prev.filter((r) => r.id !== id)]);
      }
      return updated;
    },
    [archivedRoutes]
  );

  const deleteRoute = useCallback(
    async (id: string) => {
      await routeRepository.deleteRoute(id);
      setRoutes((prev) => prev.filter((r) => r.id !== id));
      setArchivedRoutes((prev) => prev.filter((r) => r.id !== id));
    },
    []
  );

  const clearArchive = useCallback(
    async () => {
      await routeRepository.clearArchive();
      setArchivedRoutes([]);
    },
    []
  );

  return {
    routes,
    archivedRoutes,
    allRoutes: [...routes, ...archivedRoutes],
    addRoute,
    updateRoute,
    archiveRoute,
    restoreRoute,
    deleteRoute,
    clearArchive,
    isLoaded,
    setRoutes: saveRoutes,
    reload: loadRoutes,
  };
};

