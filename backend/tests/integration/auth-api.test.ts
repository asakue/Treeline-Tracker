/**
 * @fileoverview Integration Tests for Auth REST API (/api/v1/auth)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createInMemoryRepositories } from '../../src/repositories/in-memory.repositories.js';
import { TokenService } from '../../src/auth/jwt.js';
import { SlidingWindowRateLimiter } from '../../src/middleware/rate-limiter.js';

describe('Auth REST API Integration Tests', () => {
  let app: any;
  let repos: any;
  let tokenService: any;
  let rateLimiter: any;

  beforeEach(() => {
    repos = createInMemoryRepositories();
    tokenService = new TokenService(repos.tokens, 'integration-test-secret-key-32chars!');
    rateLimiter = new SlidingWindowRateLimiter({
      authTier: { windowMs: 60 * 1000, maxRequests: 50 },
    });

    app = createApp({
      repos,
      tokenService,
      rateLimiter,
    });
  });

  it('registers a new user and returns 201 with access and refresh tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'newuser@treeline.org',
        password: 'ValidPassword123!',
        displayName: 'New Explorer',
        role: 'hiker',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('newuser@treeline.org');
    expect(res.body.data.user.displayName).toBe('New Explorer');
    expect(res.body.data.user.passwordHash).toBeUndefined(); // Never leaked
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it('rejects duplicate email with 409 Conflict (EMAIL_ALREADY_EXISTS)', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'duplicate@treeline.org',
        password: 'ValidPassword123!',
        displayName: 'Original User',
      });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'duplicate@treeline.org',
        password: 'AnotherPassword123!',
        displayName: 'Imposter User',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('rejects passwords shorter than 8 characters with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'shortpass@treeline.org',
        password: 'short',
        displayName: 'Short Password User',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details).toBeDefined();
  });

  it('logs in with valid credentials and returns 200 with tokens', async () => {
    // Register
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'login@treeline.org',
        password: 'CorrectPassword123!',
        displayName: 'Login User',
      });

    // Login
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'login@treeline.org',
        password: 'CorrectPassword123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it('rejects login with wrong password returning 401 Unauthorized', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'wrongpass@treeline.org',
        password: 'CorrectPassword123!',
        displayName: 'User',
      });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'wrongpass@treeline.org',
        password: 'WrongPassword999!',
      });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rotates refresh token and returns new token pair', async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'rotate@treeline.org',
        password: 'ValidPassword123!',
        displayName: 'Rotate User',
      });

    const initialRefreshToken = regRes.body.data.refreshToken;

    const refRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: initialRefreshToken });

    expect(refRes.status).toBe(200);
    expect(refRes.body.data.accessToken).toBeDefined();
    expect(refRes.body.data.refreshToken).not.toBe(initialRefreshToken);
  });

  it('triggers TOKEN_REUSE_DETECTED (403) when reused refresh token is presented', async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'theft@treeline.org',
        password: 'ValidPassword123!',
        displayName: 'Theft Test User',
      });

    const initialRefreshToken = regRes.body.data.refreshToken;

    // Normal rotation
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: initialRefreshToken });

    // Attacker presents the same already-rotated token
    const attackRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: initialRefreshToken });

    expect(attackRes.status).toBe(403);
    expect(attackRes.body.code).toBe('TOKEN_REUSE_DETECTED');
  });

  it('retrieves current user profile on GET /api/v1/auth/me when authenticated', async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'me@treeline.org',
        password: 'ValidPassword123!',
        displayName: 'Me User',
      });

    const token = regRes.body.data.accessToken;

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.email).toBe('me@treeline.org');
    expect(meRes.body.data.displayName).toBe('Me User');
  });

  it('rejects GET /api/v1/auth/me with 401 when missing Authorization header', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});
