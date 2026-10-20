import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, validateRequestBody, handleApiError } from '@/core/security/api-security';
import { NavigationEvaluationRequestSchema } from '@/core/domain/schemas';
import { analyzeRouteNavigation } from '@/entities/route';
import { LocationFilter, defaultGlobalDebouncer } from '@/core/location';

export async function POST(req: NextRequest) {
  const rateLimitResponse = enforceRateLimit(req, { limit: 120, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const validation = await validateRequestBody(req, NavigationEvaluationRequestSchema);
    if (!validation.success) {
      return validation.response;
    }

    const {
      hikerLocation,
      routePath,
      anchorLocation,
      safeRadiusMeters = 500,
      corridorWidthMeters = 50,
      isEmergency = false,
    } = validation.data;

    let routeAnalysis = null;
    if (routePath && routePath.length > 0) {
      routeAnalysis = analyzeRouteNavigation(
        hikerLocation,
        routePath,
        { corridorWidthMeters }
      );
    }

    let geofenceAnalysis = null;
    if (anchorLocation) {
      geofenceAnalysis = LocationFilter.evaluateDebouncedGeofence(
        hikerLocation,
        anchorLocation,
        safeRadiusMeters,
        defaultGlobalDebouncer,
        isEmergency
      );
    }

    const aggregatedAlerts: string[] = [];
    if (routeAnalysis?.alerts) {
      aggregatedAlerts.push(...routeAnalysis.alerts);
    }
    if (geofenceAnalysis && geofenceAnalysis.status === 'BREACH' && geofenceAnalysis.isConfirmed) {
      aggregatedAlerts.push(geofenceAnalysis.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        hikerId: hikerLocation.hikerId || hikerLocation.name || 'hiker',
        timestamp: Date.now(),
        routeAnalysis,
        geofenceAnalysis,
        alerts: aggregatedAlerts,
      },
    });
  } catch (error) {
    return handleApiError(error, 400);
  }
}
