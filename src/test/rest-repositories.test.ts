import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  RepositoryContainer,
  groupRepository,
  routeRepository,
  emergencyRepository,
  locationRepository,
  RestGroupRepository,
  RestRouteRepository,
  RestEmergencyRepository,
  RestLocationRepository,
} from '@/infrastructure/repositories';
import type { Group, Route, EmergencyEvent, LocationUpdate } from '@/core/domain/types';

describe('Milestone 3: REST Repositories & Complete Firebase Decoupling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    RepositoryContainer.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Absence of Firebase Config Files & Dependencies', () => {
    it('verifies all Firebase configuration and hosting files are completely removed', () => {
      const forbiddenFiles = [
        'firebase.json',
        'firestore.rules',
        'firebase-blueprint.json',
        'apphosting.yaml',
      ];

      for (const file of forbiddenFiles) {
        const filePath = path.resolve(process.cwd(), file);
        expect(fs.existsSync(filePath), `File "${file}" must not exist`).toBe(false);
      }
    });

    it('verifies dedicated Firebase directories are completely removed', () => {
      const forbiddenDirs = [
        path.resolve(process.cwd(), 'src/firebase'),
        path.resolve(process.cwd(), 'src/shared/config'),
      ];

      for (const dir of forbiddenDirs) {
        expect(fs.existsSync(dir), `Directory "${dir}" must not exist`).toBe(false);
      }
    });

    it('verifies package.json does not contain firebase in dependencies', () => {
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      expect(pkg.dependencies?.firebase).toBeUndefined();
      expect(pkg.devDependencies?.firebase).toBeUndefined();
    });

    it('verifies next.config.ts CSP does not allow Firebase endpoints', () => {
      const configPath = path.resolve(process.cwd(), 'next.config.ts');
      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).not.toContain('firestore.googleapis.com');
      expect(content).not.toContain('identitytoolkit.googleapis.com');
      expect(content).not.toContain('securetoken.googleapis.com');
    });
  });

  describe('2. Environment Specification & REST Configuration', () => {
    it('verifies .env.example specifies backend REST API and WebSocket URLs without Firebase keys', () => {
      const envExamplePath = path.resolve(process.cwd(), '.env.example');
      expect(fs.existsSync(envExamplePath)).toBe(true);

      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toContain('NEXT_PUBLIC_API_URL');
      expect(content).toContain('NEXT_PUBLIC_WS_URL');
      expect(content).not.toContain('NEXT_PUBLIC_FIREBASE_API_KEY');
      expect(content).not.toContain('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
    });
  });

  describe('3. Repository Container Factory & Singleton Provisioning', () => {
    it('provides RestGroupRepository instance by default', () => {
      const repo = RepositoryContainer.getGroupRepository();
      expect(repo).toBeDefined();
      expect(repo).toBeInstanceOf(RestGroupRepository);
      expect(typeof repo.getGroups).toBe('function');
      expect(typeof repo.createGroup).toBe('function');
      expect(typeof repo.updateGroup).toBe('function');
      expect(typeof repo.deleteGroup).toBe('function');
    });

    it('provides RestRouteRepository instance by default', () => {
      const repo = RepositoryContainer.getRouteRepository();
      expect(repo).toBeDefined();
      expect(repo).toBeInstanceOf(RestRouteRepository);
      expect(typeof repo.getRoutes).toBe('function');
      expect(typeof repo.createRoute).toBe('function');
      expect(typeof repo.archiveRoute).toBe('function');
      expect(typeof repo.restoreRoute).toBe('function');
    });

    it('provides RestEmergencyRepository instance by default', () => {
      const repo = RepositoryContainer.getEmergencyRepository();
      expect(repo).toBeDefined();
      expect(repo).toBeInstanceOf(RestEmergencyRepository);
      expect(typeof repo.createEvent).toBe('function');
      expect(typeof repo.getActiveEvents).toBe('function');
      expect(typeof repo.resolveEvent).toBe('function');
    });

    it('provides RestLocationRepository instance by default', () => {
      const repo = RepositoryContainer.getLocationRepository();
      expect(repo).toBeDefined();
      expect(repo).toBeInstanceOf(RestLocationRepository);
      expect(typeof repo.saveLocation).toBe('function');
      expect(typeof repo.getLastKnownLocation).toBe('function');
      expect(typeof repo.getLocationHistory).toBe('function');
    });

    it('maintains singleton identity until reset() is called', () => {
      const repo1 = RepositoryContainer.getGroupRepository();
      const repo2 = RepositoryContainer.getGroupRepository();
      expect(repo1).toBe(repo2);

      RepositoryContainer.reset();
      const repo3 = RepositoryContainer.getGroupRepository();
      expect(repo3).not.toBe(repo1);
    });

    it('exported singletons conform to contracts', () => {
      expect(groupRepository).toBeDefined();
      expect(routeRepository).toBeDefined();
      expect(emergencyRepository).toBeDefined();
      expect(locationRepository).toBeDefined();
    });
  });

  describe('4. RestGroupRepository Operations, Event Bus & Offline Fallback', () => {
    const mockGroup: Group = {
      id: 'grp-rest-caucasus',
      name: 'Экспедиция на Эльбрус',
      location: 'Приэльбрусье',
      distance: '24 км',
      difficulty: 'Сложно',
      leaderName: 'Алексей Смирнов',
      safeRadiusMeters: 500,
      hikers: [
        {
          id: 'usr-guide-01',
          name: 'Алексей Смирнов',
          avatar: '',
          role: 'LEADER',
          status: 'На тропе',
          battery: 95,
          coords: '43.3550° с.ш., 42.4392° в.д.',
          lastUpdate: 'только что',
          lastUpdateTimestamp: Date.now(),
        },
      ],
    };

    it('creates, retrieves, and dispatches events via RestGroupRepository', async () => {
      const eventsFired: string[] = [];
      const listener = () => eventsFired.push('hiker_groups_updated');
      window.addEventListener('hiker_groups_updated', listener);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        const method = init?.method || 'GET';
        if (method === 'POST') {
          return new Response(JSON.stringify({ success: true, data: mockGroup }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (method === 'GET') {
          return new Response(JSON.stringify({ success: true, data: [mockGroup] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      });

      const repo = new RestGroupRepository();

      // Create group
      const created = await repo.createGroup(mockGroup);
      expect(created.id).toBe(mockGroup.id);
      expect(eventsFired).toContain('hiker_groups_updated');

      // Retrieve groups
      const allGroups = await repo.getGroups();
      expect(allGroups.length).toBeGreaterThanOrEqual(1);
      expect(allGroups.some((g) => g.id === mockGroup.id)).toBe(true);

      // Add member
      const newMember = {
        id: 'usr-hiker-02',
        name: 'Елена Соколова',
        avatar: '',
        role: 'MEMBER' as const,
        status: 'На тропе' as const,
        battery: 88,
        coords: '43.3552° с.ш., 42.4390° в.д.',
        lastUpdate: 'только что',
        lastUpdateTimestamp: Date.now(),
      };
      const updated = await repo.addMember(mockGroup.id, newMember);
      expect(updated.hikers.length).toBe(2);

      // Remove member
      const afterRemoval = await repo.removeMember(mockGroup.id, 'usr-hiker-02');
      expect(afterRemoval.hikers.length).toBe(1);

      // Cleanup
      await repo.deleteGroup(mockGroup.id);
      window.removeEventListener('hiker_groups_updated', listener);
    });

    it('transparently falls back to localStorage when network is offline', async () => {
      // Simulate network disconnection
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Failed to fetch (offline)'));

      const repo = new RestGroupRepository();

      // Create group offline
      const created = await repo.createGroup(mockGroup);
      expect(created.id).toBe(mockGroup.id);

      // Retrieve group offline from local cache
      const groups = await repo.getGroups();
      expect(groups.length).toBe(1);
      expect(groups[0].name).toBe('Экспедиция на Эльбрус');

      // Get by id offline
      const fetched = await repo.getGroupById(mockGroup.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.leaderName).toBe('Алексей Смирнов');

      await repo.deleteGroup(mockGroup.id);
    });
  });

  describe('5. RestRouteRepository Operations & Archival Workflow', () => {
    const mockRoute: Route = {
      id: 'route-caucasus-30',
      name: 'Через горы к морю (Тропа 30)',
      location: 'Кавказский заповедник',
      difficulty: 'Сложно',
      distance: '45 км',
      time: '3 дня',
      type: 'Пеший',
      altitude: '2800 м',
      coordinates: '43.95° с.ш., 39.90° в.д.',
      path: [
        [43.95, 39.90],
        [43.98, 39.95],
      ],
      isArchived: false,
    };

    it('creates, archives, restores, and queries routes via RestRouteRepository', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        const method = init?.method || 'GET';
        if (method === 'POST') {
          return new Response(JSON.stringify({ success: true, data: mockRoute }), { status: 200 });
        }
        if (method === 'PUT' && init?.body) {
          const body = JSON.parse(init.body as string);
          return new Response(JSON.stringify({ success: true, data: body }), { status: 200 });
        }
        if (method === 'GET') {
          return new Response(JSON.stringify({ success: true, data: [mockRoute] }), { status: 200 });
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      });

      const repo = new RestRouteRepository();

      // Create
      const created = await repo.createRoute(mockRoute);
      expect(created.id).toBe(mockRoute.id);

      // Archive route
      const archived = await repo.archiveRoute(mockRoute.id);
      expect(archived?.isArchived).toBe(true);

      // Restore route
      const restored = await repo.restoreRoute(mockRoute.id);
      expect(restored?.isArchived).toBe(false);

      // Delete route
      const deleted = await repo.deleteRoute(mockRoute.id);
      expect(deleted).toBe(true);
    });

    it('maintains route data across offline state via LocalStorage fallback', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      const repo = new RestRouteRepository();
      await repo.createRoute(mockRoute);

      const activeRoutes = await repo.getActiveRoutes();
      expect(activeRoutes.some((r) => r.id === mockRoute.id)).toBe(true);

      await repo.archiveRoute(mockRoute.id);
      const archivedRoutes = await repo.getArchivedRoutes();
      expect(archivedRoutes.some((r) => r.id === mockRoute.id)).toBe(true);

      await repo.deleteRoute(mockRoute.id);
    });
  });

  describe('6. RestEmergencyRepository Priority Dispatch & SOS Handling', () => {
    const mockSosEvent: EmergencyEvent = {
      id: 'emg-rest-sos-01',
      senderId: 'usr-hiker-lost',
      senderName: 'Дмитрий Волков',
      timestamp: Date.now(),
      location: {
        latitude: 43.355,
        longitude: 42.439,
        altitude: 3500,
        accuracy: 4,
      },
      type: 'SOS_SIGNAL',
      message: 'Падение со склона, повреждение связок',
      status: 'ACTIVE',
      batteryLevel: 35,
      acknowledgedBy: [],
    };

    it('triggers SOS alert, acknowledges by rescuer, and resolves event', async () => {
      let currentEvent = { ...mockSosEvent };

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        const method = init?.method || 'GET';
        if (method === 'POST') {
          const body = JSON.parse(init?.body as string);
          if (body.action === 'resolve') {
            currentEvent.status = 'RESOLVED';
            return new Response(JSON.stringify({ success: true, data: currentEvent }), { status: 200 });
          }
          return new Response(JSON.stringify({ success: true, data: mockSosEvent }), { status: 200 });
        }
        return new Response(JSON.stringify({ success: true, data: [currentEvent] }), { status: 200 });
      });

      const repo = new RestEmergencyRepository();

      // Trigger SOS
      const created = await repo.createEvent(mockSosEvent);
      expect(created.id).toBe(mockSosEvent.id);
      expect(created.status).toBe('ACTIVE');

      // Acknowledge by rescuer
      const acked = await repo.acknowledgeEvent(mockSosEvent.id, 'usr-rescuer-99');
      expect(acked.status).toBe('ACKNOWLEDGED');
      expect(acked.acknowledgedBy).toContain('usr-rescuer-99');

      // Resolve event
      const resolved = await repo.resolveEvent(mockSosEvent.id);
      expect(resolved.status).toBe('RESOLVED');
    });

    it('stores SOS events locally when offline without throwing unhandled exceptions', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No cellular connection'));

      const repo = new RestEmergencyRepository();
      const created = await repo.createEvent(mockSosEvent);
      expect(created.id).toBe(mockSosEvent.id);

      const active = await repo.getActiveEvents();
      expect(active.length).toBeGreaterThanOrEqual(1);
      expect(active.some((e) => e.id === mockSosEvent.id)).toBe(true);
    });
  });

  describe('7. RestLocationRepository Telemetry Tracking', () => {
    const mockLocation: LocationUpdate = {
      hikerId: 'usr-tracker-01',
      latitude: 43.355,
      longitude: 42.439,
      altitude: 3200,
      accuracy: 5,
      timestamp: Date.now(),
      privacyMode: 'NORMAL',
      batteryLevel: 90,
    };

    it('records location breadcrumbs and retrieves telemetry history', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const repo = new RestLocationRepository();

      await repo.saveLocation(mockLocation);

      const lastKnown = await repo.getLastKnownLocation('usr-tracker-01');
      expect(lastKnown).not.toBeNull();
      expect(lastKnown?.latitude).toBe(43.355);
      expect(lastKnown?.longitude).toBe(42.439);

      const history = await repo.getLocationHistory('usr-tracker-01');
      expect(history.length).toBe(1);

      await repo.clearHistory('usr-tracker-01');
      const cleared = await repo.getLocationHistory('usr-tracker-01');
      expect(cleared.length).toBe(0);
    });
  });
});
