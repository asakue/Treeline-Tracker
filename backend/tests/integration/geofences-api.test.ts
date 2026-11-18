/**
 * @fileoverview Integration Tests for Geofences REST API & Perimeter Checks (/api/v1/geofences)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createInMemoryRepositories } from '../../src/repositories/in-memory.repositories.js';
import { TokenService } from '../../src/auth/jwt.js';

describe('Geofences REST API & Breach Check Integration Tests', () => {
  let app: any;
  let repos: any;
  let tokenService: any;
  let guideToken: string;
  let teamId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories();
    tokenService = new TokenService(repos.tokens, 'integration-test-secret-key-32chars!');
    app = createApp({ repos, tokenService });

    const user = await repos.users.create({
      email: 'geofenceguard@treeline.org',
      passwordHash: 'dummy',
      displayName: 'Geofence Lead',
      role: 'guide',
      privacyMode: 'NORMAL',
      isActive: true,
    });
    guideToken = tokenService.generateAccessToken(user);

    const team = await repos.teams.create({
      name: 'Safety Boundary Team',
      location: 'Caucasus',
      distance: '0 км',
      difficulty: 'Средне',
      createdByUserId: user.id,
      safeRadiusMeters: 500,
      status: 'ACTIVE',
    });
    teamId = team.id;
  });

  it('creates circular safety buffer geofence', async () => {
    const res = await request(app)
      .post('/api/v1/geofences')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({
        teamId,
        name: 'Camp Safety Perimeter',
        fenceType: 'CAMP_PERIMETER',
        shapeType: 'CIRCLE',
        centerLatitude: 43.3550,
        centerLongitude: 42.4392,
        radiusMeters: 400,
        breachAction: 'ALERT_TEAM',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.shapeType).toBe('CIRCLE');
    expect(res.body.data.radiusMeters).toBe(400);
  });

  it('creates polygon exclusion zone geofence', async () => {
    const res = await request(app)
      .post('/api/v1/geofences')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({
        teamId,
        name: 'Crevasse Exclusion Field',
        fenceType: 'EXCLUSION_ZONE',
        shapeType: 'POLYGON',
        polygonCoordinates: [
          [43.3590, 42.4450],
          [43.3610, 42.4470],
          [43.3600, 42.4490],
          [43.3580, 42.4460],
        ],
        breachAction: 'TRIGGER_SOS',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.shapeType).toBe('POLYGON');
  });

  it('evaluates circular boundary breach on /:id/check', async () => {
    // 1. Create 500m radius circle at (43.0, 42.0)
    const createRes = await request(app)
      .post('/api/v1/geofences')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({
        teamId,
        name: 'Base Circle',
        fenceType: 'SAFETY_BUFFER',
        shapeType: 'CIRCLE',
        centerLatitude: 43.0,
        centerLongitude: 42.0,
        radiusMeters: 500,
      });

    const fenceId = createRes.body.data.id;

    // 2. Point inside circle
    const insideRes = await request(app)
      .post(`/api/v1/geofences/${fenceId}/check`)
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ latitude: 43.001, longitude: 42.001 }); // ~130m away

    expect(insideRes.status).toBe(200);
    expect(insideRes.body.data.status).toBe('INSIDE');
    expect(insideRes.body.data.isBreached).toBe(false);

    // 3. Point outside circle (breach)
    const outsideRes = await request(app)
      .post(`/api/v1/geofences/${fenceId}/check`)
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ latitude: 43.01, longitude: 42.01 }); // ~1400m away

    expect(outsideRes.status).toBe(200);
    expect(outsideRes.body.data.status).toBe('BREACH');
    expect(outsideRes.body.data.isBreached).toBe(true);
  });
});
