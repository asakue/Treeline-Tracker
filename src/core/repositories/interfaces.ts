/**
 * @fileoverview Repository Interface Contracts (DIP - Dependency Inversion Principle)
 * Separates persistent data storage from domain and UI logic.
 */

import type { Group, Member, Route, LocationUpdate, EmergencyEvent } from '../domain/types';

export interface IGroupRepository {
  getGroups(): Promise<Group[]>;
  getGroupById(id: string): Promise<Group | null>;
  createGroup(group: Group): Promise<Group>;
  updateGroup(group: Group): Promise<Group>;
  deleteGroup(id: string): Promise<boolean>;
  addMember(groupId: string, member: Member): Promise<Group>;
  removeMember(groupId: string, memberId: string): Promise<Group>;
  updateMemberLocation(groupId: string, memberId: string, location: LocationUpdate): Promise<Group>;
  resetToDefaults(): Promise<Group[]>;
}

export interface IRouteRepository {
  getRoutes(includeArchived?: boolean): Promise<Route[]>;
  getActiveRoutes(): Promise<Route[]>;
  getArchivedRoutes(): Promise<Route[]>;
  getRouteById(id: string): Promise<Route | null>;
  createRoute(route: Route): Promise<Route>;
  updateRoute(route: Route): Promise<Route>;
  archiveRoute(id: string): Promise<Route | null>;
  restoreRoute(id: string): Promise<Route | null>;
  deleteRoute(id: string): Promise<boolean>;
  clearArchive(): Promise<boolean>;
  resetToDefaults(): Promise<Route[]>;
}

export interface ILocationRepository {
  getLastKnownLocation(hikerId: string): Promise<LocationUpdate | null>;
  saveLocation(location: LocationUpdate): Promise<void>;
  getLocationHistory(hikerId: string, sinceTimestamp?: number): Promise<LocationUpdate[]>;
  clearHistory(hikerId?: string): Promise<void>;
}

export interface IEmergencyRepository {
  getActiveEvents(): Promise<EmergencyEvent[]>;
  getEventById(id: string): Promise<EmergencyEvent | null>;
  createEvent(event: EmergencyEvent): Promise<EmergencyEvent>;
  acknowledgeEvent(eventId: string, acknowledgedByHikerId: string): Promise<EmergencyEvent>;
  resolveEvent(eventId: string): Promise<EmergencyEvent>;
  getAllEvents(): Promise<EmergencyEvent[]>;
}
