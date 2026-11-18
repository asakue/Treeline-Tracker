/**
 * @fileoverview Integration Tests for Teams REST API & OCC Versioning (/api/v1/teams)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createInMemoryRepositories } from '../../src/repositories/in-memory.repositories.js';
import { TokenService } from '../../src/auth/jwt.js';

describe('Teams REST API & OCC Concurrency Integration Tests', () => {
  let app: any;
  let repos: any;
  let tokenService: any;
  let guideToken: string;
  let hikerToken: string;
  let guideUser: any;
  let hikerUser: any;

  beforeEach(async () => {
    repos = createInMemoryRepositories();
    tokenService = new TokenService(repos.tokens, 'integration-test-secret-key-32chars!');
    app = createApp({ repos, tokenService });

    // Seed Guide User
    guideUser = await repos.users.create({
      email: 'leadguide@treeline.org',
      passwordHash: 'dummy-hash',
      displayName: 'Lead Guide',
      role: 'guide',
      privacyMode: 'NORMAL',
      isActive: true,
    });
    guideToken = tokenService.generateAccessToken(guideUser);

    // Seed Hiker User
    hikerUser = await repos.users.create({
      email: 'hiker@treeline.org',
      passwordHash: 'dummy-hash',
      displayName: 'Simple Hiker',
      role: 'hiker',
      privacyMode: 'NORMAL',
      isActive: true,
    });
    hikerToken = tokenService.generateAccessToken(hikerUser);
  });

  it('allows guide to create a team, auto-assigning them as LEADER', async () => {
    const res = await request(app)
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({
        name: 'Elbrus Expedition 2026',
        callsign: 'ELBRUS-1',
        safeRadiusMeters: 600,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Elbrus Expedition 2026');
    expect(res.body.data.version).toBe(1);

    const members = await repos.teams.getMembers(res.body.data.id);
    expect(members).toHaveLength(1);
    expect(members[0].userId).toBe(guideUser.id);
    expect(members[0].role).toBe('LEADER');
  });

  it('rejects team creation by normal hiker with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${hikerToken}`)
      .send({ name: 'Unauthorized Team' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('updates team successfully with correct OCC version token', async () => {
    const createRes = await request(app)
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ name: 'Initial Team Name', safeRadiusMeters: 500 });

    const teamId = createRes.body.data.id;
    expect(createRes.body.data.version).toBe(1);

    const updateRes = await request(app)
      .put(`/api/v1/teams/${teamId}`)
      .set('Authorization', `Bearer ${guideToken}`)
      .send({
        name: 'Updated Team Name',
        version: 1, // Correct matching version
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe('Updated Team Name');
    expect(updateRes.body.data.version).toBe(2); // Incremented
  });

  it('CRITICAL OCC TEST: returns 409 Conflict when update is attempted with stale version', async () => {
    // 1. Create team at version 1
    const createRes = await request(app)
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ name: 'OCC Concurrency Team' });

    const teamId = createRes.body.data.id;

    // 2. Client A updates to version 2
    const updateA = await request(app)
      .put(`/api/v1/teams/${teamId}`)
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ name: 'Client A Win', version: 1 });
    expect(updateA.status).toBe(200);
    expect(updateA.body.data.version).toBe(2);

    // 3. Client B attempts update with stale version 1
    const updateB = await request(app)
      .put(`/api/v1/teams/${teamId}`)
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ name: 'Client B Stale Overwrite', version: 1 });

    expect(updateB.status).toBe(409);
    expect(updateB.body.code).toBe('OCC_VERSION_CONFLICT');
    expect(updateB.body.details.expectedVersion).toBe(1);
    expect(updateB.body.details.currentVersion).toBe(2);
  });

  it('adds and removes team members', async () => {
    const team = await repos.teams.create({
      name: 'Roster Test Team',
      location: 'Altay',
      distance: '10 км',
      difficulty: 'Легко',
      createdByUserId: guideUser.id,
      safeRadiusMeters: 500,
      status: 'ACTIVE',
    });

    // Add member
    const addRes = await request(app)
      .post(`/api/v1/teams/${team.id}/members`)
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ userId: hikerUser.id, role: 'MEDIC' });

    expect(addRes.status).toBe(201);
    expect(addRes.body.data.userId).toBe(hikerUser.id);
    expect(addRes.body.data.role).toBe('MEDIC');

    // Remove member
    const remRes = await request(app)
      .delete(`/api/v1/teams/${team.id}/members/${hikerUser.id}`)
      .set('Authorization', `Bearer ${guideToken}`);

    expect(remRes.status).toBe(200);
    expect(remRes.body.data.removed).toBe(true);
  });
});
