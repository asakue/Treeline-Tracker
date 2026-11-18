/**
 * @fileoverview Integration Tests for Tracks REST API & Navigation Evaluation (/api/v1/tracks)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createInMemoryRepositories } from '../../src/repositories/in-memory.repositories.js';
import { TokenService } from '../../src/auth/jwt.js';

describe('Tracks REST API & Evaluation Integration Tests', () => {
  let app: any;
  let repos: any;
  let tokenService: any;
  let userToken: string;
  let user: any;

  beforeEach(async () => {
    repos = createInMemoryRepositories();
    tokenService = new TokenService(repos.tokens, 'integration-test-secret-key-32chars!');
    app = createApp({ repos, tokenService });

    user = await repos.users.create({
      email: 'trailguide@treeline.org',
      passwordHash: 'dummy-hash',
      displayName: 'Trail Guide',
      role: 'guide',
      privacyMode: 'NORMAL',
      isActive: true,
    });
    userToken = tokenService.generateAccessToken(user);
  });

  it('creates track and automatically computes distance and duration', async () => {
    const samplePath = [
      [43.3550, 42.4392, 2200],
      [43.3570, 42.4410, 2280],
      [43.3600, 42.4450, 2400],
    ];

    const res = await request(app)
      .post('/api/v1/tracks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Elbrus Acclimatization Loop',
        difficulty: 'Сложно',
        path: samplePath,
        corridorWidthMeters: 60,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.distanceKm).toBeGreaterThan(0);
    expect(res.body.data.elevationGainM).toBe(200);
    expect(res.body.data.elevationLossM).toBe(0);
    expect(res.body.data.version).toBe(1);
  });

  it('rejects path with less than 2 coordinate points with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/v1/tracks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Invalid Single Point Track',
        path: [[43.3550, 42.4392]],
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('evaluates cross-track distance, progress, and off-track alert on /:id/evaluate', async () => {
    // 1. Create a straight west-to-east path along latitude 43.0
    const createRes = await request(app)
      .post('/api/v1/tracks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Navigation Test Line',
        corridorWidthMeters: 50,
        path: [
          [43.0, 42.0],
          [43.0, 42.1],
          [43.0, 42.2],
        ],
      });

    const trackId = createRes.body.data.id;

    // 2. Evaluate point on track (heading East = 90°)
    const onTrackRes = await request(app)
      .post(`/api/v1/tracks/${trackId}/evaluate`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        latitude: 43.0,
        longitude: 42.05,
        heading: 90,
      });

    expect(onTrackRes.status).toBe(200);
    expect(onTrackRes.body.data.isOffTrack).toBe(false);
    expect(onTrackRes.body.data.crossTrackDistanceMeters).toBeLessThan(10);
    expect(onTrackRes.body.data.direction.directionStatus).toBe('ALIGNED');
    expect(onTrackRes.body.data.direction.isMovingBackwards).toBe(false);

    // 3. Evaluate point far off track with reverse heading (heading West = 270°)
    const offTrackRes = await request(app)
      .post(`/api/v1/tracks/${trackId}/evaluate`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        latitude: 43.005, // ~550m North (exceeds 50m corridor)
        longitude: 42.05,
        heading: 270, // moving backwards!
      });

    expect(offTrackRes.status).toBe(200);
    expect(offTrackRes.body.data.isOffTrack).toBe(true);
    expect(offTrackRes.body.data.direction.directionStatus).toBe('REVERSE');
    expect(offTrackRes.body.data.direction.isMovingBackwards).toBe(true);
    expect(offTrackRes.body.data.alerts.length).toBeGreaterThanOrEqual(2);
  });

  it('updates track with OCC and returns 409 on version mismatch', async () => {
    const createRes = await request(app)
      .post('/api/v1/tracks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'OCC Track',
        path: [[43.0, 42.0], [43.1, 42.1]],
      });

    const trackId = createRes.body.data.id;

    // Successful update with version 1 -> increments to 2
    const update1 = await request(app)
      .put(`/api/v1/tracks/${trackId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'OCC Track V2', version: 1 });

    expect(update1.status).toBe(200);
    expect(update1.body.data.version).toBe(2);

    // Stale update with version 1 -> triggers 409
    const updateConflict = await request(app)
      .put(`/api/v1/tracks/${trackId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'OCC Stale', version: 1 });

    expect(updateConflict.status).toBe(409);
    expect(updateConflict.body.code).toBe('OCC_VERSION_CONFLICT');
  });
});
