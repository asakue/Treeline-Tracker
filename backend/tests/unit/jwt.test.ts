/**
 * @fileoverview Unit Tests for JWT Token Service & Token Rotation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TokenService } from '../../src/auth/jwt.js';
import { InMemoryTokenRepository } from '../../src/repositories/in-memory.repositories.js';

describe('JWT Token Service & Rotation Unit Tests', () => {
  let tokenRepo: InMemoryTokenRepository;
  let tokenService: TokenService;

  beforeEach(() => {
    tokenRepo = new InMemoryTokenRepository();
    tokenService = new TokenService(tokenRepo, 'test-jwt-secret-key-32-characters-min!!');
  });

  describe('Access Tokens', () => {
    it('mints a short-lived (15m) access token with valid user claims', () => {
      const user = {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'rescuer@treeline.org',
        role: 'rescuer' as const,
        displayName: 'SAR Lead Alpha',
        teams: ['team-alpha-uuid'],
      };

      const token = tokenService.generateAccessToken(user);
      expect(typeof token).toBe('string');

      const decoded = tokenService.verifyAccessToken(token);
      expect(decoded.sub).toBe(user.id);
      expect(decoded.email).toBe(user.email);
      expect(decoded.role).toBe('rescuer');
      expect(decoded.displayName).toBe('SAR Lead Alpha');
      expect(decoded.teams).toContain('team-alpha-uuid');
      expect(decoded.exp! - decoded.iat!).toBe(900); // 15 minutes
    });

    it('rejects tampered or malformed tokens', () => {
      expect(() => tokenService.verifyAccessToken('invalid.token.payload')).toThrow();
    });
  });

  describe('Refresh Tokens & Family Lineage', () => {
    const mockUser = {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'hiker@treeline.org',
      role: 'hiker' as const,
      displayName: 'Trail Hiker',
      isActive: true,
      teams: [],
    };

    it('issues initial token pair and stores hashed refresh token in repository', async () => {
      const pair = await tokenService.issueInitialTokenPair(mockUser);

      expect(pair.accessToken).toBeDefined();
      expect(pair.refreshToken).toBeDefined();
      expect(pair.expiresIn).toBe(900);

      expect(tokenRepo.tokens.size).toBe(1);
      const [stored] = Array.from(tokenRepo.tokens.values());
      expect(stored.userId).toBe(mockUser.id);
      expect(stored.familyId).toBeDefined();
      expect(stored.tokenHash).toBe(tokenService.hashRefreshToken(pair.refreshToken));
      expect(stored.revokedAt).toBeNull();
    });

    it('rotates refresh token, preserving family lineage and revoking old token', async () => {
      const pair1 = await tokenService.issueInitialTokenPair(mockUser);
      const [token1] = Array.from(tokenRepo.tokens.values());
      const originalFamilyId = token1.familyId;

      const pair2 = await tokenService.rotateRefreshToken(
        pair1.refreshToken,
        async () => mockUser
      );

      expect(pair2.refreshToken).not.toBe(pair1.refreshToken);
      expect(tokenRepo.tokens.size).toBe(2);

      const allTokens = Array.from(tokenRepo.tokens.values());
      const oldToken = allTokens.find(t => t.id === token1.id)!;
      const newToken = allTokens.find(t => t.id !== token1.id)!;

      // Old token is revoked
      expect(oldToken.revokedAt).not.toBeNull();

      // New token is active and preserves familyId
      expect(newToken.revokedAt).toBeNull();
      expect(newToken.familyId).toBe(originalFamilyId);
    });

    it('CRITICAL THEFT DEFENSE: detects token reuse and revokes ENTIRE family', async () => {
      // 1. Legitimate user logs in
      const pair1 = await tokenService.issueInitialTokenPair(mockUser);
      const stolenToken = pair1.refreshToken;

      // 2. Legitimate user rotates token
      const pair2 = await tokenService.rotateRefreshToken(stolenToken, async () => mockUser);
      expect(pair2.refreshToken).toBeDefined();

      // 3. Attacker presents stolen token (which was already rotated!)
      await expect(
        tokenService.rotateRefreshToken(stolenToken, async () => mockUser)
      ).rejects.toThrow('TOKEN_REUSE_DETECTED');

      // 4. Verify all tokens in the entire family are now revoked
      const tokensInFamily = Array.from(tokenRepo.tokens.values());
      const activeTokens = tokensInFamily.filter(t => t.revokedAt === null);
      expect(activeTokens.length).toBe(0);
    });

    it('revokes tokens on logout', async () => {
      const pair = await tokenService.issueInitialTokenPair(mockUser);
      await tokenService.logout(pair.refreshToken);

      const [stored] = Array.from(tokenRepo.tokens.values());
      expect(stored.revokedAt).not.toBeNull();
    });
  });
});
