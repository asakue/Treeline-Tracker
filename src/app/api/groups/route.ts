import { NextRequest, NextResponse } from 'next/server';
import { ServerDbService } from '@/lib/server-db';

export async function GET() {
  try {
    const groups = ServerDbService.getGroups();
    return NextResponse.json({ success: true, data: groups });
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
        { success: false, error: 'Name and location are required' },
        { status: 400 }
      );
    }
    const created = ServerDbService.createGroup(body);
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
        { success: false, error: 'Group ID is required for update' },
        { status: 400 }
      );
    }
    const updated = ServerDbService.updateGroup(body.id, body);
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
        { success: false, error: 'Group ID is required' },
        { status: 400 }
      );
    }
    const success = ServerDbService.deleteGroup(id);
    return NextResponse.json({ success });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
