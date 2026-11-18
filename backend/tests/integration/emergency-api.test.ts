/**
 * @fileoverview Integration Tests for Emergency SOS REST API (/api/v1/emergency)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createInMemoryRepositories } from '../../src/repositories/in-memory.repositories.js';
import { TokenService } from '../../src/auth/jwt.js';

describe('Emergency SOS REST API Integration Tests', () => {
  let app: any;
  let repos: any;
  let tokenService: any;
  let hikerToken: string;
  let rescuerToken: string;
  let otherHikerToken: string;
  let hikerUser: any;
  let rescuerUser: any;
  let otherHikerUser: any;

  beforeEach(async () => {
    repos = createInMemoryRepositories();
    tokenService = new TokenService(repos.tokens, 'integration-test-secret-key-32chars!');
    app = createApp({ repos, tokenService });

    hikerUser = await repos.users.create({
      email: 'hiker@treeline.org',
      passwordHash: 'dummy',
      displayName: 'Victim Hiker',
      role: 'hiker',
      privacyMode: 'NORMAL',
      isActive: true,
    });
    hikerToken = tokenService.generateAccessToken(hikerUser);

    rescuerUser = await repos.users.create({
      email: 'rescuer@treeline.org',
      passwordHash: 'dummy',
      displayName: 'SAR Rescuer',
      role: 'rescuer',
      privacyMode: 'NORMAL',
      isActive: true,
    });
    rescuerToken = tokenService.generateAccessToken(rescuerUser);

    otherHikerUser = await repos.users.create({
      email: 'other@treeline.org',
      passwordHash: 'dummy',
      displayName: 'Other Hiker',
      role: 'hiker',
      privacyMode: 'NORMAL',
      isActive: true,
    });
    otherHikerToken = tokenService.generateAccessToken(otherHikerUser);
  });

  it('triggers emergency SOS beacon without rate limiting and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/emergency/sos')
      .set('Authorization', `Bearer ${hikerToken}`)
      .send({
        type: 'MEDICAL_EMERGENCY',
        location: {
          latitude: 43.3550,
          longitude: 42.4392,
          altitude: 2200,
        },
        details: 'Травма ноги на тропе',
        batteryLevel: 68,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.emergencyId).toBeDefined();
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.senderId).toBe(hikerUser.id);
    expect(res.body.data.broadcasted).toBe(true);
    expect(res.headers['x-ratelimit-bypass']).toBe('EMERGENCY_PRIORITY_SOS');
  });

  it('triggers anonymous SOS without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/emergency/sos')
      .send({
        location: { latitude: 43.1, longitude: 42.1 },
        details: 'Анонимный сигнал SOS',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.senderId).toBe('anonymous-hiker');
  });

  it('allows rescuer to query active emergencies across the theater', async () => {
    await repos.emergencies.create({
      senderId: hikerUser.id,
      senderName: hikerUser.displayName,
      message: 'Active emergency 1',
      status: 'ACTIVE',
      latitude: 43.0,
      longitude: 42.0,
      type: 'SOS_SIGNAL',
    });

    const res = await request(app)
      .get('/api/v1/emergency/active')
      .set('Authorization', `Bearer ${rescuerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('allows rescuer to acknowledge active emergency', async () => {
    const em = await repos.emergencies.create({
      senderId: hikerUser.id,
      senderName: hikerUser.displayName,
      message: 'Need rescue',
      status: 'ACTIVE',
      latitude: 43.0,
      longitude: 42.0,
      type: 'SOS_SIGNAL',
    });

    const res = await request(app)
      .post(`/api/v1/emergency/${em.id}/acknowledge`)
      .set('Authorization', `Bearer ${rescuerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ACKNOWLEDGED');
    expect(res.body.data.acknowledgedBy).toContain(rescuerUser.id);
  });

  it('allows original reporter to resolve their own emergency', async () => {
    const em = await repos.emergencies.create({
      senderId: hikerUser.id,
      senderName: hikerUser.displayName,
      message: 'Lost on trail',
      status: 'ACTIVE',
      latitude: 43.0,
      longitude: 42.0,
      type: 'LOST_PERSON',
    });

    const res = await request(app)
      .post(`/api/v1/emergency/${em.id}/resolve`)
      .set('Authorization', `Bearer ${hikerToken}`)
      .send({ notes: 'Вышел к лагерю самостоятельно' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('RESOLVED');
  });

  it('rejects resolution attempt by another non-rescuer hiker with 403 Forbidden', async () => {
    const em = await repos.emergencies.create({
      senderId: hikerUser.id,
      senderName: hikerUser.displayName,
      message: 'Severe hypothermia',
      status: 'ACTIVE',
      latitude: 43.0,
      longitude: 42.0,
      type: 'MEDICAL_EMERGENCY',
    });

    const res = await request(app)
      .post(`/api/v1/emergency/${em.id}/resolve`)
      .set('Authorization', `Bearer ${otherHikerToken}`)
      .send({ notes: 'Fake cancel' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});
