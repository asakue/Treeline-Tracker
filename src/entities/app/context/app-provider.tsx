'use client';

import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useGroups } from '@/entities/group';
import { useHikerDataSimulation } from '@/entities/hiker';

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
  drawingRoutePoints: [number, number][];
  setDrawingRoutePoints: React.Dispatch<React.SetStateAction<[number, number][]>>;
  addDrawingRoutePoint: (point: [number, number]) => void;
  clearDrawingRoutePoints: () => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [activeView, setActiveView] = useState<View>('map');
  const [viewProps, setViewProps] = useState<Record<string, unknown>>({});
  const [mapOverlays, setMapOverlays] = useState<MapOverlay[]>([]);
  
  const simulatedHikers = useHikerDataSimulation();
  const groupsHook = useGroups();
  const { updateGroupsWithSimulatedData } = groupsHook;

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
  }
  
  const addMapOverlay = (overlay: MapOverlay) => {
    setMapOverlays(overlays => [...overlays.filter(o => o.id !== overlay.id), overlay]);
  }

  const removeMapOverlay = (id: string) => {
    setMapOverlays(overlays => overlays.filter(o => o.id !== id));
  }

  const addDrawingRoutePoint = (point: [number, number]) => {
    setDrawingRoutePoints(points => [...points, point]);
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
    drawingRoutePoints,
    setDrawingRoutePoints,
    addDrawingRoutePoint,
    clearDrawingRoutePoints,
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
