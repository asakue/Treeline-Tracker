'use client';

import { useState, useEffect, useCallback } from 'react';
import { savedRoutes as initialRoutes, type Route } from '@/lib/routes-data';

const ROUTES_STORAGE_KEY = 'tracker-routes';

export const useRoutes = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ROUTES_STORAGE_KEY);
      if (saved) {
        setRoutes(JSON.parse(saved));
      } else {
        // Load initial data if nothing is in localStorage
        setRoutes(initialRoutes);
        localStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(initialRoutes));
      }
    } catch (error) {
      console.error("Failed to load routes from localStorage, using initial data.", error);
      setRoutes(initialRoutes);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const saveRoutes = useCallback((updatedRoutes: Route[]) => {
    try {
      localStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(updatedRoutes));
      setRoutes(updatedRoutes);
    } catch (error) {
      console.error("Failed to save routes to localStorage", error);
    }
  }, []);

  const addRoute = useCallback((newRouteData: Omit<Route, 'id'>) => {
    const newRoute: Route = {
      ...newRouteData,
      id: `route-${Date.now()}`,
    };
    
    const updatedRoutes = [...routes, newRoute];
    saveRoutes(updatedRoutes);

    return newRoute;
  }, [routes, saveRoutes]);

  const updateRoute = useCallback((id: string, updatedData: Omit<Route, 'id'>) => {
    const updatedRoutes = routes.map(route => 
      route.id === id ? { ...route, ...updatedData } : route
    );
    saveRoutes(updatedRoutes);
  }, [routes, saveRoutes]);

  const deleteRoute = useCallback((id: string) => {
    const updatedRoutes = routes.filter(route => route.id !== id);
    saveRoutes(updatedRoutes);
  }, [routes, saveRoutes]);


  return { routes, addRoute, updateRoute, deleteRoute, isLoaded, setRoutes: saveRoutes };
};
