/**
 * @fileoverview Cloud Firestore Implementation of IRouteRepository
 * Conforms to ADR-003 and requirements for persistent trail & route management in Cloud Firestore.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  type Firestore,
} from 'firebase/firestore';
import type { IRouteRepository } from './interfaces';
import type { Route } from '../domain/types';
import { RouteSchema } from '../domain/schemas';
import { getFirestoreInstance, isFirebaseConfigured } from '@/firebase';
import { LocalStorageRouteRepository } from './local-storage-route-repository';

const FIRESTORE_TIMEOUT_MS = 2000;

function withFirestoreTimeout<T>(promise: Promise<T>, ms = FIRESTORE_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Firestore request timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export class FirebaseRouteRepository implements IRouteRepository {
  private fallback: LocalStorageRouteRepository;
  private collectionName = 'routes';

  constructor() {
    this.fallback = new LocalStorageRouteRepository();
  }

  private getFirestore(): Firestore | null {
    if (!isFirebaseConfigured()) return null;
    return getFirestoreInstance();
  }

  async getRoutes(includeArchived = false): Promise<Route[]> {
    const firestore = this.getFirestore();
    if (!firestore) {
      return this.fallback.getRoutes(includeArchived);
    }

    try {
      const colRef = collection(firestore, this.collectionName);
      const snapshot = await withFirestoreTimeout(getDocs(colRef));
      if (snapshot.empty) {
        const local = await this.fallback.getRoutes(includeArchived);
        if (local.length > 0) {
          for (const r of local) {
            await this.createRoute(r).catch(() => {});
          }
        }
        return local;
      }

      const routes: Route[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        try {
          const validated = RouteSchema.parse({ id: docSnap.id, ...data });
          if (includeArchived || !validated.isArchived) {
            routes.push(validated);
          }
        } catch {
          if (includeArchived || !(data as Route).isArchived) {
            routes.push(data as Route);
          }
        }
      });

      return routes;
    } catch {
      // Unauthenticated or offline: gracefully serve from resilient local storage
      return this.fallback.getRoutes(includeArchived);
    }
  }

  async getActiveRoutes(): Promise<Route[]> {
    return this.getRoutes(false);
  }

  async getArchivedRoutes(): Promise<Route[]> {
    return this.getRoutes(true).then((routes) => routes.filter((r) => !!r.isArchived));
  }

  async getRouteById(id: string): Promise<Route | null> {
    const firestore = this.getFirestore();
    if (!firestore) {
      return this.fallback.getRouteById(id);
    }

    try {
      const docRef = doc(firestore, this.collectionName, id);
      const snap = await withFirestoreTimeout(getDoc(docRef));
      if (snap.exists()) {
        const data = snap.data();
        return RouteSchema.parse({ id: snap.id, ...data });
      }
      return this.fallback.getRouteById(id);
    } catch (err) {
      return this.fallback.getRouteById(id);
    }
  }

  async createRoute(route: Route): Promise<Route> {
    const validated = RouteSchema.parse(route);
    const firestore = this.getFirestore();

    await this.fallback.createRoute(validated).catch(() => {});

    if (!firestore) return validated;

    try {
      const docRef = doc(firestore, this.collectionName, validated.id);
      await withFirestoreTimeout(
        setDoc(docRef, {
          ...validated,
          version: validated.version || 1,
          updatedAt: Date.now(),
        })
      );
      return validated;
    } catch (err) {
      return validated;
    }
  }

  async updateRoute(route: Route): Promise<Route> {
    const validated = RouteSchema.parse({
      ...route,
      version: (route.version || 1) + 1,
      updatedAt: Date.now(),
    });

    const firestore = this.getFirestore();
    await this.fallback.updateRoute(validated).catch(() => {});

    if (!firestore) return validated;

    try {
      const docRef = doc(firestore, this.collectionName, validated.id);
      await withFirestoreTimeout(setDoc(docRef, validated, { merge: true }));
      return validated;
    } catch (err) {
      return validated;
    }
  }

  async archiveRoute(id: string): Promise<Route | null> {
    const route = await this.getRouteById(id);
    if (!route) return null;

    const updated = {
      ...route,
      isArchived: true,
      archivedAt: Date.now(),
      version: (route.version || 1) + 1,
    };

    return this.updateRoute(updated);
  }

  async restoreRoute(id: string): Promise<Route | null> {
    const route = await this.getRouteById(id);
    if (!route) return null;

    const updated = {
      ...route,
      isArchived: false,
      archivedAt: undefined,
      version: (route.version || 1) + 1,
    };

    return this.updateRoute(updated);
  }

  async deleteRoute(id: string): Promise<boolean> {
    await this.fallback.deleteRoute(id).catch(() => {});
    const firestore = this.getFirestore();
    if (!firestore) return true;

    try {
      const docRef = doc(firestore, this.collectionName, id);
      await withFirestoreTimeout(deleteDoc(docRef));
      return true;
    } catch (err) {
      return false;
    }
  }

  async clearArchive(): Promise<boolean> {
    const archived = await this.getArchivedRoutes();
    for (const r of archived) {
      await this.deleteRoute(r.id);
    }
    return true;
  }

  async resetToDefaults(): Promise<Route[]> {
    const defaults = await this.fallback.resetToDefaults();
    const firestore = this.getFirestore();
    if (firestore) {
      for (const r of defaults) {
        await this.createRoute(r).catch(() => {});
      }
    }
    return defaults;
  }
}
