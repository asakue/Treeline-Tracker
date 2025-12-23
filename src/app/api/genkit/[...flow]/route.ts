'use server';

import {ai} from '@/ai/genkit';
import '@/ai/flows/suggest-search-areas-for-lost-hiker';
import {NextRequest} from 'next/server';

export async function GET(req: NextRequest) {
  return await ai.handleRequest(req);
}

export async function POST(req: NextRequest) {
  return await ai.handleRequest(req);
}
