'use client';

import { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { useGroups } from '@/entities/group';
import { useHikerDataSimulation } from '@/entities/hiker';
import { useRoutes } from '@/entities/route';

export type View =
  | 'map'
  | 'tracker'
  | 'chat'
  | 'weather'
  | 'routes'
  | 'search'
  | 'emergency'
  | 'profile'
  | 'about'
  | 'about-app';

type MapOverlay = {
  id: string;
  type: 'searchArea';
  polygon: [number, number][];
};

export interface AppUserProfile {
  displayName: string;
  email: string;
  avatarUrl: string;
  phone: string;
  emergencyContact: string;
  experienceLevel: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  bio: string;
}

type AppContextType = {
  activeView: View;
  setActiveView: (view: View) => void;
  viewProps: Record<string, unknown>;
  setView: (view: View, props?: Record<string, unknown>) => void;
  activeGroupId?: string;
  setActiveGroupId: (id: string | undefined) => void;
  mapOverlays: MapOverlay[];
  setMapOverlays: React.Dispatch<React.SetStateAction<MapOverlay[]>>;
  addMapOverlay: (overlay: MapOverlay) => void;
  removeMapOverlay: (id: string) => void;
  groupsHook: ReturnType<typeof useGroups>;
  routesHook: ReturnType<typeof useRoutes>;
  drawingRoutePoints: [number, number][];
  setDrawingRoutePoints: React.Dispatch<React.SetStateAction<[number, number][]>>;
  addDrawingRoutePoint: (point: [number, number]) => void;
  clearDrawingRoutePoints: () => void;
  userProfile: AppUserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<AppUserProfile>>;
  updateUserProfile: (data: Partial<AppUserProfile>) => void;
};

const defaultProfile: AppUserProfile = {
  displayName: '',
  email: '',
  avatarUrl: '',
  phone: '',
  emergencyContact: '',
  experienceLevel: 'Beginner',
  bio: '',
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [activeView, setActiveView] = useState<View>('map');
  const [viewProps, setViewProps] = useState<Record<string, unknown>>({});
  const [mapOverlays, setMapOverlays] = useState<MapOverlay[]>([]);
  
  const [userProfile, setUserProfile] = useState<AppUserProfile>(defaultProfile);

  const simulatedHikers = useHikerDataSimulation();
  const groupsHook = useGroups();
  const routesHook = useRoutes();
  const { updateGroupsWithSimulatedData } = groupsHook;

  // Load and sync user profile from localStorage and API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('treeline_user_profile');
        const savedAvatar = localStorage.getItem('treeline_user_avatar');
        if (saved) {
          const parsed = JSON.parse(saved);
          setUserProfile((prev) => ({
            ...prev,
            ...parsed,
            avatarUrl: savedAvatar || parsed.avatarUrl || prev.avatarUrl,
          }));
        } else if (savedAvatar) {
          setUserProfile((prev) => ({ ...prev, avatarUrl: savedAvatar }));
        }
      } catch (e) {
        console.error('Failed to load profile from localStorage:', e);
      }
    }

    fetch('/api/profile')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setUserProfile((prev) => ({
            ...prev,
            displayName: json.data.displayName || prev.displayName,
            email: json.data.email || prev.email,
            avatarUrl: json.data.avatarUrl || prev.avatarUrl,
            phone: json.data.phone || prev.phone,
            emergencyContact: json.data.emergencyContact || prev.emergencyContact,
            experienceLevel: json.data.experienceLevel || prev.experienceLevel,
            bio: json.data.bio || prev.bio,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const updateUserProfile = useCallback((data: Partial<AppUserProfile>) => {
    setUserProfile((prev) => {
      const updated = { ...prev, ...data };
      if (typeof window !== 'undefined') {
        localStorage.setItem('treeline_user_profile', JSON.stringify(updated));
        if (updated.avatarUrl) {
          localStorage.setItem('treeline_user_avatar', updated.avatarUrl);
        }
      }
      return updated;
    });

    fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch((err) => console.warn('Profile sync error:', err));
  }, []);

  useEffect(() => {
    updateGroupsWithSimulatedData(simulatedHikers);
  }, [simulatedHikers, updateGroupsWithSimulatedData]);

  const [activeGroupId, setActiveGroupIdState] = useState<string | undefined>();
  const [drawingRoutePoints, setDrawingRoutePoints] = useState<[number, number][]>([]);

  useEffect(() => {
    if (groupsHook.isLoaded && !activeGroupId && groupsHook.groups.length > 0) {
      setActiveGroupIdState(groupsHook.groups[0].id);
    }
  }, [groupsHook.isLoaded, groupsHook.groups, activeGroupId]);

  const setView = (view: View, props: Record<string, unknown> = {}) => {
    setActiveView(view);
    setViewProps(props);
    if (props.groupId) {
      setActiveGroupIdState(props.groupId as string);
    }
  };

  const setActiveGroupId = (id: string | undefined) => {
    setActiveGroupIdState(id);
  };
  
  const addMapOverlay = (overlay: MapOverlay) => {
    setMapOverlays((overlays) => [...overlays.filter((o) => o.id !== overlay.id), overlay]);
  };

  const removeMapOverlay = (id: string) => {
    setMapOverlays((overlays) => overlays.filter((o) => o.id !== id));
  };

  const addDrawingRoutePoint = (point: [number, number]) => {
    setDrawingRoutePoints((points) => [...points, point]);
  };

  const clearDrawingRoutePoints = () => {
    setDrawingRoutePoints([]);
  };

  const contextValue = {
    activeView,
    setActiveView,
    viewProps,
    setView,
    activeGroupId,
    setActiveGroupId,
    mapOverlays,
    setMapOverlays,
    addMapOverlay,
    removeMapOverlay,
    groupsHook,
    routesHook,
    drawingRoutePoints,
    setDrawingRoutePoints,
    addDrawingRoutePoint,
    clearDrawingRoutePoints,
    userProfile,
    setUserProfile,
    updateUserProfile,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
