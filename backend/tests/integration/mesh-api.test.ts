/**
 * @fileoverview Integration Tests for Mesh Nodes REST API (/api/v1/mesh)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createInMemoryRepositories } from '../../src/repositories/in-memory.repositories.js';
import { TokenService } from '../../src/auth/jwt.js';

describe('Mesh Nodes REST API Integration Tests', () => {
  let app: any;
  let repos: any;
  let tokenService: any;
  let userToken: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories();
    tokenService = new TokenService(repos.tokens, 'integration-test-secret-key-32chars!');
    app = createApp({ repos, tokenService });

    const user = await repos.users.create({
      email: 'meshop@treeline.org',
      passwordHash: 'dummy',
      displayName: 'Mesh Operator',
      role: 'guide',
      privacyMode: 'NORMAL',
      isActive: true,
    });
    userToken = tokenService.generateAccessToken(user);
  });

  it('registers hardware node with nodeNum and nodeIdStr', async () => {
    const res = await request(app)
      .post('/api/v1/mesh/nodes')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        nodeNum: 682283572,
        nodeIdStr: '!28ab1234',
        shortName: 'RELAY1',
        hwModel: 'HELTEC_V3',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nodeNum).toBe(682283572);
    expect(res.body.data.shortName).toBe('RELAY1');
  });

  it('updates heartbeat for registered node', async () => {
    // Register
    await request(app)
      .post('/api/v1/mesh/nodes')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ nodeNum: 1001, nodeIdStr: '!000003e9', shortName: 'NODE1' });

    // Heartbeat
    const hbRes = await request(app)
      .post('/api/v1/mesh/nodes/heartbeat')
      .send({
        nodeNum: 1001,
        batteryLevel: 85,
        voltage: 4.12,
        channelUtilization: 5.6,
      });

    expect(hbRes.status).toBe(200);
    expect(hbRes.body.data.status).toBe('ONLINE');
    expect(hbRes.body.data.lastHeard).toBeDefined();
  });

  it('lists registered mesh nodes', async () => {
    await repos.mesh.registerNode({
      nodeNum: 2001,
      nodeIdStr: '!000007d1',
      role: 'ROUTER',
    });

    const res = await request(app).get('/api/v1/mesh/nodes');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});
