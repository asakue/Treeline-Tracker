/**
 * @fileoverview Telemetry REST API Routes
 * Endpoints: POST /batch, GET /history
 */

import { Router } from 'express';
import { z } from 'zod';
import { IRepositories, TelemetryPointEntity } from '../../repositories/interfaces.js';
import { TokenService } from '../../auth/jwt.js';
import { createAuthGuard, AuthenticatedRequest } from '../../middleware/auth.guard.js';
import { validateBody } from '../../middleware/validation.js';
import { BadRequestError } from '../../middleware/error-handler.js';

const telemetryPointInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().optional(),
  accuracyM: z.number().optional(),
  speedMps: z.number().optional(),
  headingDeg: z.number().optional(),
  batteryLevel: z.number().int().min(0).max(100).optional(),
  transportType: z.enum(['INTERNET', 'MESH_LORA', 'OFFLINE_BUFFER', 'BLE_GATEWAY']).optional().default('INTERNET'),
  privacyMode: z.enum(['NORMAL', 'REDUCED', 'STEALTH', 'EMERGENCY']).optional().default('NORMAL'),
  isEmergency: z.boolean().optional().default(false),
  recordedAt: z.string().datetime().or(z.number()),
  meshNodeId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  rawMetadata: z.record(z.any()).optional(),
});

const batchSchema = z.object({
  points: z.array(telemetryPointInputSchema),
});

export function createTelemetryRouter(repos: IRepositories, tokenService: TokenService): Router {
  const router = Router();
  const authGuard = createAuthGuard(tokenService);

  // 1. Batch Telemetry Ingestion (Tier 3: 300 req/min)
  router.post('/batch', authGuard.optionalAuth, validateBody(batchSchema), async (req: AuthenticatedRequest, res, next) => {
    try {
      const { points } = req.body;
      const user = req.user;

      if (!points || points.length === 0) {
        throw new BadRequestError('Telemetry batch cannot be empty', 'BATCH_SIZE_OUT_OF_BOUNDS');
      }

      if (points.length > 500) {
        throw new BadRequestError('Telemetry batch exceeds maximum limit of 500 points', 'BATCH_SIZE_OUT_OF_BOUNDS');
      }

      const processedPoints: Omit<TelemetryPointEntity, 'id' | 'createdAt'>[] = points.map((p: any) => {
        let lat = p.latitude;
        let lon = p.longitude;
        let alt = p.altitude || null;
        let acc = p.accuracyM || null;

        // Privacy transformations
        if (p.privacyMode === 'STEALTH') {
          lat = 0;
          lon = 0;
          alt = null;
        } else if (p.privacyMode === 'REDUCED') {
          lat = Math.round(lat * 100) / 100;
          lon = Math.round(lon * 100) / 100;
          acc = 1000.0;
        }

        const recDate = typeof p.recordedAt === 'number' ? new Date(p.recordedAt) : new Date(p.recordedAt);

        return {
          userId: user?.sub || null,
          meshNodeId: p.meshNodeId || null,
          teamId: p.teamId || null,
          hikerId: user?.sub || null,
          latitude: lat,
          longitude: lon,
          altitude: alt,
          accuracyM: acc,
          speedMps: p.speedMps || null,
          headingDeg: p.headingDeg || null,
          batteryLevel: p.batteryLevel || null,
          transportType: p.transportType || 'INTERNET',
          privacyMode: p.privacyMode || 'NORMAL',
          isEmergency: !!p.isEmergency,
          rawMetadata: p.rawMetadata || {},
          recordedAt: recDate,
        };
      });

      const { inserted, skipped } = await repos.telemetry.insertBatch(processedPoints);
      const latest = processedPoints[processedPoints.length - 1];

      return res.status(200).json({
        success: true,
        data: {
          inserted,
          skipped,
          latestPoint: {
            latitude: latest.latitude,
            longitude: latest.longitude,
            recordedAt: latest.recordedAt,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // 2. Query Historical Telemetry for Track Playback
  router.get('/history', authGuard.requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId, teamId, startTime, endTime, limit } = req.query;

      if (!startTime || !endTime) {
        throw new BadRequestError('Both startTime and endTime are required query parameters', 'MISSING_PARAM');
      }

      const sDate = new Date(startTime as string);
      const eDate = new Date(endTime as string);

      if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) {
        throw new BadRequestError('Invalid date format for startTime or endTime', 'INVALID_PARAM');
      }

      const historyLimit = limit ? Math.min(2000, parseInt(limit as string, 10)) : 500;

      const points = await repos.telemetry.queryHistory({
        userId: userId as string,
        teamId: teamId as string,
        startTime: sDate,
        endTime: eDate,
        limit: historyLimit,
      });

      return res.status(200).json({
        success: true,
        data: points,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
