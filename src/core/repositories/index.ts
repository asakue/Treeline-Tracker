/**
 * @fileoverview Repository Container and Factory Singletons
 */

import { IGroupRepository, IRouteRepository, ILocationRepository, IEmergencyRepository } from './interfaces';
import { LocalStorageGroupRepository } from './local-storage-group-repository';
import { LocalStorageRouteRepository } from './local-storage-route-repository';
import { LocalStorageLocationRepository } from './local-storage-location-repository';
import { LocalStorageEmergencyRepository } from './local-storage-emergency-repository';

export * from './interfaces';
export * from './local-storage-group-repository';
export * from './local-storage-route-repository';
export * from './local-storage-location-repository';
export * from './local-storage-emergency-repository';

class RepositoryContainer {
  private static groupRepo: IGroupRepository;
  private static routeRepo: IRouteRepository;
  private static locationRepo: ILocationRepository;
  private static emergencyRepo: IEmergencyRepository;

  public static getGroupRepository(): IGroupRepository {
    if (!this.groupRepo) {
      this.groupRepo = new LocalStorageGroupRepository();
    }
    return this.groupRepo;
  }

  public static getRouteRepository(): IRouteRepository {
    if (!this.routeRepo) {
      this.routeRepo = new LocalStorageRouteRepository();
    }
    return this.routeRepo;
  }

  public static getLocationRepository(): ILocationRepository {
    if (!this.locationRepo) {
      this.locationRepo = new LocalStorageLocationRepository();
    }
    return this.locationRepo;
  }

  public static getEmergencyRepository(): IEmergencyRepository {
    if (!this.emergencyRepo) {
      this.emergencyRepo = new LocalStorageEmergencyRepository();
    }
    return this.emergencyRepo;
  }
}

export const groupRepository = RepositoryContainer.getGroupRepository();
export const routeRepository = RepositoryContainer.getRouteRepository();
export const locationRepository = RepositoryContainer.getLocationRepository();
export const emergencyRepository = RepositoryContainer.getEmergencyRepository();
