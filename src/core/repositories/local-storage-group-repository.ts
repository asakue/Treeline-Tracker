/**
 * @fileoverview LocalStorage & Server-Synched Implementation of IGroupRepository
 * Ensures resilient offline-first persistence of user-created groups and members.
 */

import type { IGroupRepository } from './interfaces';
import type { Group, Member, LocationUpdate } from '../domain/types';
import { GroupSchema } from '../domain/schemas';

const STORAGE_KEY = 'hiker_groups_data';

export class LocalStorageGroupRepository implements IGroupRepository {
  private isClient(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  async getGroups(): Promise<Group[]> {
    if (!this.isClient()) {
      return [];
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed as Group[];
        }
      }

      // Try fetching from server API if local is empty
      try {
        const res = await fetch('/api/groups');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            this.save(json.data);
            return json.data;
          }
        }
      } catch {
        // Offline / network failure fallback
      }

      return [];
    } catch (err) {
      console.warn('Failed to parse groups from localStorage:', err);
      return [];
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

    // Sync to server in background
    if (this.isClient()) {
      fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
      }).catch((e) => console.warn('Failed to sync group to server:', e));
    }

    return validated;
  }

  async updateGroup(group: Group): Promise<Group> {
    const validated = GroupSchema.parse(group);
    const groups = await this.getGroups();
    const index = groups.findIndex((g) => g.id === validated.id);

    if (index === -1) {
      // If not found, add it
      const updated = [...groups, validated];
      this.save(updated);
      return validated;
    }

    const updated = [...groups];
    updated[index] = validated;
    this.save(updated);

    // Sync to server
    if (this.isClient()) {
      fetch('/api/groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
      }).catch((e) => console.warn('Failed to sync group update to server:', e));
    }

    return validated;
  }

  async deleteGroup(id: string): Promise<boolean> {
    const groups = await this.getGroups();
    const filtered = groups.filter((g) => g.id !== id);
    if (filtered.length === groups.length) return false;
    this.save(filtered);

    // Sync deletion to server
    if (this.isClient()) {
      fetch(`/api/groups?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }).catch((e) => console.warn('Failed to sync group deletion to server:', e));
    }

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
    this.save([]);
    return [];
  }

  private save(groups: Group[]): void {
    if (!this.isClient()) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
      window.dispatchEvent(new Event('hiker_groups_updated'));
    } catch (err) {
      console.error('Failed to save groups to localStorage:', err);
    }
  }
}
