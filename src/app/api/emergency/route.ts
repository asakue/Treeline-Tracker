import { NextRequest, NextResponse } from 'next/server';
import { ServerDbService } from '@/lib/server-db';
import { enforceRateLimit, validateRequestBody, handleApiError } from '@/core/security/api-security';
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
  }),
  type: z.enum(['SOS_SIGNAL', 'MEDICAL_EMERGENCY', 'LOST_PERSON', 'GEAR_FAILURE', 'WEATHER_HAZARD']).default('SOS_SIGNAL'),
  message: z.string().default('Экстренный вызов SOS'),
  batteryLevel: z.number().min(0).max(100).optional(),
});

const EmergencyPostSchema = z.union([ResolveEmergencySchema, CreateEmergencySchema]);

export async function GET(req: NextRequest) {
  const rateLimitResponse = enforceRateLimit(req, { limit: 120, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const emergencies = ServerDbService.getEmergencies();
    return NextResponse.json({ success: true, data: emergencies });
  } catch (error) {
    return handleApiError(error, 500);
  }
}

export async function POST(req: NextRequest) {
  // Allow higher burst for emergency signaling (up to 300/min)
  const rateLimitResponse = enforceRateLimit(req, { limit: 300, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const validation = await validateRequestBody(req, EmergencyPostSchema);
    if (!validation.success) {
      return validation.response;
    }

    const body = validation.data;
    if ('action' in body && body.action === 'resolve') {
      const resolved = ServerDbService.resolveEmergency(body.id, body.resolvedBy || 'Dispatcher');
      if (!resolved) {
        return NextResponse.json({ success: false, error: 'Событие SOS не найдено' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: resolved });
    }

    const createPayload = body as z.infer<typeof CreateEmergencySchema>;
    const created = ServerDbService.createEmergency({
      senderId: createPayload.senderId,
      senderName: createPayload.senderName,
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
