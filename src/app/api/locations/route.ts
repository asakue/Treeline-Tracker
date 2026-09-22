import { NextRequest, NextResponse } from 'next/server';
import { ServerDbService } from '@/lib/server-db';

export async function GET() {
  try {
    const locations = ServerDbService.getLocations();
    return NextResponse.json({ success: true, data: locations });
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
    if (!body.hikerId || body.latitude === undefined || body.longitude === undefined) {
      return NextResponse.json(
        { success: false, error: 'hikerId, latitude and longitude are required' },
        { status: 400 }
      );
    }
    ServerDbService.updateLocation(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
