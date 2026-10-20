import { NextRequest, NextResponse } from 'next/server';
import { ServerDbService } from '@/lib/server-db';
import { enforceRateLimit, validateRequestBody, handleApiError } from '@/core/security/api-security';
import { LocationUpdateSchema } from '@/core/domain/schemas';
import { z } from 'zod';

const ApiLocationInputSchema = LocationUpdateSchema.partial({
  timestamp: true,
  privacyMode: true,
}).extend({
  battery: z.number().min(0).max(100).optional(),
});

export async function GET(req: NextRequest) {
  const rateLimitResponse = enforceRateLimit(req, { limit: 120, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const locations = ServerDbService.getLocations();
    return NextResponse.json({ success: true, data: locations });
  } catch (error) {
    return handleApiError(error, 500);
  }
}

export async function POST(req: NextRequest) {
  const rateLimitResponse = enforceRateLimit(req, { limit: 180, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const validation = await validateRequestBody(req, ApiLocationInputSchema);
    if (!validation.success) {
      return validation.response;
    }

    const payload = {
      ...validation.data,
      timestamp: validation.data.timestamp ?? Date.now(),
      privacyMode: validation.data.privacyMode ?? 'NORMAL',
    };

    ServerDbService.updateLocation(payload as any);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 400);
  }
}
