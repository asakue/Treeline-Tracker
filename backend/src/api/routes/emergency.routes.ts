/**
 * @fileoverview Emergency SOS REST API Routes
 * Endpoints: POST /sos, GET /active, GET /sos, POST /:id/acknowledge, POST /:id/resolve
 */

import { Router } from 'express';
import { z } from 'zod';
import { IRepositories } from '../../repositories/interfaces.js';
import { TokenService } from '../../auth/jwt.js';
import { canResolveEmergency } from '../../auth/rbac.js';
import { createAuthGuard, AuthenticatedRequest } from '../../middleware/auth.guard.js';
import { validateBody } from '../../middleware/validation.js';
import { NotFoundError, ForbiddenError } from '../../middleware/error-handler.js';

const triggerSosSchema = z.object({
  type: z.string().optional().default('SOS_SIGNAL'),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    altitude: z.number().optional(),
    accuracy: z.number().optional(),
  }),
  details: z.string().optional().default('Сигнал бедствия SOS'),
  message: z.string().optional(),
  batteryLevel: z.number().int().min(0).max(100).optional(),
  teamId: z.string().uuid().optional(),
  isEmergency: z.boolean().optional().default(true),
});

const resolveSosSchema = z.object({
  notes: z.string().optional(),
});

export function createEmergencyRouter(repos: IRepositories, tokenService: TokenService): Router {
  const router = Router();
  const authGuard = createAuthGuard(tokenService);

  // 1. Trigger SOS Beacon (Rate-Limit Bypassed)
  router.post('/sos', authGuard.optionalAuth, validateBody(triggerSosSchema), async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = req.user;
      const body = req.body;

      const senderId = user?.sub || 'anonymous-hiker';
      const senderName = user?.displayName || 'Анонимный турист';
      const message = body.message || body.details || 'Сигнал бедствия SOS';

      const emergency = await repos.emergencies.create({
        senderId,
        senderName,
        teamId: body.teamId || null,
        type: body.type || 'SOS_SIGNAL',
        message,
        status: 'ACTIVE',
        latitude: body.location.latitude,
        longitude: body.location.longitude,
        altitude: body.location.altitude || null,
        accuracy: body.location.accuracy || null,
        batteryLevel: body.batteryLevel || null,
        resolvedBy: null,
        resolvedAt: null,
        notes: null,
      });

      return res.status(201).json({
        success: true,
        data: {
          emergencyId: emergency.id,
          status: emergency.status,
          type: emergency.type,
          senderId: emergency.senderId,
          senderName: emergency.senderName,
          location: {
            latitude: emergency.latitude,
            longitude: emergency.longitude,
            altitude: emergency.altitude,
          },
          timestamp: emergency.createdAt.getTime(),
          broadcasted: true,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // Handler for active emergencies list
  const listActiveHandler = async (req: AuthenticatedRequest, res: any, next: any) => {
    try {
      const user = req.user!;
      const { teamId } = req.query;

      let emergencies;
      if (user.role === 'rescuer' || user.role === 'admin') {
        emergencies = await repos.emergencies.listActive({ teamId: teamId as string });
      } else {
        // Hikers & Guides see team or self-reported
        const allActive = await repos.emergencies.listActive({ teamId: teamId as string });
        emergencies = allActive.filter(
          e => e.senderId === user.sub || (e.teamId && user.teams.includes(e.teamId))
        );
      }

      return res.status(200).json({
        success: true,
        data: emergencies,
      });
    } catch (err) {
      next(err);
    }
  };

  // 2. List Active Emergencies
  router.get('/active', authGuard.requireAuth, listActiveHandler);
  router.get('/sos', authGuard.requireAuth, listActiveHandler);
  router.get('/', authGuard.requireAuth, listActiveHandler);

  // 3. Acknowledge SOS
  router.post('/:id/acknowledge', authGuard.requireAuth, authGuard.requireRole(['guide', 'rescuer', 'admin']), async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = req.params.id as string;
      const user = req.user!;

      const updated = await repos.emergencies.acknowledge(id, user.sub);

      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  });

  // 4. Resolve SOS
  router.post('/:id/resolve', authGuard.requireAuth, validateBody(resolveSosSchema), async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = req.params.id as string;
      const { notes } = req.body;
      const user = req.user!;

      const existing = await repos.emergencies.findById(id);
      if (!existing) {
        throw new NotFoundError('Emergency incident not found', 'EMERGENCY_NOT_FOUND');
      }

      // Check permission: rescuer, admin, or original sender can resolve
      const isReporter = existing.senderId === user.sub;
      if (!canResolveEmergency(user.role, isReporter)) {
        throw new ForbiddenError('Only the reporter, search and rescue personnel, or administrators can resolve an SOS');
      }

      const resolved = await repos.emergencies.resolve(id, user.displayName, notes);

      return res.status(200).json({
        success: true,
        data: {
          emergencyId: resolved.id,
          status: resolved.status,
          resolvedBy: resolved.resolvedBy,
          resolvedAt: resolved.resolvedAt,
          notes: resolved.notes,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
