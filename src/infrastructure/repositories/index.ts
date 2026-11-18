/**
 * @fileoverview Repository Container and Dependency Injection Singletons
 * Decoupled from Firebase; provides production REST repositories with resilient offline fallback.
 */

import {
  IGroupRepository,
  IRouteRepository,
  ILocationRepository,
  IEmergencyRepository,
} from '@/core/repositories/interfaces';
import { RestGroupRepository } from './rest/rest-group-repository';
import { RestRouteRepository } from './rest/rest-route-repository';
import { RestEmergencyRepository } from './rest/rest-emergency-repository';
import { RestLocationRepository } from './rest/rest-location-repository';
import { LocalStorageGroupRepository } from '@/core/repositories/local-storage-group-repository';
import { LocalStorageRouteRepository } from '@/core/repositories/local-storage-route-repository';
import { LocalStorageEmergencyRepository } from '@/core/repositories/local-storage-emergency-repository';
import { LocalStorageLocationRepository } from '@/core/repositories/local-storage-location-repository';

export * from '@/core/repositories/interfaces';
export * from './rest';
export * from '@/core/repositories/local-storage-group-repository';
export * from '@/core/repositories/local-storage-route-repository';
export * from '@/core/repositories/local-storage-emergency-repository';
export * from '@/core/repositories/local-storage-location-repository';

export class RepositoryContainer {
  private static groupRepo: IGroupRepository;
  private static routeRepo: IRouteRepository;
  private static locationRepo: ILocationRepository;
  private static emergencyRepo: IEmergencyRepository;

  public static getGroupRepository(): IGroupRepository {
    if (!this.groupRepo) {
      const forceLocal = process.env.NEXT_PUBLIC_STORAGE_MODE === 'local';
      this.groupRepo = forceLocal
        ? new LocalStorageGroupRepository()
        : new RestGroupRepository();
    }
    return this.groupRepo;
  }

  public static getRouteRepository(): IRouteRepository {
    if (!this.routeRepo) {
      const forceLocal = process.env.NEXT_PUBLIC_STORAGE_MODE === 'local';
      this.routeRepo = forceLocal
        ? new LocalStorageRouteRepository()
        : new RestRouteRepository();
    }
    return this.routeRepo;
  }

  public static getLocationRepository(): ILocationRepository {
    if (!this.locationRepo) {
      const forceLocal = process.env.NEXT_PUBLIC_STORAGE_MODE === 'local';
      this.locationRepo = forceLocal
        ? new LocalStorageLocationRepository()
        : new RestLocationRepository();
    }
    return this.locationRepo;
  }

  public static getEmergencyRepository(): IEmergencyRepository {
    if (!this.emergencyRepo) {
      const forceLocal = process.env.NEXT_PUBLIC_STORAGE_MODE === 'local';
      this.emergencyRepo = forceLocal
        ? new LocalStorageEmergencyRepository()
        : new RestEmergencyRepository();
    }
    return this.emergencyRepo;
  }

  public static reset(): void {
    this.groupRepo = undefined as any;
    this.routeRepo = undefined as any;
    this.locationRepo = undefined as any;
    this.emergencyRepo = undefined as any;
  }
}

export const groupRepository = RepositoryContainer.getGroupRepository();
export const routeRepository = RepositoryContainer.getRouteRepository();
export const locationRepository = RepositoryContainer.getLocationRepository();
export const emergencyRepository = RepositoryContainer.getEmergencyRepository();
