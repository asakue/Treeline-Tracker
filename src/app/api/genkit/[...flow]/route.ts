import { NextRequest, NextResponse } from 'next/server';
import { suggestSearchAreasFlow } from '@/ai/flows/suggest-search-areas-for-lost-hiker';

export async function GET() {
  return NextResponse.json({ status: 'active', flow: 'suggestSearchAreasFlow' });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await suggestSearchAreasFlow(body);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

