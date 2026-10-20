/**
 * @fileoverview Cloud Firestore Implementation of IEmergencyRepository
 * Real-time emergency & SOS coordination through Cloud Firestore with multi-tab offline cache.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { IEmergencyRepository } from './interfaces';
import type { EmergencyEvent } from '../domain/types';
import { EmergencyEventSchema } from '../domain/schemas';
import { getFirestoreInstance, isFirebaseConfigured } from '@/firebase';
import { LocalStorageEmergencyRepository } from './local-storage-emergency-repository';

export class FirebaseEmergencyRepository implements IEmergencyRepository {
  private fallback: LocalStorageEmergencyRepository;
  private collectionName = 'emergency_events';

  constructor() {
    this.fallback = new LocalStorageEmergencyRepository();
  }

  private getFirestore(): Firestore | null {
    if (!isFirebaseConfigured()) return null;
    return getFirestoreInstance();
  }

  async getActiveEvents(): Promise<EmergencyEvent[]> {
    const all = await this.getAllEvents();
    return all.filter((e) => e.status === 'ACTIVE' || e.status === 'ACKNOWLEDGED');
  }

  async getEventById(id: string): Promise<EmergencyEvent | null> {
    const firestore = this.getFirestore();
    if (!firestore) return this.fallback.getEventById(id);

    try {
      const docRef = doc(firestore, this.collectionName, id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return EmergencyEventSchema.parse({ id: snap.id, ...data });
      }
      return this.fallback.getEventById(id);
    } catch (err) {
      console.warn(`[FirebaseEmergencyRepository] Firestore getEventById(${id}) error:`, err);
      return this.fallback.getEventById(id);
    }
  }

  async createEvent(event: EmergencyEvent): Promise<EmergencyEvent> {
    const validated = EmergencyEventSchema.parse(event);
    await this.fallback.createEvent(validated).catch(() => {});

    const firestore = this.getFirestore();
    if (!firestore) return validated;

    try {
      const docRef = doc(firestore, this.collectionName, validated.id);
      await setDoc(docRef, {
        ...validated,
        createdAt: Date.now(),
      });
      return validated;
    } catch (err) {
      console.warn('[FirebaseEmergencyRepository] Firestore createEvent error:', err);
      return validated;
    }
  }

  async acknowledgeEvent(eventId: string, acknowledgedByHikerId: string): Promise<EmergencyEvent> {
    const event = await this.getEventById(eventId);
    if (!event) throw new Error(`Emergency event ${eventId} not found`);

    const updatedAcks = Array.from(new Set([...event.acknowledgedBy, acknowledgedByHikerId]));
    const updatedEvent: EmergencyEvent = {
      ...event,
      status: 'ACKNOWLEDGED',
      acknowledgedBy: updatedAcks,
    };

    await this.fallback.acknowledgeEvent(eventId, acknowledgedByHikerId).catch(() => {});

    const firestore = this.getFirestore();
    if (firestore) {
      const docRef = doc(firestore, this.collectionName, eventId);
      await setDoc(docRef, updatedEvent, { merge: true }).catch(() => {});
    }

    return updatedEvent;
  }

  async resolveEvent(eventId: string): Promise<EmergencyEvent> {
    const event = await this.getEventById(eventId);
    if (!event) throw new Error(`Emergency event ${eventId} not found`);

    const updatedEvent: EmergencyEvent = {
      ...event,
      status: 'RESOLVED',
    };

    await this.fallback.resolveEvent(eventId).catch(() => {});

    const firestore = this.getFirestore();
    if (firestore) {
      const docRef = doc(firestore, this.collectionName, eventId);
      await setDoc(docRef, updatedEvent, { merge: true }).catch(() => {});
    }

    return updatedEvent;
  }

  async getAllEvents(): Promise<EmergencyEvent[]> {
    const firestore = this.getFirestore();
    if (!firestore) return this.fallback.getAllEvents();

    try {
      const colRef = collection(firestore, this.collectionName);
      const snapshot = await getDocs(colRef);
      if (snapshot.empty) return this.fallback.getAllEvents();

      const events: EmergencyEvent[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        try {
          events.push(EmergencyEventSchema.parse({ id: docSnap.id, ...data }));
        } catch {
          events.push(data as EmergencyEvent);
        }
      });

      return events;
    } catch (err) {
      console.warn('[FirebaseEmergencyRepository] Firestore getAllEvents error:', err);
      return this.fallback.getAllEvents();
    }
  }
}
