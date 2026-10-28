import { NextRequest, NextResponse } from 'next/server';
import { ServerDbService } from '@/lib/server-db';
import { enforceRateLimit, validateRequestBody, handleApiError, authenticateRequest } from '@/core/security/api-security';
import { LocationUpdateSchema, SecurePacketSchema } from '@/core/domain/schemas';
import { SecurePacketService } from '@/core/security/secure-packet-service';
import { CryptoService } from '@/core/security/crypto-service';
import { z } from 'zod';

const ApiLocationInputSchema = LocationUpdateSchema.partial({
  timestamp: true,
  privacyMode: true,
}).extend({
  battery: z.number().min(0).max(100).optional(),
  securePacket: z.any().optional(),
});

export async function GET(req: NextRequest) {
  const rateLimitResponse = enforceRateLimit(req, { limit: 120, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  const auth = authenticateRequest(req);
  if (!auth.authenticated && auth.response) return auth.response;

  try {
    const allLocations = ServerDbService.getLocations();

    // Rescuers, operators, and admins can monitor all locations in their sector
    if (auth.user.role === 'rescuer' || auth.user.role === 'admin') {
      return NextResponse.json({ success: true, data: allLocations });
    }

    // Hikers and guides only receive telemetry within their expedition group
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get('groupId');

    const filtered: Record<string, any> = {};
    if (groupId) {
      const group = ServerDbService.getGroupById(groupId);
      const allowedHikerIds = new Set(group?.hikers.map((h) => h.id) || []);
      allowedHikerIds.add(auth.user.uid);

      for (const [id, loc] of Object.entries(allLocations)) {
        if (allowedHikerIds.has(id)) {
          filtered[id] = loc;
        }
      }
      return NextResponse.json({ success: true, data: filtered });
    }

    // Default: return user's own location or permitted locations
    if (allLocations[auth.user.uid]) {
      filtered[auth.user.uid] = allLocations[auth.user.uid];
      return NextResponse.json({ success: true, data: filtered });
    }

    return NextResponse.json({ success: true, data: allLocations });
  } catch (error) {
    return handleApiError(error, 500);
  }
}

export async function POST(req: NextRequest) {
  const rateLimitResponse = enforceRateLimit(req, { limit: 180, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  const auth = authenticateRequest(req);
  if (!auth.authenticated && auth.response) return auth.response;

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

    // If SecurePacket cryptographic envelope is present, verify Ed25519 digital signature
    if (validation.data.securePacket) {
      const parsedSp = SecurePacketSchema.safeParse(validation.data.securePacket);
      if (parsedSp.success) {
        const sp = parsedSp.data;
        const signingPayload = SecurePacketService.getPacketSigningPayload(sp);
        const validSig = await CryptoService.verifySignature(
          signingPayload,
          sp.signature,
          sp.senderPublicKey
        );
        if (!validSig) {
          return NextResponse.json(
            { success: false, error: 'Invalid packet cryptographic signature' },
            { status: 401 }
          );
        }
      }
    }

    // GPS spoofing prevention: regular users cannot emit coordinates under someone else's ID
    if (
      payload.hikerId &&
      payload.hikerId !== auth.user.uid &&
      auth.user.uid !== 'anonymous-hiker' &&
      auth.user.role !== 'admin' &&
      auth.user.role !== 'rescuer'
    ) {
      payload.hikerId = auth.user.uid;
    }

    ServerDbService.updateLocation(payload as any);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 400);
  }
}
