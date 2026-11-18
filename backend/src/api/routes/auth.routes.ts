/**
 * @fileoverview Auth REST API Routes
 * Endpoints: /register, /login, /refresh, /logout, /me
 */

import { Router } from 'express';
import { z } from 'zod';
import { IRepositories } from '../../repositories/interfaces.js';
import { TokenService } from '../../auth/jwt.js';
import { passwordService } from '../../auth/password.js';
import { createAuthGuard, AuthenticatedRequest } from '../../middleware/auth.guard.js';
import { validateBody } from '../../middleware/validation.js';
import { ConflictError, UnauthorizedError, ForbiddenError, NotFoundError } from '../../middleware/error-handler.js';

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(100),
  role: z.enum(['hiker', 'guide', 'rescuer', 'admin']).optional().default('hiker'),
  phone: z.string().optional(),
  emergencyContact: z.string().optional(),
  publicKey: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceInfo: z.string().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(20),
});

export function createAuthRouter(repos: IRepositories, tokenService: TokenService): Router {
  const router = Router();
  const authGuard = createAuthGuard(tokenService);

  // 1. Register
  router.post('/register', validateBody(registerSchema), async (req, res, next) => {
    try {
      const { email, password, displayName, role, phone, emergencyContact, publicKey } = req.body;

      const existing = await repos.users.findByEmail(email);
      if (existing) {
        throw new ConflictError('User with this email already exists', 'EMAIL_ALREADY_EXISTS');
      }

      const passwordHash = await passwordService.hash(password);
      const user = await repos.users.create({
        email: email.toLowerCase(),
        passwordHash,
        displayName,
        role,
        phone: phone || null,
        emergencyContact: emergencyContact || null,
        publicKey: publicKey || null,
        keyFingerprint: null,
        privacyMode: 'NORMAL',
        isActive: true,
      });

      const clientIp = req.socket?.remoteAddress;
      const tokens = await tokenService.issueInitialTokenPair(user, { ipAddress: clientIp });

      // Omit password hash in output
      const { passwordHash: _, ...safeUser } = user;

      return res.status(201).json({
        success: true,
        data: {
          user: safeUser,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // 2. Login
  router.post('/login', validateBody(loginSchema), async (req, res, next) => {
    try {
      const { email, password, deviceInfo } = req.body;
      const user = await repos.users.findByEmail(email);

      if (!user) {
        throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
      }

      const isValid = await passwordService.verify(password, user.passwordHash);
      if (!isValid) {
        throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
      }

      if (!user.isActive) {
        throw new ForbiddenError('Account is disabled', 'ACCOUNT_DISABLED');
      }

      const teams = await repos.teams.getUserTeamIds(user.id);
      const clientIp = req.socket?.remoteAddress;
      const tokens = await tokenService.issueInitialTokenPair(
        { ...user, teams },
        { deviceInfo, ipAddress: clientIp }
      );

      const { passwordHash: _, ...safeUser } = user;

      return res.status(200).json({
        success: true,
        data: {
          user: safeUser,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // 3. Refresh Token Rotation
  router.post('/refresh', validateBody(refreshSchema), async (req, res, next) => {
    try {
      const { refreshToken } = req.body;
      const clientIp = req.socket?.remoteAddress;

      const tokens = await tokenService.rotateRefreshToken(
        refreshToken,
        async (userId) => {
          const user = await repos.users.findById(userId);
          if (!user) return null;
          const teams = await repos.teams.getUserTeamIds(user.id);
          return { ...user, teams };
        },
        { ipAddress: clientIp }
      );

      return res.status(200).json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // 4. Logout
  router.post('/logout', validateBody(logoutSchema), async (req, res, next) => {
    try {
      const { refreshToken } = req.body;
      await tokenService.logout(refreshToken);
      return res.status(200).json({
        success: true,
        data: { revoked: true, message: 'Session terminated successfully' },
      });
    } catch (err) {
      next(err);
    }
  });

  // 5. Current User Profile
  router.get('/me', authGuard.requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.user!.sub;
      const user = await repos.users.findById(userId);
      if (!user) {
        throw new NotFoundError('User profile not found', 'USER_NOT_FOUND');
      }

      const teamIds = await repos.teams.getUserTeamIds(userId);
      const { passwordHash: _, ...safeUser } = user;

      return res.status(200).json({
        success: true,
        data: {
          ...safeUser,
          teams: teamIds,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
