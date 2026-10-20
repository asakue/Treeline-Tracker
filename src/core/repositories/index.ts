/**
 * @fileoverview Repository Container and Factory Singletons
 * Dynamically provides Cloud Firestore repositories when Firebase credentials are configured,
 * or resilient LocalStorage repositories when operating in purely autonomous/offline mode (ADR-003).
 */

import { IGroupRepository, IRouteRepository, ILocationRepository, IEmergencyRepository } from './interfaces';
import { LocalStorageGroupRepository } from './local-storage-group-repository';
import { LocalStorageRouteRepository } from './local-storage-route-repository';
import { LocalStorageLocationRepository } from './local-storage-location-repository';
import { LocalStorageEmergencyRepository } from './local-storage-emergency-repository';
import { FirebaseGroupRepository } from './firebase-group-repository';
import { FirebaseRouteRepository } from './firebase-route-repository';
import { FirebaseEmergencyRepository } from './firebase-emergency-repository';
import { isFirebaseConfigured } from '@/firebase';

export * from './interfaces';
export * from './local-storage-group-repository';
export * from './local-storage-route-repository';
export * from './local-storage-location-repository';
export * from './local-storage-emergency-repository';
export * from './firebase-group-repository';
export * from './firebase-route-repository';
export * from './firebase-emergency-repository';

class RepositoryContainer {
  private static groupRepo: IGroupRepository;
  private static routeRepo: IRouteRepository;
  private static locationRepo: ILocationRepository;
  private static emergencyRepo: IEmergencyRepository;

  public static getGroupRepository(): IGroupRepository {
    if (!this.groupRepo) {
      this.groupRepo = isFirebaseConfigured()
        ? new FirebaseGroupRepository()
        : new LocalStorageGroupRepository();
    }
    return this.groupRepo;
  }

  public static getRouteRepository(): IRouteRepository {
    if (!this.routeRepo) {
      this.routeRepo = isFirebaseConfigured()
        ? new FirebaseRouteRepository()
        : new LocalStorageRouteRepository();
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
      this.emergencyRepo = isFirebaseConfigured()
        ? new FirebaseEmergencyRepository()
        : new LocalStorageEmergencyRepository();
    }
    return this.emergencyRepo;
  }

  /**
   * Reset instances (useful for testing or switching environments)
   */
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
export { RepositoryContainer };
