import { NextRequest, NextResponse } from 'next/server';
import { ServerDbService } from '@/lib/server-db';
import { enforceRateLimit, validateRequestBody, handleApiError } from '@/core/security/api-security';
import { RouteDifficultySchema } from '@/core/domain/schemas';
import { z } from 'zod';

const CreateRouteInputSchema = z.object({
  name: z.string().min(1, 'Название маршрута обязательно'),
  location: z.string().min(1, 'Локация маршрута обязательна'),
  difficulty: RouteDifficultySchema.optional().default('Средне'),
  distance: z.string().optional().default('0 км'),
  time: z.string().optional().default('1 ч'),
  type: z.string().optional().default('Пеший'),
  altitude: z.string().optional().default('0 м'),
  coordinates: z.string().optional().default('43.3550° с.ш., 42.4392° в.д.'),
  path: z.array(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])).optional().default([]),
  isCustom: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

const UpdateRouteInputSchema = z.object({
  id: z.string().min(1, 'ID маршрута обязателен'),
}).and(CreateRouteInputSchema.partial().extend({
  version: z.number().optional(),
}));

export async function GET(req: NextRequest) {
  const rateLimitResponse = enforceRateLimit(req, { limit: 120, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const routes = ServerDbService.getRoutes(includeArchived);
    return NextResponse.json({ success: true, data: routes });
  } catch (error) {
    return handleApiError(error, 500);
  }
}

export async function POST(req: NextRequest) {
  const rateLimitResponse = enforceRateLimit(req, { limit: 60, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const validation = await validateRequestBody(req, CreateRouteInputSchema);
    if (!validation.success) {
      return validation.response;
    }

    const created = ServerDbService.createRoute(validation.data as any);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 400);
  }
}

export async function PUT(req: NextRequest) {
  const rateLimitResponse = enforceRateLimit(req, { limit: 90, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const validation = await validateRequestBody(req, UpdateRouteInputSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { id, ...data } = validation.data;
    const updated = ServerDbService.updateRoute(id, data as any);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error, 400);
  }
}

export async function DELETE(req: NextRequest) {
  const rateLimitResponse = enforceRateLimit(req, { limit: 60, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id || id.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Route ID is required' },
        { status: 400 }
      );
    }
    const success = ServerDbService.deleteRoute(id.trim());
    return NextResponse.json({ success });
  } catch (error) {
    return handleApiError(error, 500);
  }
}
