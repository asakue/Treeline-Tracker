import { NextRequest, NextResponse } from 'next/server';
import { ServerDbService } from '@/lib/server-db';

export async function GET() {
  try {
    const emergencies = ServerDbService.getEmergencies();
    return NextResponse.json({ success: true, data: emergencies });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.action === 'resolve' && body.id) {
      const resolved = ServerDbService.resolveEmergency(body.id, body.resolvedBy || 'Dispatcher');
      return NextResponse.json({ success: true, data: resolved });
    }
    const created = ServerDbService.createEmergency(body);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
