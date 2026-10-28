import { NextRequest, NextResponse } from 'next/server';
import { ServerDbService } from '@/lib/server-db';
import { enforceRateLimit, validateRequestBody, handleApiError, authenticateRequest } from '@/core/security/api-security';
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
  avatarUrl: z.string().optional(),
  bio: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  const rateLimitResponse = enforceRateLimit(req, { limit: 120, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  const auth = authenticateRequest(req);
  if (!auth.authenticated && auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const requestedUserId = (searchParams.get('userId') || auth.user.uid || 'default_user').trim().slice(0, 100);
    const profile = ServerDbService.getProfile(requestedUserId);

    // Privacy & PII protection:
    // Only return phone and emergencyContact if the user is viewing their own profile
    // or if the requester has rescuer or admin privileges.
    const isOwner = auth.user.uid === requestedUserId || auth.user.uid === profile.userId;
    const hasElevatedPrivilege = auth.user.role === 'rescuer' || auth.user.role === 'admin';

    if (!isOwner && !hasElevatedPrivilege) {
      const sanitizedProfile = {
        id: profile.id,
        userId: profile.userId,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        experienceLevel: profile.experienceLevel,
        privacyMode: profile.privacyMode,
        publicKey: profile.publicKey,
        bio: profile.bio,
        updatedAt: profile.updatedAt,
      };
      return NextResponse.json({ success: true, data: sanitizedProfile });
    }

    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    return handleApiError(error, 500);
  }
}

export async function POST(req: NextRequest) {
  const rateLimitResponse = enforceRateLimit(req, { limit: 60, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  const auth = authenticateRequest(req);
  if (!auth.authenticated && auth.response) return auth.response;

  try {
    const validation = await validateRequestBody(req, ProfileUpdateSchema);
    if (!validation.success) {
      return validation.response;
    }

    const body = validation.data;
    const targetUserId = (body.userId || body.id || auth.user.uid || 'default_user').trim().slice(0, 100);

    // IDOR protection: only owner or admin can update a profile
    const isOwner = auth.user.uid === targetUserId || targetUserId === 'default_user' || targetUserId.length === 0;
    const isAdmin = auth.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Запрещено редактировать чужой профиль', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Role escalation protection: non-admins cannot change roles
    if (body.role && !isAdmin) {
      delete body.role;
    }

    const profile = ServerDbService.updateProfile(targetUserId, body as any);
    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    return handleApiError(error, 400);
  }
}

export async function PUT(req: NextRequest) {
  return POST(req);
}
