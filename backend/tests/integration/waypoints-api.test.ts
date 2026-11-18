/**
 * @fileoverview Integration Tests for Waypoints REST API (/api/v1/waypoints)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createInMemoryRepositories } from '../../src/repositories/in-memory.repositories.js';
import { TokenService } from '../../src/auth/jwt.js';

describe('Waypoints REST API Integration Tests', () => {
  let app: any;
  let repos: any;
  let tokenService: any;
  let userToken: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories();
    tokenService = new TokenService(repos.tokens, 'integration-test-secret-key-32chars!');
    app = createApp({ repos, tokenService });

    const user = await repos.users.create({
      email: 'cartographer@treeline.org',
      passwordHash: 'dummy',
      displayName: 'Cartographer',
      role: 'guide',
      privacyMode: 'NORMAL',
      isActive: true,
    });
    userToken = tokenService.generateAccessToken(user);
  });

  it('creates tactical waypoint with symbol and hazard radius', async () => {
    const res = await request(app)
      .post('/api/v1/waypoints')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Camp 1 (Glacier Edge)',
        symbol: 'CAMP',
        latitude: 43.3582,
        longitude: 42.4435,
        altitude: 2350,
        isHazard: false,
        sequenceOrder: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.symbol).toBe('CAMP');
    expect(res.body.data.latitude).toBe(43.3582);
  });

  it('lists waypoints sorted by sequence order', async () => {
    await request(app)
      .post('/api/v1/waypoints')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Finish', latitude: 43.4, longitude: 42.5, sequenceOrder: 2 });

    await request(app)
      .post('/api/v1/waypoints')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Start', latitude: 43.3, longitude: 42.4, sequenceOrder: 0 });

    const res = await request(app)
      .get('/api/v1/waypoints')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].name).toBe('Start');
    expect(res.body.data[1].name).toBe('Finish');
  });

  it('deletes waypoint by ID', async () => {
    const createRes = await request(app)
      .post('/api/v1/waypoints')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Temporary Waypoint', latitude: 43.1, longitude: 42.1 });

    const wpId = createRes.body.data.id;

    const delRes = await request(app)
      .delete(`/api/v1/waypoints/${wpId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.data.deleted).toBe(true);
  });
});
