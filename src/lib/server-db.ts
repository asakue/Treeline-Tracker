/**
 * @fileoverview Server-side Database Store
 * Provides persistent in-memory / file-synced data management for full-stack API routes.
 */

import type { Group, Route, Member, LocationUpdate, EmergencyEvent, PrivacyMode } from '@/core/domain/types';

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  phone?: string;
  emergencyContact?: string;
  experienceLevel?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  privacyMode: PrivacyMode;
  publicKey?: string;
  userId: string;
  updatedAt: number;
}

export interface ServerDatabase {
  profiles: Record<string, UserProfile>;
  groups: Group[];
  routes: Route[];
  locations: Record<string, LocationUpdate>;
  emergencies: EmergencyEvent[];
  messages: Record<string, Array<{
    id: string;
    groupId: string;
    senderId: string;
    senderName: string;
    avatar?: string;
    text: string;
    timestamp: number;
  }>>;
}

// Global in-memory storage for server environment (persists across hot-reloads and requests)
declare global {
  // eslint-disable-next-line no-var
  var __treeline_db__: ServerDatabase | undefined;
}

function getInitialDb(): ServerDatabase {
  return {
    profiles: {},
    groups: [],
    routes: [],
    locations: {},
    emergencies: [],
    messages: {},
  };
}

export function getServerDb(): ServerDatabase {
  if (!globalThis.__treeline_db__) {
    globalThis.__treeline_db__ = getInitialDb();
  }
  return globalThis.__treeline_db__;
}

// Helper methods for server operations
export const ServerDbService = {
  // Profile operations
  getProfile(userId = 'default_user'): UserProfile {
    const db = getServerDb();
    if (!db.profiles[userId]) {
      db.profiles[userId] = {
        id: userId,
        userId: userId,
        displayName: 'Мой профиль',
        email: '',
        avatarUrl: '',
        bio: '',
        phone: '',
        emergencyContact: '',
        experienceLevel: 'Beginner',
        privacyMode: 'NORMAL',
        updatedAt: Date.now(),
      };
    }
    return db.profiles[userId];
  },

  updateProfile(userId: string, data: Partial<UserProfile>): UserProfile {
    const db = getServerDb();
    const existing = this.getProfile(userId);
    const updated: UserProfile = {
      ...existing,
      ...data,
      id: userId,
      userId: userId,
      updatedAt: Date.now(),
    };
    db.profiles[userId] = updated;
    return updated;
  },

  // Groups operations
  getGroups(): Group[] {
    return getServerDb().groups;
  },

  getGroupById(id: string): Group | null {
    return getServerDb().groups.find((g) => g.id === id) || null;
  },

  createGroup(group: Omit<Group, 'id'> & { id?: string }): Group {
    const db = getServerDb();
    const newGroup: Group = {
      ...group,
      id: group.id || `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
      hikers: group.hikers || [],
    };
    db.groups.push(newGroup);
    return newGroup;
  },

  updateGroup(id: string, groupData: Partial<Group>): Group {
    const db = getServerDb();
    const index = db.groups.findIndex((g) => g.id === id);
    if (index === -1) {
      throw new Error(`Group with ID ${id} not found`);
    }
    const updated: Group = {
      ...db.groups[index],
      ...groupData,
      id,
    };
    db.groups[index] = updated;
    return updated;
  },

  deleteGroup(id: string): boolean {
    const db = getServerDb();
    const initialLen = db.groups.length;
    db.groups = db.groups.filter((g) => g.id !== id);
    return db.groups.length < initialLen;
  },

  addMemberToGroup(groupId: string, member: Member): Group {
    const group = this.getGroupById(groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);
    const existingIndex = group.hikers.findIndex((h) => h.id === member.id);
    let updatedHikers: Member[];
    if (existingIndex >= 0) {
      updatedHikers = [...group.hikers];
      updatedHikers[existingIndex] = member;
    } else {
      updatedHikers = [...group.hikers, member];
    }
    return this.updateGroup(groupId, { hikers: updatedHikers });
  },

  removeMemberFromGroup(groupId: string, memberId: string): Group {
    const group = this.getGroupById(groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);
    const updatedHikers = group.hikers.filter((h) => h.id !== memberId);
    return this.updateGroup(groupId, { hikers: updatedHikers });
  },

  // Routes operations
  getRoutes(includeArchived = false): Route[] {
    const db = getServerDb();
    return db.routes.filter((r) => includeArchived || !r.isArchived);
  },

  getRouteById(id: string): Route | null {
    return getServerDb().routes.find((r) => r.id === id) || null;
  },

  createRoute(route: Omit<Route, 'id'> & { id?: string }): Route {
    const db = getServerDb();
    const newRoute: Route = {
      ...route,
      id: route.id || `route_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
      isArchived: false,
    };
    db.routes.unshift(newRoute);
    return newRoute;
  },

  updateRoute(id: string, routeData: Partial<Route>): Route {
    const db = getServerDb();
    const index = db.routes.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Route with ID ${id} not found`);
    }
    const updated: Route = {
      ...db.routes[index],
      ...routeData,
      id,
    };
    db.routes[index] = updated;
    return updated;
  },

  deleteRoute(id: string): boolean {
    const db = getServerDb();
    const initialLen = db.routes.length;
    db.routes = db.routes.filter((r) => r.id !== id);
    return db.routes.length < initialLen;
  },

  // Emergency operations
  getEmergencies(): EmergencyEvent[] {
    return getServerDb().emergencies;
  },

  createEmergency(event: Omit<EmergencyEvent, 'id' | 'timestamp'>): EmergencyEvent {
    const db = getServerDb();
    const newEvent: EmergencyEvent = {
      ...event,
      id: `sos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      status: 'ACTIVE',
      acknowledgedBy: [],
    };
    db.emergencies.unshift(newEvent);
    return newEvent;
  },

  resolveEmergency(id: string, resolvedBy: string): EmergencyEvent | null {
    const db = getServerDb();
    const event = db.emergencies.find((e) => e.id === id);
    if (!event) return null;
    event.status = 'RESOLVED';
    if (!event.acknowledgedBy.includes(resolvedBy)) {
      event.acknowledgedBy.push(resolvedBy);
    }
    return event;
  },

  // Location telemetry operations
  updateLocation(update: LocationUpdate): void {
    const db = getServerDb();
    db.locations[update.hikerId] = update;
  },

  getLocations(): Record<string, LocationUpdate> {
    return getServerDb().locations;
  },
};
