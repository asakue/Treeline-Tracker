import { NextRequest, NextResponse } from 'next/server';
import { ServerDbService } from '@/lib/server-db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || 'default_user';
    const profile = ServerDbService.getProfile(userId);
    return NextResponse.json({ success: true, data: profile });
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
    const userId = body.userId || body.id || 'default_user';
    const profile = ServerDbService.updateProfile(userId, body);
    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}

export async function PUT(req: NextRequest) {
  return POST(req);
}
