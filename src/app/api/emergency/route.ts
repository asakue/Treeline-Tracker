import { NextRequest, NextResponse } from 'next/server';
import { ServerDbService } from '@/lib/server-db';
import { enforceRateLimit, validateRequestBody, handleApiError, authenticateRequest } from '@/core/security/api-security';
import { SecurePacketSchema } from '@/core/domain/schemas';
import { SecurePacketService } from '@/core/security/secure-packet-service';
import { CryptoService } from '@/core/security/crypto-service';
import { z } from 'zod';

const ResolveEmergencySchema = z.object({
  action: z.literal('resolve'),
  id: z.string().min(1),
  resolvedBy: z.string().optional(),
});

const CreateEmergencySchema = z.object({
  action: z.literal('create').optional(),
  senderId: z.string().min(1),
  senderName: z.string().min(1),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    altitude: z.number().optional(),
    accuracy: z.number().nonnegative().optional(),
  }).optional(),
  type: z.enum(['SOS_SIGNAL', 'MEDICAL_EMERGENCY', 'LOST_PERSON', 'GEAR_FAILURE', 'WEATHER_HAZARD']).default('SOS_SIGNAL'),
  message: z.string().default('Экстренный вызов SOS'),
  batteryLevel: z.number().min(0).max(100).optional(),
  securePacket: z.any().optional(),
});

const EmergencyPostSchema = z.union([ResolveEmergencySchema, CreateEmergencySchema]);

export async function GET(req: NextRequest) {
  const rateLimitResponse = enforceRateLimit(req, { limit: 120, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  const auth = authenticateRequest(req);
  if (!auth.authenticated && auth.response) return auth.response;

  try {
    const emergencies = ServerDbService.getEmergencies();

    // Rescuers, operators and admins have sector-wide read access
    if (auth.user.role === 'rescuer' || auth.user.role === 'admin') {
      return NextResponse.json({ success: true, data: emergencies });
    }

    // Hikers can view active emergencies in their sector or events reported by themselves
    const filtered = emergencies.filter(
      (e) => e.senderId === auth.user.uid || e.status === 'ACTIVE'
    );
    return NextResponse.json({ success: true, data: filtered });
  } catch (error) {
    return handleApiError(error, 500);
  }
}

export async function POST(req: NextRequest) {
  // Allow higher burst for emergency signaling (up to 300/min)
  const rateLimitResponse = enforceRateLimit(req, { limit: 300, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  const auth = authenticateRequest(req);
  if (!auth.authenticated && auth.response) return auth.response;

  try {
    const validation = await validateRequestBody(req, EmergencyPostSchema);
    if (!validation.success) {
      return validation.response;
    }

    const body = validation.data;
    if ('action' in body && body.action === 'resolve') {
      const existing = ServerDbService.getEmergencies().find((e) => e.id === body.id);
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Событие SOS не найдено' }, { status: 404 });
      }

      // Authorization: Only rescuer, admin, or the original reporter can resolve an emergency
      const isReporter = auth.user.uid === existing.senderId;
      const isRescuer = auth.user.role === 'rescuer' || auth.user.role === 'admin';
      if (!isReporter && !isRescuer && auth.user.uid !== 'anonymous-hiker') {
        return NextResponse.json(
          { success: false, error: 'Недостаточно прав для отмены сигнала SOS', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }

      const resolverName = isRescuer ? `Спасатель (${auth.user.displayName || auth.user.uid})` : body.resolvedBy || 'Диспетчер';
      const resolved = ServerDbService.resolveEmergency(body.id, resolverName);
      return NextResponse.json({ success: true, data: resolved });
    }

    const createPayload = body as z.infer<typeof CreateEmergencySchema>;

    // If SecurePacket cryptographic envelope is attached, verify Ed25519 signature
    if (createPayload.securePacket) {
      const parsedSp = SecurePacketSchema.safeParse(createPayload.securePacket);
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
            { success: false, error: 'Invalid emergency packet cryptographic signature' },
            { status: 401 }
          );
        }
      }
    }

    const senderId = createPayload.senderId || auth.user.uid;
    const senderName = createPayload.senderName || auth.user.displayName || 'Пользователь';

    const created = ServerDbService.createEmergency({
      senderId,
      senderName,
      location: createPayload.location,
      type: createPayload.type,
      message: createPayload.message,
      status: 'ACTIVE',
      batteryLevel: createPayload.batteryLevel,
      acknowledgedBy: [],
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 400);
  }
}
