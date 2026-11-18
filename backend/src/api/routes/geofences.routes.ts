/**
 * @fileoverview Geofences REST API Routes
 * Endpoints: GET /, POST /, GET /:id, DELETE /:id, POST /:id/check
 */

import { Router } from 'express';
import { z } from 'zod';
import { IRepositories } from '../../repositories/interfaces.js';
import { TokenService } from '../../auth/jwt.js';
import { createAuthGuard, AuthenticatedRequest } from '../../middleware/auth.guard.js';
import { validateBody } from '../../middleware/validation.js';
import { NotFoundError, BadRequestError } from '../../middleware/error-handler.js';
import { haversineDistance, isPointInPolygon } from '../../utils/geo.js';

const createGeofenceSchema = z.object({
  teamId: z.string().uuid(),
  name: z.string().min(1).max(100),
  fenceType: z.enum(['SAFETY_BUFFER', 'EXCLUSION_ZONE', 'HAZARD_ZONE', 'SEARCH_SECTOR', 'CAMP_PERIMETER']).optional().default('SAFETY_BUFFER'),
  shapeType: z.enum(['CIRCLE', 'POLYGON']),
  centerLatitude: z.number().min(-90).max(90).optional(),
  centerLongitude: z.number().min(-180).max(180).optional(),
  radiusMeters: z.number().positive().optional(),
  polygonCoordinates: z.array(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])).optional(),
  breachAction: z.enum(['LOG_ONLY', 'ALERT_USER', 'ALERT_TEAM', 'TRIGGER_SOS']).optional().default('ALERT_TEAM'),
}).refine(data => {
  if (data.shapeType === 'CIRCLE') {
    return typeof data.centerLatitude === 'number' &&
           typeof data.centerLongitude === 'number' &&
           typeof data.radiusMeters === 'number' && data.radiusMeters > 0;
  }
  if (data.shapeType === 'POLYGON') {
    return Array.isArray(data.polygonCoordinates) && data.polygonCoordinates.length >= 3;
  }
  return true;
}, {
  message: 'CIRCLE requires centerLatitude, centerLongitude, and positive radiusMeters. POLYGON requires at least 3 coordinates.',
});

const checkGeofenceSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export function createGeofencesRouter(repos: IRepositories, tokenService: TokenService): Router {
  const router = Router();
  const authGuard = createAuthGuard(tokenService);

  // 1. List Geofences
  router.get('/', authGuard.requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const { teamId, activeOnly } = req.query;
      if (!teamId) {
        throw new BadRequestError('Query parameter teamId is required', 'MISSING_PARAM');
      }

      const fences = await repos.geofences.list({
        teamId: teamId as string,
        activeOnly: activeOnly !== 'false',
      });

      return res.status(200).json({
        success: true,
        data: fences,
      });
    } catch (err) {
      next(err);
    }
  });

  // 2. Create Geofence
  router.post(
    '/',
    authGuard.requireAuth,
    authGuard.requireRole(['guide', 'rescuer', 'admin']),
    validateBody(createGeofenceSchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const user = req.user!;
        const body = req.body;

        const fence = await repos.geofences.create({
          ...body,
          createdByUserId: user.sub,
          centerLatitude: body.centerLatitude || null,
          centerLongitude: body.centerLongitude || null,
          radiusMeters: body.radiusMeters || null,
          polygonCoordinates: body.polygonCoordinates || null,
          isActive: true,
        });

        return res.status(201).json({
          success: true,
          data: fence,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // 3. Get Geofence by ID
  router.get('/:id', authGuard.requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = req.params.id as string;
      const fence = await repos.geofences.findById(id);
      if (!fence) {
        throw new NotFoundError('Geofence not found', 'GEOFENCE_NOT_FOUND');
      }

      return res.status(200).json({
        success: true,
        data: fence,
      });
    } catch (err) {
      next(err);
    }
  });

  // 4. Delete Geofence
  router.delete('/:id', authGuard.requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = req.params.id as string;
      const deleted = await repos.geofences.delete(id);
      if (!deleted) {
        throw new NotFoundError('Geofence not found', 'GEOFENCE_NOT_FOUND');
      }

      return res.status(200).json({
        success: true,
        data: { deleted: true },
      });
    } catch (err) {
      next(err);
    }
  });

  // 5. Check Coordinate Breach
  router.post('/:id/check', authGuard.requireAuth, validateBody(checkGeofenceSchema), async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = req.params.id as string;
      const { latitude, longitude } = req.body;

      const fence = await repos.geofences.findById(id);
      if (!fence) {
        throw new NotFoundError('Geofence not found', 'GEOFENCE_NOT_FOUND');
      }

      const isExclusion = fence.fenceType === 'EXCLUSION_ZONE' || fence.fenceType === 'HAZARD_ZONE';
      let isInside = false;
      let distanceToBoundaryMeters = 0;

      if (fence.shapeType === 'CIRCLE') {
        const center = { latitude: fence.centerLatitude!, longitude: fence.centerLongitude! };
        const distFromCenter = haversineDistance({ latitude, longitude }, center);
        const radius = fence.radiusMeters || 500;
        isInside = distFromCenter <= radius;
        distanceToBoundaryMeters = Math.round(Math.abs(distFromCenter - radius) * 10) / 10;
      } else if (fence.shapeType === 'POLYGON' && fence.polygonCoordinates) {
        isInside = isPointInPolygon([latitude, longitude], fence.polygonCoordinates);
        // Estimate distance to polygon boundary (distance to closest vertex)
        let minVertexDist = Infinity;
        for (const vertex of fence.polygonCoordinates) {
          const d = haversineDistance({ latitude, longitude }, { latitude: vertex[0], longitude: vertex[1] });
          if (d < minVertexDist) minVertexDist = d;
        }
        distanceToBoundaryMeters = Math.round(minVertexDist * 10) / 10;
      }

      let isBreached = false;
      let status: 'INSIDE' | 'WARNING' | 'BREACH' = 'INSIDE';
      let message = 'Координаты в пределах безопасного периметра';

      if (isExclusion) {
        // For exclusion zones, being inside is a breach!
        if (isInside) {
          isBreached = true;
          status = 'BREACH';
          message = `Внимание! Нарушение периметра опасной зоны "${fence.name}"!`;
        } else if (distanceToBoundaryMeters < 50) {
          status = 'WARNING';
          message = `Предупреждение: приближение к опасной зоне "${fence.name}" (${distanceToBoundaryMeters} м)`;
        } else {
          status = 'INSIDE'; // Outside the dangerous area
          message = 'Вне опасной зоны';
        }
      } else {
        // For safety buffer / camp perimeter, being outside is a breach
        if (!isInside) {
          isBreached = true;
          status = 'BREACH';
          message = `Внимание! Выход за пределы безопасного периметра "${fence.name}" на ${distanceToBoundaryMeters} м!`;
        } else if (distanceToBoundaryMeters < 30) {
          status = 'WARNING';
          message = `Предупреждение: приближение к границе безопасной зоны "${fence.name}" (${distanceToBoundaryMeters} м)`;
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          geofenceId: fence.id,
          name: fence.name,
          fenceType: fence.fenceType,
          status,
          isBreached,
          distanceToBoundaryMeters,
          message,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
