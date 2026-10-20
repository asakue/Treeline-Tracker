import { NextRequest, NextResponse } from 'next/server';
import { ServerDbService } from '@/lib/server-db';
import { enforceRateLimit, validateRequestBody, handleApiError } from '@/core/security/api-security';
import { PrivacyModeSchema } from '@/core/domain/schemas';
import { z } from 'zod';

const ProfileUpdateSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  displayName: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(30).optional(),
  emergencyContact: z.string().max(100).optional(),
  experienceLevel: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert']).optional(),
  privacyMode: PrivacyModeSchema.optional(),
  role: z.enum(['hiker', 'guide', 'rescuer', 'admin']).optional(),
  publicKey: z.string().optional(),
  keyFingerprint: z.string().optional(),
  avatar: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const rateLimitResponse = enforceRateLimit(req, { limit: 120, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { searchParams } = new URL(req.url);
    const userId = (searchParams.get('userId') || 'default_user').trim().slice(0, 100);
    const profile = ServerDbService.getProfile(userId);
    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    return handleApiError(error, 500);
  }
}

export async function POST(req: NextRequest) {
  const rateLimitResponse = enforceRateLimit(req, { limit: 60, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const validation = await validateRequestBody(req, ProfileUpdateSchema);
    if (!validation.success) {
      return validation.response;
    }

    const body = validation.data;
    const userId = (body.userId || body.id || 'default_user').trim().slice(0, 100);
    const profile = ServerDbService.updateProfile(userId, body as any);
    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    return handleApiError(error, 400);
  }
}

export async function PUT(req: NextRequest) {
  return POST(req);
}
