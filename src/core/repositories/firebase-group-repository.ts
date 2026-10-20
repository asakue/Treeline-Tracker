/**
 * @fileoverview Cloud Firestore Implementation of IGroupRepository
 * Conforms to ADR-003 and requirements for Cloud Firestore synchronization with
 * multi-tab persistent IndexedDB local cache.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import type { IGroupRepository } from './interfaces';
import type { Group, Member, LocationUpdate } from '../domain/types';
import { GroupSchema } from '../domain/schemas';
import { getFirestoreInstance, isFirebaseConfigured } from '@/firebase';
import { LocalStorageGroupRepository } from './local-storage-group-repository';

export class FirebaseGroupRepository implements IGroupRepository {
  private fallback: LocalStorageGroupRepository;
  private collectionName = 'groups';

  constructor() {
    this.fallback = new LocalStorageGroupRepository();
  }

  private getFirestore(): Firestore | null {
    if (!isFirebaseConfigured()) return null;
    return getFirestoreInstance();
  }

  async getGroups(): Promise<Group[]> {
    const firestore = this.getFirestore();
    if (!firestore) {
      return this.fallback.getGroups();
    }

    try {
      const colRef = collection(firestore, this.collectionName);
      const snapshot = await getDocs(colRef);
      if (snapshot.empty) {
        // If Firestore is empty, fallback to local storage / default groups
        const localGroups = await this.fallback.getGroups();
        if (localGroups.length > 0) {
          // Opportunistically populate Firestore with initial groups
          for (const g of localGroups) {
            await this.createGroup(g).catch(() => {});
          }
        }
        return localGroups;
      }

      const groups: Group[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        try {
          const validated = GroupSchema.parse({ id: docSnap.id, ...data });
          groups.push(validated);
        } catch {
          groups.push(data as Group);
        }
      });

      return groups;
    } catch (err) {
      console.warn('[FirebaseGroupRepository] Firestore read error, falling back to local storage:', err);
      return this.fallback.getGroups();
    }
  }

  async getGroupById(id: string): Promise<Group | null> {
    const firestore = this.getFirestore();
    if (!firestore) {
      return this.fallback.getGroupById(id);
    }

    try {
      const docRef = doc(firestore, this.collectionName, id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return GroupSchema.parse({ id: snap.id, ...data });
      }
      return this.fallback.getGroupById(id);
    } catch (err) {
      console.warn(`[FirebaseGroupRepository] Firestore getDoc(${id}) error:`, err);
      return this.fallback.getGroupById(id);
    }
  }

  async createGroup(group: Group): Promise<Group> {
    const validated = GroupSchema.parse(group);
    const firestore = this.getFirestore();

    // Always update local fallback
    await this.fallback.createGroup(validated).catch(() => {});

    if (!firestore) return validated;

    try {
      const docRef = doc(firestore, this.collectionName, validated.id);
      await setDoc(docRef, {
        ...validated,
        updatedAt: Date.now(),
        version: validated.version || 1,
      });
      return validated;
    } catch (err) {
      console.warn('[FirebaseGroupRepository] Firestore createGroup error:', err);
      return validated;
    }
  }

  async updateGroup(group: Group): Promise<Group> {
    const validated = GroupSchema.parse({
      ...group,
      version: (group.version || 1) + 1,
      updatedAt: Date.now(),
    });

    const firestore = this.getFirestore();
    await this.fallback.updateGroup(validated).catch(() => {});

    if (!firestore) return validated;

    try {
      const docRef = doc(firestore, this.collectionName, validated.id);
      await setDoc(docRef, validated, { merge: true });
      return validated;
    } catch (err) {
      console.warn('[FirebaseGroupRepository] Firestore updateGroup error:', err);
      return validated;
    }
  }

  async deleteGroup(id: string): Promise<boolean> {
    await this.fallback.deleteGroup(id).catch(() => {});
    const firestore = this.getFirestore();
    if (!firestore) return true;

    try {
      const docRef = doc(firestore, this.collectionName, id);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      console.warn(`[FirebaseGroupRepository] Firestore deleteGroup(${id}) error:`, err);
      return false;
    }
  }

  async addMember(groupId: string, member: Member): Promise<Group> {
    const group = await this.getGroupById(groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);

    const existingHikers = group.hikers || [];
    const index = existingHikers.findIndex((h) => h.id === member.id);
    let updatedHikers: Member[];

    if (index >= 0) {
      updatedHikers = [...existingHikers];
      updatedHikers[index] = member;
    } else {
      updatedHikers = [...existingHikers, member];
    }

    const updatedGroup: Group = {
      ...group,
      hikers: updatedHikers,
      version: (group.version || 1) + 1,
      updatedAt: Date.now(),
    };

    return this.updateGroup(updatedGroup);
  }

  async removeMember(groupId: string, memberId: string): Promise<Group> {
    const group = await this.getGroupById(groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);

    const updatedGroup: Group = {
      ...group,
      hikers: (group.hikers || []).filter((h) => h.id !== memberId),
      version: (group.version || 1) + 1,
      updatedAt: Date.now(),
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

    const coordStr = `${location.latitude.toFixed(4)}° с.ш., ${location.longitude.toFixed(4)}° в.д.`;
    const updatedHikers = (group.hikers || []).map((hiker) => {
      if (hiker.id === memberId) {
        return {
          ...hiker,
          coords: coordStr,
          lastLocation: location,
          battery: location.batteryLevel !== undefined ? location.batteryLevel : hiker.battery,
          lastUpdate: 'Только что',
          lastUpdateTimestamp: location.timestamp,
        };
      }
      return hiker;
    });

    const updatedGroup: Group = {
      ...group,
      hikers: updatedHikers,
      updatedAt: Date.now(),
    };

    return this.updateGroup(updatedGroup);
  }

  async resetToDefaults(): Promise<Group[]> {
    const defaults = await this.fallback.resetToDefaults();
    const firestore = this.getFirestore();
    if (firestore) {
      for (const g of defaults) {
        await this.createGroup(g).catch(() => {});
      }
    }
    return defaults;
  }
}
