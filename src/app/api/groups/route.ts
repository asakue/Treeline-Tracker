import { NextRequest, NextResponse } from 'next/server';
import { ServerDbService } from '@/lib/server-db';
import { enforceRateLimit, validateRequestBody, handleApiError } from '@/core/security/api-security';
import { RouteDifficultySchema, MemberSchema } from '@/core/domain/schemas';
import { z } from 'zod';

const CreateGroupInputSchema = z.object({
  name: z.string().min(1, 'Название группы обязательно'),
  location: z.string().min(1, 'Локация обязательна'),
  description: z.string().optional(),
  distance: z.string().optional().default('0 км'),
  difficulty: RouteDifficultySchema.optional().default('Средне'),
  hikers: z.array(MemberSchema).optional().default([]),
  routeId: z.string().optional(),
  sharedKeyId: z.string().optional(),
  adminId: z.string().optional(),
  startDate: z.string().optional(),
  leaderName: z.string().optional(),
  safeRadiusMeters: z.number().positive().optional().default(500),
});

const UpdateGroupInputSchema = z.object({
  id: z.string().min(1, 'ID группы обязателен для обновления'),
}).and(CreateGroupInputSchema.partial().extend({
  version: z.number().optional(),
}));

export async function GET(req: NextRequest) {
  const rateLimitResponse = enforceRateLimit(req, { limit: 120, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const groups = ServerDbService.getGroups();
    return NextResponse.json({ success: true, data: groups });
  } catch (error) {
    return handleApiError(error, 500);
  }
}

export async function POST(req: NextRequest) {
  const rateLimitResponse = enforceRateLimit(req, { limit: 60, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const validation = await validateRequestBody(req, CreateGroupInputSchema);
    if (!validation.success) {
      return validation.response;
    }

    const created = ServerDbService.createGroup(validation.data as any);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 400);
  }
}

export async function PUT(req: NextRequest) {
  const rateLimitResponse = enforceRateLimit(req, { limit: 90, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const validation = await validateRequestBody(req, UpdateGroupInputSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { id, ...data } = validation.data;
    const updated = ServerDbService.updateGroup(id, data as any);
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
        { success: false, error: 'Group ID is required' },
        { status: 400 }
      );
    }
    const success = ServerDbService.deleteGroup(id.trim());
    return NextResponse.json({ success });
  } catch (error) {
    return handleApiError(error, 500);
  }
}
