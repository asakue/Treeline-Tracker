/**
 * @fileoverview Tracks REST API Routes
 * Endpoints: GET /, POST /, GET /:id, PUT /:id (OCC), DELETE /:id, POST /:id/evaluate
 */

import { Router } from 'express';
import { z } from 'zod';
import { IRepositories } from '../../repositories/interfaces.js';
import { TokenService } from '../../auth/jwt.js';
import { createAuthGuard, AuthenticatedRequest } from '../../middleware/auth.guard.js';
import { validateBody } from '../../middleware/validation.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../middleware/error-handler.js';
import { evaluateCrossTrack, calculateBearing, haversineDistance } from '../../utils/geo.js';

const coordinatePointSchema = z.tuple([
  z.number().min(-90).max(90),
  z.number().min(-180).max(180),
]).rest(z.number());

const createTrackSchema = z.object({
  name: z.string().min(1).max(200),
  teamId: z.string().uuid().optional(),
  description: z.string().optional(),
  difficulty: z.string().optional().default('Средне'),
  corridorWidthMeters: z.number().positive().optional().default(50.0),
  trackType: z.enum(['PLANNED', 'RECORDED', 'RESCUE_SEARCH_CORRIDOR', 'PATROL']).optional().default('PLANNED'),
  path: z.array(coordinatePointSchema).min(2, 'Path must contain at least 2 coordinate points'),
  location: z.string().optional().default(''),
});

const updateTrackSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  difficulty: z.string().optional(),
  corridorWidthMeters: z.number().positive().optional(),
  path: z.array(coordinatePointSchema).min(2).optional(),
  location: z.string().optional(),
  isArchived: z.boolean().optional(),
  version: z.number().int().min(1),
});

const evaluateTrackSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().optional(),
  speed: z.number().optional(),
  heading: z.number().min(0).max(360).optional(),
  corridorWidthMeters: z.number().positive().optional(),
});

export function createTracksRouter(repos: IRepositories, tokenService: TokenService): Router {
  const router = Router();
  const authGuard = createAuthGuard(tokenService);

  // 1. List Tracks
  router.get('/', authGuard.requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const { teamId, userId, includeArchived } = req.query;
      const tracks = await repos.tracks.list({
        teamId: teamId as string,
        userId: userId as string,
        includeArchived: includeArchived === 'true',
      });
      return res.status(200).json({
        success: true,
        data: tracks,
      });
    } catch (err) {
      next(err);
    }
  });

  // 2. Create Track
  router.post('/', authGuard.requireAuth, validateBody(createTrackSchema), async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = req.user!;
      const body = req.body;
      const path = body.path as [number, number, number?][];

      // Calculate distanceKm and elevation
      let totalMeters = 0;
      let elevationGainM = 0;
      let elevationLossM = 0;

      for (let i = 0; i < path.length - 1; i++) {
        const d = haversineDistance(
          { latitude: path[i][0], longitude: path[i][1] },
          { latitude: path[i + 1][0], longitude: path[i + 1][1] }
        );
        totalMeters += d;

        const altA = path[i][2];
        const altB = path[i + 1][2];
        if (typeof altA === 'number' && typeof altB === 'number') {
          const deltaAlt = altB - altA;
          if (deltaAlt > 0) elevationGainM += deltaAlt;
          else elevationLossM += Math.abs(deltaAlt);
        }
      }

      const distanceKm = Math.round((totalMeters / 1000) * 10) / 10;
      const estimatedDurationMin = Math.round((distanceKm / 4.0) * 60); // 4 km/h baseline

      const track = await repos.tracks.create({
        ...body,
        userId: user.sub,
        teamId: body.teamId || null,
        distanceKm,
        distance: `${distanceKm} км`,
        time: `${Math.round(estimatedDurationMin / 60)} ч`,
        type: 'Пеший',
        altitude: path[0][2] ? `${Math.round(path[0][2])} м` : '0 м',
        coordinates: `${path[0][0].toFixed(4)}° с.ш., ${path[0][1].toFixed(4)}° в.д.`,
        estimatedDurationMin,
        elevationGainM: Math.round(elevationGainM),
        elevationLossM: Math.round(elevationLossM),
        path,
        isCustom: true,
        isArchived: false,
      });

      return res.status(201).json({
        success: true,
        data: track,
      });
    } catch (err) {
      next(err);
    }
  });

  // 3. Get Track by ID (with Waypoints)
  router.get('/:id', authGuard.requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = req.params.id as string;
      const track = await repos.tracks.findById(id);
      if (!track) {
        throw new NotFoundError('Track not found', 'TRACK_NOT_FOUND');
      }

      const waypoints = await repos.waypoints.list({ trackId: id });

      return res.status(200).json({
        success: true,
        data: {
          ...track,
          waypoints,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // 4. Update Track with OCC check
  router.put('/:id', authGuard.requireAuth, validateBody(updateTrackSchema), async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = req.params.id as string;
      const { version, ...updateFields } = req.body;
      const user = req.user!;

      const track = await repos.tracks.findById(id);
      if (!track) {
        throw new NotFoundError('Track not found', 'TRACK_NOT_FOUND');
      }

      if (user.role !== 'admin' && track.userId !== user.sub) {
        throw new ForbiddenError('You can only modify your own tracks');
      }

      const updated = await repos.tracks.update(id, version, updateFields as any);

      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  });

  // 5. Delete or Archive Track
  router.delete('/:id', authGuard.requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = req.params.id as string;
      const { permanent } = req.query;
      const user = req.user!;

      const track = await repos.tracks.findById(id);
      if (!track) {
        throw new NotFoundError('Track not found', 'TRACK_NOT_FOUND');
      }

      if (user.role !== 'admin' && track.userId !== user.sub) {
        throw new ForbiddenError('You can only delete your own tracks');
      }

      const result = await repos.tracks.delete(id, permanent === 'true');
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  });

  // 6. Evaluate Navigation Cross-Track Distance & Progress
  router.post('/:id/evaluate', authGuard.requireAuth, validateBody(evaluateTrackSchema), async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = req.params.id as string;
      const { latitude, longitude, altitude, speed, heading, corridorWidthMeters } = req.body;

      const track = await repos.tracks.findById(id);
      if (!track) {
        throw new NotFoundError('Track not found', 'TRACK_NOT_FOUND');
      }

      const path = track.path;
      if (!path || path.length < 2) {
        throw new BadRequestError('Track does not have sufficient path points for evaluation');
      }

      const corridor = corridorWidthMeters || track.corridorWidthMeters || 50.0;
      const evaluation = evaluateCrossTrack({ latitude, longitude, altitude }, path);

      const isOffTrack = evaluation.crossTrackDistanceMeters > corridor;

      // Bearing Analysis
      let direction = undefined;
      const alerts: string[] = [];

      if (typeof heading === 'number') {
        const segIdx = evaluation.segmentIndex;
        const p1 = { latitude: path[segIdx][0], longitude: path[segIdx][1] };
        const p2 = { latitude: path[segIdx + 1][0], longitude: path[segIdx + 1][1] };
        const routeBearing = calculateBearing(p1, p2);

        let delta = Math.abs(heading - routeBearing);
        if (delta > 180) delta = 360 - delta;

        const isMovingBackwards = delta > 120;
        let directionStatus: 'ALIGNED' | 'DIVERGENT' | 'REVERSE' = 'ALIGNED';

        if (isMovingBackwards) {
          directionStatus = 'REVERSE';
          alerts.push('Движение в обратном направлении!');
        } else if (delta > 60) {
          directionStatus = 'DIVERGENT';
          alerts.push('Отклонение от азимута маршрута');
        }

        direction = {
          routeBearingDeg: Math.round(routeBearing * 10) / 10,
          hikerBearingDeg: heading,
          bearingDeltaDeg: Math.round(delta * 10) / 10,
          directionStatus,
          isMovingBackwards,
        };
      }

      if (isOffTrack) {
        alerts.push(`Сход с маршрута! Отклонение: ${evaluation.crossTrackDistanceMeters} м (коридор: ${corridor} м)`);
      }

      const progressPercentage = evaluation.totalDistanceMeters > 0
        ? Math.min(100, Math.round((evaluation.progressMeters / evaluation.totalDistanceMeters) * 1000) / 10)
        : 0;

      const currentSpeed = speed && speed > 0.2 ? speed : 1.1; // Default 1.1 m/s (~4 km/h)
      const estimatedRemainingMinutes = Math.round(evaluation.remainingMeters / currentSpeed / 60);

      return res.status(200).json({
        success: true,
        data: {
          crossTrackDistanceMeters: evaluation.crossTrackDistanceMeters,
          nearestPoint: evaluation.nearestPoint,
          segmentIndex: evaluation.segmentIndex,
          isOffTrack,
          corridorWidthMeters: corridor,
          progressMeters: evaluation.progressMeters,
          progressPercentage,
          remainingMeters: evaluation.remainingMeters,
          totalDistanceMeters: evaluation.totalDistanceMeters,
          estimatedRemainingMinutes,
          direction,
          alerts,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
