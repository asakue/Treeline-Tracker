import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  enforceRateLimit,
  validateRequestBody,
  handleApiError,
} from '@/core/security/api-security';
import {
  detectRouteRegion,
  autoDetectRouteType,
  autoDetectDifficulty,
  autoDetectRoutingProfile,
} from '@/features/routing/lib/auto-classification-service';

const CoordinateTupleSchema = z.tuple([
  z.number().min(-90, 'Широта должна быть >= -90').max(90, 'Широта должна быть <= 90'),
  z.number().min(-180, 'Долгота должна быть >= -180').max(180, 'Долгота должна быть <= 180'),
]);

const ClassifyRouteInputSchema = z.object({
  path: z.array(CoordinateTupleSchema).min(1, 'Необходимо передать как минимум 1 точку').max(5000, 'Слишком много точек (максимум 5000)'),
  maxSlopeDeg: z.number().optional(),
  ascentM: z.number().optional(),
  maxElevationM: z.number().optional(),
  distanceKm: z.number().optional(),
  sacDifficulty: z.enum(['T1', 'T2', 'T3', 'T4']).optional(),
});

export async function POST(req: NextRequest) {
  // 1. Rate limiting: 100 requests per minute
  const rateLimitResponse = enforceRateLimit(req, { limit: 100, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // 2. Strict input validation
    const validation = await validateRequestBody(req, ClassifyRouteInputSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { path, maxSlopeDeg, ascentM, maxElevationM, distanceKm, sacDifficulty } = validation.data;

    // 3. Autonomous region detection
    const location = detectRouteRegion(path);

    // 4. Autonomous route type and difficulty detection
    const metrics = { maxSlopeDeg, ascentM, maxElevationM, distanceKm, sacDifficulty };
    const routeType = autoDetectRouteType(metrics);
    const difficulty = autoDetectDifficulty(metrics);
    const routingProfile = autoDetectRoutingProfile(path, metrics);

    return NextResponse.json({
      success: true,
      data: {
        location,
        type: routeType,
        difficulty,
        routingProfile,
      },
    });
  } catch (error) {
    return handleApiError(error, 400);
  }
}
