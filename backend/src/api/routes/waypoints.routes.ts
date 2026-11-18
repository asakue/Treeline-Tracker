/**
 * @fileoverview Waypoints REST API Routes
 * Endpoints: GET /, POST /, GET /:id, DELETE /:id
 */

import { Router } from 'express';
import { z } from 'zod';
import { IRepositories } from '../../repositories/interfaces.js';
import { TokenService } from '../../auth/jwt.js';
import { createAuthGuard, AuthenticatedRequest } from '../../middleware/auth.guard.js';
import { validateBody } from '../../middleware/validation.js';
import { NotFoundError } from '../../middleware/error-handler.js';

const createWaypointSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  symbol: z.string().optional().default('WAYPOINT'),
  milStd2525Code: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().optional(),
  trackId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  sequenceOrder: z.number().int().optional().default(0),
  isHazard: z.boolean().optional().default(false),
  hazardRadiusMeters: z.number().min(0).optional().default(0.0),
});

export function createWaypointsRouter(repos: IRepositories, tokenService: TokenService): Router {
  const router = Router();
  const authGuard = createAuthGuard(tokenService);

  // 1. List Waypoints
  router.get('/', authGuard.requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const { trackId, teamId } = req.query;
      const waypoints = await repos.waypoints.list({
        trackId: trackId as string,
        teamId: teamId as string,
      });

      return res.status(200).json({
        success: true,
        data: waypoints,
      });
    } catch (err) {
      next(err);
    }
  });

  // 2. Create Waypoint
  router.post('/', authGuard.requireAuth, validateBody(createWaypointSchema), async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = req.user!;
      const body = req.body;

      const waypoint = await repos.waypoints.create({
        ...body,
        createdByUserId: user.sub,
        trackId: body.trackId || null,
        teamId: body.teamId || null,
      });

      return res.status(201).json({
        success: true,
        data: waypoint,
      });
    } catch (err) {
      next(err);
    }
  });

  // 3. Get Waypoint by ID
  router.get('/:id', authGuard.requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = req.params.id as string;
      const waypoint = await repos.waypoints.findById(id);
      if (!waypoint) {
        throw new NotFoundError('Waypoint not found', 'WAYPOINT_NOT_FOUND');
      }

      return res.status(200).json({
        success: true,
        data: waypoint,
      });
    } catch (err) {
      next(err);
    }
  });

  // 4. Delete Waypoint
  router.delete('/:id', authGuard.requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = req.params.id as string;
      const deleted = await repos.waypoints.delete(id);
      if (!deleted) {
        throw new NotFoundError('Waypoint not found', 'WAYPOINT_NOT_FOUND');
      }

      return res.status(200).json({
        success: true,
        data: { deleted: true },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
