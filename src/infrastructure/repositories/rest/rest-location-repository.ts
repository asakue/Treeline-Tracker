/**
 * @fileoverview REST Implementation of ILocationRepository with Resilient LocalStorage Fallback
 */

import type { ILocationRepository } from '@/core/repositories/interfaces';
import type { LocationUpdate } from '@/core/domain/types';
import { LocationUpdateSchema } from '@/core/domain/schemas';
import { LocalStorageLocationRepository } from '@/core/repositories/local-storage-location-repository';
import { BaseRestRepository } from './base-rest-repository';

export class RestLocationRepository extends BaseRestRepository implements ILocationRepository {
  private fallback: LocalStorageLocationRepository;
  private endpoint = '/api/locations';

  constructor(fallback?: LocalStorageLocationRepository) {
    super();
    this.fallback = fallback || new LocalStorageLocationRepository();
  }

  async getLastKnownLocation(hikerId: string): Promise<LocationUpdate | null> {
    return this.fallback.getLastKnownLocation(hikerId);
  }

  async saveLocation(location: LocationUpdate): Promise<void> {
    const validated = LocationUpdateSchema.parse(location);

    // Save to local telemetry history
    await this.fallback.saveLocation(validated);

    if (this.isOnline()) {
      try {
        await this.fetchWithTimeout<void>(this.toUrl(this.endpoint), {
          method: 'POST',
          body: JSON.stringify(validated),
        });
      } catch (err) {
        console.warn('[RestLocationRepository] saveLocation background sync failed:', err);
      }
    }
  }

  async getLocationHistory(hikerId: string, sinceTimestamp?: number): Promise<LocationUpdate[]> {
    return this.fallback.getLocationHistory(hikerId, sinceTimestamp);
  }

  async clearHistory(hikerId?: string): Promise<void> {
    return this.fallback.clearHistory(hikerId);
  }
}
