/**
 * @fileoverview LocalStorage Implementation of IGroupRepository
 * Ensures resilient offline-first persistence of groups and members.
 */

import type { IGroupRepository } from './interfaces';
import type { Group, Member, LocationUpdate } from '../domain/types';
import { GroupSchema } from '../domain/schemas';
import { groups as defaultGroups } from '@/entities/group/model/groups-data';

const STORAGE_KEY = 'hiker_groups_data';

export class LocalStorageGroupRepository implements IGroupRepository {
  private isClient(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  async getGroups(): Promise<Group[]> {
    if (!this.isClient()) {
      return defaultGroups as Group[];
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // Initialize default seed data
        await this.resetToDefaults();
        return defaultGroups as Group[];
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as Group[];
      }

      return defaultGroups as Group[];
    } catch (err) {
      console.warn('Failed to parse groups from localStorage, using fallback:', err);
      return defaultGroups as Group[];
    }
  }

  async getGroupById(id: string): Promise<Group | null> {
    const groups = await this.getGroups();
    return groups.find((g) => g.id === id) || null;
  }

  async createGroup(group: Group): Promise<Group> {
    const validated = GroupSchema.parse(group);
    const groups = await this.getGroups();
    const updated = [...groups, validated];
    this.save(updated);
    return validated;
  }

  async updateGroup(group: Group): Promise<Group> {
    const validated = GroupSchema.parse(group);
    const groups = await this.getGroups();
    const index = groups.findIndex((g) => g.id === validated.id);

    if (index === -1) {
      throw new Error(`Group with id ${validated.id} not found`);
    }

    const updated = [...groups];
    updated[index] = validated;
    this.save(updated);
    return validated;
  }

  async deleteGroup(id: string): Promise<boolean> {
    const groups = await this.getGroups();
    const filtered = groups.filter((g) => g.id !== id);
    if (filtered.length === groups.length) return false;
    this.save(filtered);
    return true;
  }

  async addMember(groupId: string, member: Member): Promise<Group> {
    const group = await this.getGroupById(groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);

    const existingIndex = group.hikers.findIndex((h) => h.id === member.id);
    let updatedHikers: Member[];

    if (existingIndex >= 0) {
      updatedHikers = [...group.hikers];
      updatedHikers[existingIndex] = member;
    } else {
      updatedHikers = [...group.hikers, member];
    }

    const updatedGroup: Group = {
      ...group,
      hikers: updatedHikers,
    };

    return this.updateGroup(updatedGroup);
  }

  async removeMember(groupId: string, memberId: string): Promise<Group> {
    const group = await this.getGroupById(groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);

    const updatedHikers = group.hikers.filter((h) => h.id !== memberId);
    const updatedGroup: Group = {
      ...group,
      hikers: updatedHikers,
    };

    return this.updateGroup(updatedGroup);
  }

  async updateMemberLocation(
    groupId: string,
    memberId: string,
    location: LocationUpdate
  ): Promise<Group> {
    const group = await this.getGroupById(groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);

    const updatedHikers = group.hikers.map((hiker) => {
      if (hiker.id === memberId) {
        const latDir = location.latitude >= 0 ? 'с.ш.' : 'ю.ш.';
        const lonDir = location.longitude >= 0 ? 'в.д.' : 'з.д.';
        const formattedCoords = `${Math.abs(location.latitude).toFixed(4)}° ${latDir}, ${Math.abs(location.longitude).toFixed(4)}° ${lonDir}`;

        return {
          ...hiker,
          coords: formattedCoords,
          battery: location.batteryLevel !== undefined ? location.batteryLevel : hiker.battery,
          lastLocation: location,
          lastUpdate: 'только что',
          lastUpdateTimestamp: location.timestamp,
        };
      }
      return hiker;
    });

    const updatedGroup: Group = {
      ...group,
      hikers: updatedHikers,
    };

    return this.updateGroup(updatedGroup);
  }

  async resetToDefaults(): Promise<Group[]> {
    this.save(defaultGroups as Group[]);
    return defaultGroups as Group[];
  }

  private save(groups: Group[]): void {
    if (!this.isClient()) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
      // Dispatch custom event for cross-tab or same-window sync
      window.dispatchEvent(new Event('hiker_groups_updated'));
    } catch (err) {
      console.error('Failed to save groups to localStorage:', err);
    }
  }
}
