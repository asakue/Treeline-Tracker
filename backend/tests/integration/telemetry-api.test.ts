/**
 * @fileoverview Integration Tests for Telemetry Ingestion & History (/api/v1/telemetry)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createInMemoryRepositories } from '../../src/repositories/in-memory.repositories.js';
import { TokenService } from '../../src/auth/jwt.js';

describe('Telemetry REST API Integration Tests', () => {
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
      email: 'telemetryuser@treeline.org',
      passwordHash: 'dummy',
      displayName: 'Telemetry Tester',
      role: 'hiker',
      privacyMode: 'NORMAL',
      isActive: true,
    });
    userToken = tokenService.generateAccessToken(user);
  });

  it('ingests batch of telemetry points and sets latestPoint', async () => {
    const res = await request(app)
      .post('/api/v1/telemetry/batch')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        points: [
          {
            latitude: 43.3551,
            longitude: 42.4395,
            altitude: 2210,
            batteryLevel: 90,
            recordedAt: '2026-11-18T12:00:00.000Z',
          },
          {
            latitude: 43.3560,
            longitude: 42.4405,
            altitude: 2235,
            batteryLevel: 89,
            recordedAt: '2026-11-18T12:01:00.000Z',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.inserted).toBe(2);
    expect(res.body.data.latestPoint.latitude).toBe(43.3560);
  });

  it('rejects empty batch with 400 Bad Request (BATCH_SIZE_OUT_OF_BOUNDS)', async () => {
    const res = await request(app)
      .post('/api/v1/telemetry/batch')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ points: [] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BATCH_SIZE_OUT_OF_BOUNDS');
  });

  it('applies privacy mode transformations (STEALTH and REDUCED)', async () => {
    await request(app)
      .post('/api/v1/telemetry/batch')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        points: [
          {
            latitude: 43.123456,
            longitude: 42.654321,
            privacyMode: 'STEALTH',
            recordedAt: '2026-11-18T13:00:00.000Z',
          },
          {
            latitude: 43.123456,
            longitude: 42.654321,
            privacyMode: 'REDUCED',
            recordedAt: '2026-11-18T13:01:00.000Z',
          },
        ],
      });

    const stored = repos.telemetry.points;
    expect(stored).toHaveLength(2);

    // STEALTH zeroes coordinates
    expect(stored[0].latitude).toBe(0);
    expect(stored[0].longitude).toBe(0);

    // REDUCED rounds to 2 decimals
    expect(stored[1].latitude).toBe(43.12);
    expect(stored[1].longitude).toBe(42.65);
    expect(stored[1].accuracyM).toBe(1000);
  });

  it('queries historical telemetry time series', async () => {
    await repos.telemetry.insertBatch([
      {
        userId: user.id,
        latitude: 43.1,
        longitude: 42.1,
        transportType: 'INTERNET',
        privacyMode: 'NORMAL',
        isEmergency: false,
        recordedAt: new Date('2026-11-18T10:00:00.000Z'),
      },
      {
        userId: user.id,
        latitude: 43.2,
        longitude: 42.2,
        transportType: 'INTERNET',
        privacyMode: 'NORMAL',
        isEmergency: false,
        recordedAt: new Date('2026-11-18T11:00:00.000Z'),
      },
    ]);

    const res = await request(app)
      .get('/api/v1/telemetry/history')
      .set('Authorization', `Bearer ${userToken}`)
      .query({
        startTime: '2026-11-18T09:00:00.000Z',
        endTime: '2026-11-18T12:00:00.000Z',
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});
