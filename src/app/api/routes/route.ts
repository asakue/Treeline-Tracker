import { NextRequest, NextResponse } from 'next/server';
import { ServerDbService } from '@/lib/server-db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const routes = ServerDbService.getRoutes(includeArchived);
    return NextResponse.json({ success: true, data: routes });
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
    if (!body.name || !body.location) {
      return NextResponse.json(
        { success: false, error: 'Route name and location are required' },
        { status: 400 }
      );
    }
    const created = ServerDbService.createRoute(body);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'Route ID is required' },
        { status: 400 }
      );
    }
    const updated = ServerDbService.updateRoute(body.id, body);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Route ID is required' },
        { status: 400 }
      );
    }
    const success = ServerDbService.deleteRoute(id);
    return NextResponse.json({ success });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
