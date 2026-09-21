/**
 * @fileoverview LocalStorage Implementation of IEmergencyRepository
 * Manages SOS and emergency events with persistence and acknowledgment tracking.
 */

import type { IEmergencyRepository } from './interfaces';
import type { EmergencyEvent } from '../domain/types';
import { EmergencyEventSchema } from '../domain/schemas';

const EMERGENCY_STORAGE_KEY = 'hiker_emergency_events';

export class LocalStorageEmergencyRepository implements IEmergencyRepository {
  private isClient(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  async getActiveEvents(): Promise<EmergencyEvent[]> {
    const all = await this.getAllEvents();
    return all.filter((e) => e.status === 'ACTIVE' || e.status === 'ACKNOWLEDGED');
  }

  async getEventById(id: string): Promise<EmergencyEvent | null> {
    const all = await this.getAllEvents();
    return all.find((e) => e.id === id) || null;
  }

  async createEvent(event: EmergencyEvent): Promise<EmergencyEvent> {
    const validated = EmergencyEventSchema.parse(event);
    const all = await this.getAllEvents();
    const updated = [validated, ...all];
    this.save(updated);
    return validated;
  }

  async acknowledgeEvent(eventId: string, acknowledgedByHikerId: string): Promise<EmergencyEvent> {
    const all = await this.getAllEvents();
    const event = all.find((e) => e.id === eventId);
    if (!event) throw new Error(`Emergency event ${eventId} not found`);

    const updatedAcks = Array.from(new Set([...event.acknowledgedBy, acknowledgedByHikerId]));
    const updatedEvent: EmergencyEvent = {
      ...event,
      status: 'ACKNOWLEDGED',
      acknowledgedBy: updatedAcks,
    };

    const updatedAll = all.map((e) => (e.id === eventId ? updatedEvent : e));
    this.save(updatedAll);
    return updatedEvent;
  }

  async resolveEvent(eventId: string): Promise<EmergencyEvent> {
    const all = await this.getAllEvents();
    const event = all.find((e) => e.id === eventId);
    if (!event) throw new Error(`Emergency event ${eventId} not found`);

    const updatedEvent: EmergencyEvent = {
      ...event,
      status: 'RESOLVED',
    };

    const updatedAll = all.map((e) => (e.id === eventId ? updatedEvent : e));
    this.save(updatedAll);
    return updatedEvent;
  }

  async getAllEvents(): Promise<EmergencyEvent[]> {
    if (!this.isClient()) return [];
    try {
      const raw = localStorage.getItem(EMERGENCY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as EmergencyEvent[];
      return [];
    } catch {
      return [];
    }
  }

  private save(events: EmergencyEvent[]): void {
    if (!this.isClient()) return;
    try {
      localStorage.setItem(EMERGENCY_STORAGE_KEY, JSON.stringify(events));
      window.dispatchEvent(new Event('hiker_emergency_updated'));
    } catch (err) {
      console.error('Failed to save emergency events:', err);
    }
  }
}
