/**
 * @fileoverview REST Implementation of IEmergencyRepository with Resilient LocalStorage Fallback
 */

import type { IEmergencyRepository } from '@/core/repositories/interfaces';
import type { EmergencyEvent } from '@/core/domain/types';
import { EmergencyEventSchema } from '@/core/domain/schemas';
import { LocalStorageEmergencyRepository } from '@/core/repositories/local-storage-emergency-repository';
import { BaseRestRepository } from './base-rest-repository';

export class RestEmergencyRepository extends BaseRestRepository implements IEmergencyRepository {
  private fallback: LocalStorageEmergencyRepository;
  private endpoint = '/api/emergency';

  constructor(fallback?: LocalStorageEmergencyRepository) {
    super();
    this.fallback = fallback || new LocalStorageEmergencyRepository();
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

    // Optimistic local update & window event dispatch
    await this.fallback.createEvent(validated).catch(() => {});

    if (this.isOnline()) {
      try {
        const created = await this.fetchWithTimeout<EmergencyEvent>(
          this.toUrl(this.endpoint),
          {
            method: 'POST',
            body: JSON.stringify({
              action: 'create',
              senderId: validated.senderId,
              senderName: validated.senderName,
              location: validated.location,
              type: validated.type,
              message: validated.message,
              batteryLevel: validated.batteryLevel,
            }),
          },
          1500 // SOS priority timeout
        );
        return created || validated;
      } catch (err) {
        console.warn('[RestEmergencyRepository] createEvent queued in local fallback:', err);
      }
    }
    return validated;
  }

  async acknowledgeEvent(eventId: string, acknowledgedByHikerId: string): Promise<EmergencyEvent> {
    return this.fallback.acknowledgeEvent(eventId, acknowledgedByHikerId);
  }

  async resolveEvent(eventId: string): Promise<EmergencyEvent> {
    await this.fallback.resolveEvent(eventId).catch(() => {});

    if (this.isOnline()) {
      try {
        await this.fetchWithTimeout<EmergencyEvent>(this.toUrl(this.endpoint), {
          method: 'POST',
          body: JSON.stringify({
            action: 'resolve',
            id: eventId,
          }),
        });
      } catch (err) {
        console.warn('[RestEmergencyRepository] resolveEvent network sync error:', err);
      }
    }

    const event = await this.fallback.getEventById(eventId);
    if (!event) throw new Error(`Emergency event ${eventId} not found`);
    return event;
  }

  async getAllEvents(): Promise<EmergencyEvent[]> {
    if (!this.isOnline()) {
      return this.fallback.getAllEvents();
    }

    try {
      const events = await this.fetchWithTimeout<EmergencyEvent[]>(this.toUrl(this.endpoint), {
        method: 'GET',
      });
      if (Array.isArray(events)) {
        for (const e of events) {
          await this.fallback.createEvent(e).catch(() => {});
        }
        return events;
      }
      return this.fallback.getAllEvents();
    } catch (err) {
      console.warn('[RestEmergencyRepository] getAllEvents failed, using fallback:', err);
      return this.fallback.getAllEvents();
    }
  }
}
