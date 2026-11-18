/**
 * @fileoverview REST Implementation of IGroupRepository with Resilient LocalStorage Fallback
 */

import type { IGroupRepository } from '@/core/repositories/interfaces';
import type { Group, Member, LocationUpdate } from '@/core/domain/types';
import { GroupSchema } from '@/core/domain/schemas';
import { LocalStorageGroupRepository } from '@/core/repositories/local-storage-group-repository';
import { BaseRestRepository } from './base-rest-repository';

export class RestGroupRepository extends BaseRestRepository implements IGroupRepository {
  private fallback: LocalStorageGroupRepository;
  private endpoint = '/api/groups';

  constructor(fallback?: LocalStorageGroupRepository) {
    super();
    this.fallback = fallback || new LocalStorageGroupRepository();
  }

  async getGroups(): Promise<Group[]> {
    if (!this.isOnline()) {
      return this.fallback.getGroups();
    }

    try {
      const groups = await this.fetchWithTimeout<Group[]>(this.toUrl(this.endpoint), {
        method: 'GET',
      });
      if (Array.isArray(groups)) {
        // Hydrate local cache for offline resiliency
        for (const g of groups) {
          await this.fallback.createGroup(g).catch(() => {});
        }
        return groups;
      }
      return this.fallback.getGroups();
    } catch (err) {
      console.warn('[RestGroupRepository] getGroups network failure, serving from fallback:', err);
      return this.fallback.getGroups();
    }
  }

  async getGroupById(id: string): Promise<Group | null> {
    const cached = await this.fallback.getGroupById(id);
    if (!this.isOnline()) return cached;

    try {
      const groups = await this.getGroups();
      const found = groups.find((g) => g.id === id);
      return found || cached;
    } catch {
      return cached;
    }
  }

  async createGroup(group: Group): Promise<Group> {
    const validated = GroupSchema.parse(group);

    // Optimistic local update & window event dispatch
    await this.fallback.createGroup(validated).catch(() => {});

    if (this.isOnline()) {
      try {
        const created = await this.fetchWithTimeout<Group>(this.toUrl(this.endpoint), {
          method: 'POST',
          body: JSON.stringify(validated),
        });
        return (created && created.id) ? created : validated;
      } catch (err) {
        console.warn('[RestGroupRepository] createGroup offline fallback preserved:', err);
      }
    }
    return validated;
  }

  async updateGroup(group: Group): Promise<Group> {
    const validated = GroupSchema.parse({
      ...group,
      version: (group.version || 1) + 1,
      updatedAt: Date.now(),
    });

    // Optimistic local update & window event dispatch
    await this.fallback.updateGroup(validated).catch(() => {});

    if (this.isOnline()) {
      try {
        const updated = await this.fetchWithTimeout<Group>(this.toUrl(this.endpoint), {
          method: 'PUT',
          body: JSON.stringify(validated),
        });
        return (updated && updated.id) ? updated : validated;
      } catch (err) {
        console.warn('[RestGroupRepository] updateGroup offline fallback preserved:', err);
      }
    }
    return validated;
  }

  async deleteGroup(id: string): Promise<boolean> {
    await this.fallback.deleteGroup(id).catch(() => {});

    if (this.isOnline()) {
      try {
        await this.fetchWithTimeout<{ success: boolean }>(
          this.toUrl(`${this.endpoint}?id=${encodeURIComponent(id)}`),
          { method: 'DELETE' }
        );
        return true;
      } catch (err) {
        console.warn('[RestGroupRepository] deleteGroup network failure:', err);
      }
    }
    return true;
  }

  async addMember(groupId: string, member: Member): Promise<Group> {
    const updated = await this.fallback.addMember(groupId, member);
    if (this.isOnline()) {
      try {
        await this.fetchWithTimeout<Group>(this.toUrl(this.endpoint), {
          method: 'PUT',
          body: JSON.stringify(updated),
        });
      } catch (err) {
        console.warn('[RestGroupRepository] addMember network sync failed:', err);
      }
    }
    return updated;
  }

  async removeMember(groupId: string, memberId: string): Promise<Group> {
    const updated = await this.fallback.removeMember(groupId, memberId);
    if (this.isOnline()) {
      try {
        await this.fetchWithTimeout<Group>(this.toUrl(this.endpoint), {
          method: 'PUT',
          body: JSON.stringify(updated),
        });
      } catch (err) {
        console.warn('[RestGroupRepository] removeMember network sync failed:', err);
      }
    }
    return updated;
  }

  async updateMemberLocation(
    groupId: string,
    memberId: string,
    location: LocationUpdate
  ): Promise<Group> {
    return this.fallback.updateMemberLocation(groupId, memberId, location);
  }

  async resetToDefaults(): Promise<Group[]> {
    return this.fallback.resetToDefaults();
  }
}
