import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

describe('/api/routes/classify POST Endpoint', () => {
  it('classifies mountain Caucasus route coordinates successfully', async () => {
    const req = new NextRequest('http://localhost:3000/api/routes/classify', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        path: [
          [43.349, 42.445],
          [43.355, 42.440],
        ],
        maxElevationM: 3200,
        ascentM: 900,
        maxSlopeDeg: 28,
        sacDifficulty: 'T3',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.location).toContain('Приэльбрусье');
    expect(json.data.type).toBe('Горный');
    expect(json.data.difficulty).toBe('Сложно');
    expect(json.data.routingProfile).toBe('hiking-mountain');
  });

  it('rejects invalid request with empty path', async () => {
    const req = new NextRequest('http://localhost:3000/api/routes/classify', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        path: [],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it('rejects coordinates exceeding valid latitude bounds', async () => {
    const req = new NextRequest('http://localhost:3000/api/routes/classify', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        path: [[195.0, 42.0]],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
