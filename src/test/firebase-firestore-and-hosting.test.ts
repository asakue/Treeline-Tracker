import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isFirebaseConfigured, firebaseConfig } from '@/shared/config/firebase-config';
import { RepositoryContainer } from '@/core/repositories';
import { LocalStorageGroupRepository } from '@/core/repositories/local-storage-group-repository';
import { FirebaseGroupRepository } from '@/core/repositories/firebase-group-repository';
import { FirebaseRouteRepository } from '@/core/repositories/firebase-route-repository';
import { FirebaseEmergencyRepository } from '@/core/repositories/firebase-emergency-repository';
import type { Group, Route, EmergencyEvent } from '@/core/domain/types';
import fs from 'fs';
import path from 'path';

describe('Firebase App Hosting & Cloud Firestore Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    RepositoryContainer.reset();
  });

  describe('Configuration & App Hosting Spec', () => {
    it('verifies apphosting.yaml exists and contains production runConfig and secrets', () => {
      const appHostingPath = path.resolve(process.cwd(), 'apphosting.yaml');
      expect(fs.existsSync(appHostingPath)).toBe(true);

      const content = fs.readFileSync(appHostingPath, 'utf-8');
      expect(content).toContain('runConfig:');
      expect(content).toContain('maxInstances:');
      expect(content).toContain('GEMINI_API_KEY');
      expect(content).toContain('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
    });

    it('verifies .env.example documents all required Firebase client keys', () => {
      const envExamplePath = path.resolve(process.cwd(), '.env.example');
      expect(fs.existsSync(envExamplePath)).toBe(true);

      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toContain('NEXT_PUBLIC_FIREBASE_API_KEY');
      expect(content).toContain('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
      expect(content).toContain('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
      expect(content).toContain('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
      expect(content).toContain('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
      expect(content).toContain('NEXT_PUBLIC_FIREBASE_APP_ID');
      expect(content).toContain('GEMINI_API_KEY');
    });

    it('correctly detects if Firebase is configured via isFirebaseConfigured()', () => {
      expect(typeof isFirebaseConfigured()).toBe('boolean');
    });
  });

  describe('Repository Container (ADR-003 Factory)', () => {
    it('provides resilient LocalStorageGroupRepository when Firebase is not configured', () => {
      const repo = RepositoryContainer.getGroupRepository();
      expect(repo).toBeDefined();
      expect(typeof repo.getGroups).toBe('function');
      expect(typeof repo.createGroup).toBe('function');
    });

    it('provides resilient RouteRepository and EmergencyRepository singletons', () => {
      const routeRepo = RepositoryContainer.getRouteRepository();
      const emergencyRepo = RepositoryContainer.getEmergencyRepository();

      expect(routeRepo).toBeDefined();
      expect(emergencyRepo).toBeDefined();
      expect(typeof routeRepo.getRoutes).toBe('function');
      expect(typeof emergencyRepo.getActiveEvents).toBe('function');
    });
  });

  describe('FirebaseGroupRepository', () => {
    const mockGroup: Group = {
      id: 'grp-caucasus-test',
      name: 'Тестовая экспедиция Фишт',
      location: 'Западный Кавказ',
      distance: '18.5 км',
      difficulty: 'Сложно',
      leaderName: 'Михаил Решетников',
      safeRadiusMeters: 450,
      hikers: [
        {
          id: 'usr-guide-test',
          name: 'Михаил Решетников',
          avatar: '',
          role: 'LEADER',
          status: 'На тропе',
          battery: 92,
          coords: '43.95° с.ш., 39.90° в.д.',
          lastUpdate: 'Только что',
          lastUpdateTimestamp: Date.now(),
        },
      ],
    };

    it('successfully creates, retrieves and manages members via FirebaseGroupRepository with offline fallback', async () => {
      const repo = new FirebaseGroupRepository();

      // Create
      const created = await repo.createGroup(mockGroup);
      expect(created.id).toBe(mockGroup.id);
      expect(created.name).toBe(mockGroup.name);

      // Get by ID
      const fetched = await repo.getGroupById(mockGroup.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.leaderName).toBe('Михаил Решетников');

      // Add Member
      const newMember = {
        id: 'usr-hiker-test-2',
        name: 'Анна Васильева',
        avatar: '',
        role: 'MEMBER' as const,
        status: 'На тропе' as const,
        battery: 80,
        coords: '43.95° с.ш., 39.91° в.д.',
        lastUpdate: 'Только что',
        lastUpdateTimestamp: Date.now(),
      };

      const withMember = await repo.addMember(mockGroup.id, newMember);
      expect(withMember.hikers.length).toBe(2);

      // Remove Member
      const afterRemoval = await repo.removeMember(mockGroup.id, 'usr-hiker-test-2');
      expect(afterRemoval.hikers.length).toBe(1);

      // Cleanup
      await repo.deleteGroup(mockGroup.id);
    });
  });

  describe('FirebaseRouteRepository', () => {
    const mockRoute: Route = {
      id: 'route-fisht-01',
      name: 'Через горы к морю (Маршрут №30)',
      location: 'Кавказский биосферный заповедник',
      difficulty: 'Сложно',
      distance: '48 км',
      time: '3 дня',
      type: 'trekking',
      altitude: '2867 м',
      coordinates: '43.95° с.ш., 39.90° в.д.',
      path: [
        [43.95, 39.90],
        [43.98, 39.95],
      ],
    };

    it('manages route creation, updates, and archival via FirebaseRouteRepository', async () => {
      const repo = new FirebaseRouteRepository();

      // Create
      const created = await repo.createRoute(mockRoute);
      expect(created.id).toBe(mockRoute.id);

      // Archive
      const archived = await repo.archiveRoute(mockRoute.id);
      expect(archived?.isArchived).toBe(true);

      // Restore
      const restored = await repo.restoreRoute(mockRoute.id);
      expect(restored?.isArchived).toBe(false);

      // Cleanup
      await repo.deleteRoute(mockRoute.id);
    });
  });

  describe('FirebaseEmergencyRepository', () => {
    const mockEvent: EmergencyEvent = {
      id: 'emg-test-999',
      senderId: 'usr-hiker-sos',
      senderName: 'Иван Петров',
      timestamp: Date.now(),
      location: {
        latitude: 43.35,
        longitude: 42.44,
        altitude: 3900,
        accuracy: 5,
      },
      type: 'SOS_SIGNAL',
      message: 'Травма голеностопа при спуске с морены',
      status: 'ACTIVE',
      batteryLevel: 45,
      acknowledgedBy: [],
    };

    it('creates, acknowledges and resolves emergency SOS events', async () => {
      const repo = new FirebaseEmergencyRepository();

      // Create
      const created = await repo.createEvent(mockEvent);
      expect(created.id).toBe(mockEvent.id);
      expect(created.status).toBe('ACTIVE');

      // Acknowledge by rescuer
      const acked = await repo.acknowledgeEvent(mockEvent.id, 'usr-rescuer-01');
      expect(acked.status).toBe('ACKNOWLEDGED');
      expect(acked.acknowledgedBy).toContain('usr-rescuer-01');

      // Resolve
      const resolved = await repo.resolveEvent(mockEvent.id);
      expect(resolved.status).toBe('RESOLVED');
    });
  });
});
