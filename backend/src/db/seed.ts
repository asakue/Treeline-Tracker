/**
 * @fileoverview Database Seeding Fixtures
 * Creates baseline administrator, guides, demo expedition teams, tracks, waypoints, and geofences.
 */

import { db, queryClient } from './client.js';
import { users, teams, teamMembers, tracks, waypoints, geofences, meshNodes } from './schema.js';
import { passwordService } from '../auth/password.js';

export async function seedDatabase() {
  console.log('[Seed] Starting Treeline Tracker database seeding...');

  try {
    // 1. Seed Users
    const defaultPassword = 'TreelinePassword2026!';
    const passwordHash = await passwordService.hash(defaultPassword);

    const [admin] = await db.insert(users).values({
      email: 'admin@treeline.org',
      passwordHash,
      displayName: 'System Administrator',
      role: 'admin',
      phone: '+79991112233',
      emergencyContact: '+79991112234',
      privacyMode: 'NORMAL',
    }).onConflictDoNothing().returning();

    const [guide] = await db.insert(users).values({
      email: 'guide@treeline.org',
      passwordHash,
      displayName: 'Алексей Горный (Lead Guide)',
      role: 'guide',
      phone: '+79992223344',
      emergencyContact: '+79992223345',
      privacyMode: 'NORMAL',
    }).onConflictDoNothing().returning();

    const [rescuer] = await db.insert(users).values({
      email: 'rescuer@treeline.org',
      passwordHash,
      displayName: 'МЧС Спасатель Смирнов',
      role: 'rescuer',
      phone: '+79993334455',
      emergencyContact: '+79993334456',
      privacyMode: 'NORMAL',
    }).onConflictDoNothing().returning();

    const [hiker] = await db.insert(users).values({
      email: 'hiker@treeline.org',
      passwordHash,
      displayName: 'Иван Турист',
      role: 'hiker',
      phone: '+79994445566',
      emergencyContact: '+79994445567',
      privacyMode: 'NORMAL',
    }).onConflictDoNothing().returning();

    console.log('[Seed] Users seeded successfully.');

    const creatorId = guide?.id || admin?.id;
    if (!creatorId) {
      console.log('[Seed] Users already present or IDs unavailable, continuing...');
      return;
    }

    // 2. Seed Teams
    const [team] = await db.insert(teams).values({
      name: 'Кавказ-Траверс 2026',
      callsign: 'KAVKAZ-ALPHA',
      description: 'Горная экспедиция высшей категории сложности',
      location: 'Приэльбрусье',
      distance: '48.5 км',
      difficulty: 'Сложно',
      createdByUserId: creatorId,
      adminId: admin?.id,
      safeRadiusMeters: 500.0,
      status: 'ACTIVE',
      version: 1,
    }).returning();

    if (team) {
      // Team Members
      await db.insert(teamMembers).values([
        { teamId: team.id, userId: creatorId, role: 'LEADER' },
        ...(hiker ? [{ teamId: team.id, userId: hiker.id, role: 'MEMBER' as const }] : []),
        ...(rescuer ? [{ teamId: team.id, userId: rescuer.id, role: 'RESCUER' as const }] : []),
      ]).onConflictDoNothing();

      // 3. Seed Track
      const samplePath = [
        [43.3550, 42.4392, 2200],
        [43.3565, 42.4410, 2280],
        [43.3582, 42.4435, 2350],
        [43.3601, 42.4470, 2460],
        [43.3625, 42.4515, 2600],
      ];

      const [track] = await db.insert(tracks).values({
        teamId: team.id,
        userId: creatorId,
        name: 'Тропа на Приют Одинадцати',
        description: 'Классический подъем от поляны Азау',
        location: 'Эльбрус (Южный склон)',
        difficulty: 'Сложно',
        distance: '12.4 км',
        distanceKm: 12.4,
        time: '5 ч',
        type: 'Пеший',
        altitude: '4050 м',
        coordinates: '43.3550° с.ш., 42.4392° в.д.',
        estimatedDurationMin: 300,
        elevationGainM: 1850.0,
        elevationLossM: 50.0,
        trackType: 'PLANNED',
        path: samplePath,
        corridorWidthMeters: 75.0,
        isCustom: true,
        version: 1,
      }).returning();

      // 4. Seed Waypoints
      if (track) {
        await db.insert(waypoints).values([
          {
            trackId: track.id,
            teamId: team.id,
            createdByUserId: creatorId,
            name: 'Старт: Поляна Азау',
            description: 'Базовый лагерь и подъемник',
            symbol: 'START',
            latitude: 43.3550,
            longitude: 42.4392,
            altitude: 2200.0,
            sequenceOrder: 0,
            isHazard: false,
          },
          {
            trackId: track.id,
            teamId: team.id,
            createdByUserId: creatorId,
            name: 'Ледниковая трещина #1',
            description: 'Опасный участок открытого ледника. Требуется связка.',
            symbol: 'HAZARD',
            latitude: 43.3582,
            longitude: 42.4435,
            altitude: 2350.0,
            sequenceOrder: 1,
            isHazard: true,
            hazardRadiusMeters: 50.0,
          },
          {
            trackId: track.id,
            teamId: team.id,
            createdByUserId: creatorId,
            name: 'Штурмовой лагерь (Приют)',
            description: 'Место ночевки перед выходом на вершину',
            symbol: 'CAMP',
            latitude: 43.3625,
            longitude: 42.4515,
            altitude: 2600.0,
            sequenceOrder: 2,
            isHazard: false,
          },
        ]);
      }

      // 5. Seed Geofences
      await db.insert(geofences).values([
        {
          teamId: team.id,
          name: 'Периметр безопасности базового лагеря',
          fenceType: 'CAMP_PERIMETER',
          shapeType: 'CIRCLE',
          centerLatitude: 43.3550,
          centerLongitude: 42.4392,
          radiusMeters: 500.0,
          breachAction: 'ALERT_TEAM',
          isActive: true,
          createdByUserId: creatorId,
        },
        {
          teamId: team.id,
          name: 'Зона ледового сброса (Запретная зона)',
          fenceType: 'EXCLUSION_ZONE',
          shapeType: 'POLYGON',
          polygonCoordinates: [
            [43.3590, 42.4450],
            [43.3610, 42.4470],
            [43.3600, 42.4490],
            [43.3580, 42.4460],
          ],
          breachAction: 'TRIGGER_SOS',
          isActive: true,
          createdByUserId: creatorId,
        },
      ]);

      // 6. Seed Mesh Node
      await db.insert(meshNodes).values({
        nodeNum: 2984572910,
        nodeIdStr: '!b1e2c3d4',
        longName: 'Heltec V3 Relay Base',
        shortName: 'BASE',
        hwModel: 'HELTEC_V3',
        macAddress: '94:B5:55:2A:B1:C4',
        publicKey: '2e8c2a514d7a4697bfb218177309ff92d19914613c7c252271891b72e50c4103',
        userId: creatorId,
        teamId: team.id,
        role: 'ROUTER_CLIENT',
        batteryLevel: 98,
        voltage: 4.18,
        channelUtilization: 4.2,
        airUtilTx: 0.8,
        latitude: 43.3550,
        longitude: 42.4392,
        altitude: 2205.0,
        lastHeard: new Date(),
      }).onConflictDoNothing();

      console.log('[Seed] Teams, tracks, waypoints, geofences, and mesh nodes seeded.');
    }

    console.log('[Seed] Seeding completed successfully.');
  } catch (err) {
    console.error('[Seed] Error seeding database:', err);
    throw err;
  }
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
