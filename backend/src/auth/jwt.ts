/**
 * @fileoverview JWT Authentication & Token Rotation Engine
 * Implements 15-minute access tokens, 30-day SHA-256 hashed refresh tokens,
 * token family lineage tracking, and instant family revocation upon token reuse.
 */

import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { UserRole } from './rbac.js';

export interface JwtAccessTokenPayload {
  sub: string;           // User UUID
  email: string;
  role: UserRole;        // 'hiker' | 'guide' | 'rescuer' | 'admin'
  displayName: string;
  teams: string[];       // Team IDs
  jti: string;           // Unique JWT ID
  iat?: number;
  exp?: number;
  iss?: string;
}

export interface GeneratedTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;     // 900 seconds (15 min)
}

export interface TokenRecord {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  deviceInfo?: string | null;
  ipAddress?: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface ITokenRepository {
  createToken(data: {
    userId: string;
    familyId: string;
    tokenHash: string;
    deviceInfo?: string | null;
    ipAddress?: string | null;
    expiresAt: Date;
  }): Promise<TokenRecord>;

  findByTokenHash(tokenHash: string): Promise<TokenRecord | null>;
  revokeToken(id: string): Promise<void>;
  revokeFamily(familyId: string): Promise<void>;
  revokeAllUserTokens(userId: string): Promise<void>;
}

export class TokenService {
  private readonly jwtSecret: string;
  private readonly issuer = 'treeline-tracker';
  private readonly accessExpirySeconds = 15 * 60; // 15 minutes
  private readonly refreshExpiryDays = 30;

  constructor(private tokenRepo: ITokenRepository, jwtSecret?: string) {
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || 'dev_secret_treeline_mesh_key_32bytes!';
  }

  /**
   * Generates a short-lived (15m) JWT access token.
   */
  generateAccessToken(user: {
    id: string;
    email: string;
    role: UserRole;
    displayName: string;
    teams?: string[];
  }): string {
    const payload: JwtAccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      teams: user.teams || [],
      jti: crypto.randomUUID(),
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.accessExpirySeconds,
      issuer: this.issuer,
      algorithm: 'HS256',
    });
  }

  /**
   * Verifies and decodes a JWT access token.
   */
  verifyAccessToken(token: string): JwtAccessTokenPayload {
    return jwt.verify(token, this.jwtSecret, {
      issuer: this.issuer,
      algorithms: ['HS256'],
    }) as JwtAccessTokenPayload;
  }

  /**
   * Hashes a raw refresh token using SHA-256 for secure DB storage.
   */
  hashRefreshToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Issues an initial token pair upon login/registration.
   * Creates a new token family.
   */
  async issueInitialTokenPair(
    user: { id: string; email: string; role: UserRole; displayName: string; teams?: string[] },
    clientInfo?: { deviceInfo?: string | null; ipAddress?: string | null }
  ): Promise<GeneratedTokenPair> {
    const familyId = crypto.randomUUID();
    const rawRefreshToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = this.hashRefreshToken(rawRefreshToken);

    const expiresAt = new Date(Date.now() + this.refreshExpiryDays * 24 * 60 * 60 * 1000);

    await this.tokenRepo.createToken({
      userId: user.id,
      familyId,
      tokenHash,
      deviceInfo: clientInfo?.deviceInfo || null,
      ipAddress: clientInfo?.ipAddress || null,
      expiresAt,
    });

    const accessToken = this.generateAccessToken(user);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.accessExpirySeconds,
    };
  }

  /**
   * Refresh Token Rotation with Instant Reuse Detection & Invalidation.
   */
  async rotateRefreshToken(
    rawRefreshToken: string,
    getUserFn: (userId: string) => Promise<{ id: string; email: string; role: UserRole; displayName: string; isActive: boolean; teams?: string[] } | null>,
    clientInfo?: { deviceInfo?: string | null; ipAddress?: string | null }
  ): Promise<GeneratedTokenPair> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const tokenRecord = await this.tokenRepo.findByTokenHash(tokenHash);

    if (!tokenRecord) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    // =========================================================================
    // REUSE DETECTION: If this token was ALREADY revoked, theft is detected!
    // Revoke the ENTIRE token family immediately.
    // =========================================================================
    if (tokenRecord.revokedAt !== null) {
      await this.tokenRepo.revokeFamily(tokenRecord.familyId);
      throw new Error('TOKEN_REUSE_DETECTED');
    }

    // Check expiration
    if (tokenRecord.expiresAt.getTime() < Date.now()) {
      await this.tokenRepo.revokeToken(tokenRecord.id);
      throw new Error('REFRESH_TOKEN_EXPIRED');
    }

    // Verify user is still active
    const user = await getUserFn(tokenRecord.userId);
    if (!user || !user.isActive) {
      await this.tokenRepo.revokeFamily(tokenRecord.familyId);
      throw new Error('USER_INACTIVE_OR_NOT_FOUND');
    }

    // 1. Revoke the presented token
    await this.tokenRepo.revokeToken(tokenRecord.id);

    // 2. Generate new refresh token in the SAME family
    const newRawRefreshToken = crypto.randomBytes(32).toString('base64url');
    const newTokenHash = this.hashRefreshToken(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + this.refreshExpiryDays * 24 * 60 * 60 * 1000);

    await this.tokenRepo.createToken({
      userId: user.id,
      familyId: tokenRecord.familyId, // Retain lineage
      tokenHash: newTokenHash,
      deviceInfo: clientInfo?.deviceInfo || null,
      ipAddress: clientInfo?.ipAddress || null,
      expiresAt,
    });

    // 3. Mint new access token
    const accessToken = this.generateAccessToken(user);

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      expiresIn: this.accessExpirySeconds,
    };
  }

  /**
   * Revokes refresh token on user logout.
   */
  async logout(rawRefreshToken: string, allDevices = false): Promise<void> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const record = await this.tokenRepo.findByTokenHash(tokenHash);
    if (!record) return;

    if (allDevices) {
      await this.tokenRepo.revokeAllUserTokens(record.userId);
    } else {
      await this.tokenRepo.revokeToken(record.id);
    }
  }
}
