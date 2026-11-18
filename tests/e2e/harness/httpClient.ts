/**
 * REST API Client for Treeline Tracker E2E Test Suite
 * Treeline Tracker - Opaque-box Test Harness
 * 
 * Provides type-safe HTTP client with:
 * - Bearer auth token injection
 * - Automatic JSON serialization and parsing
 * - Performance timing measurement
 * - Fluent status assertion helper: .expectStatus(status)
 * - Domain service helpers for Auth, Teams, Waypoints, Tracks, Geofences, Telemetry, Mesh, and Emergency
 */

export interface ApiResponse<T = any> {
  status: number;
  ok: boolean;
  data: T;
  headers: Headers;
  durationMs: number;
  expectStatus(expected: number): ApiResponse<T>;
}

export class ApiClient {
  private token?: string;
  private baseUrl: string;

  constructor(baseUrl = 'http://127.0.0.1:3001') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = undefined;
  }

  async request<T = any>(
    method: string,
    path: string,
    body?: any,
    customHeaders: Record<string, string> = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    if (this.token && !headers['Authorization'] && !headers['authorization']) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const start = Date.now();
    let response: Response;

    const options: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    response = await fetch(url, options);
    const durationMs = Date.now() - start;

    let data: any = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (_) {
        data = null;
      }
    } else {
      try {
        data = await response.text();
      } catch (_) {
        data = null;
      }
    }

    const apiResponse: ApiResponse<T> = {
      status: response.status,
      ok: response.ok,
      data,
      headers: response.headers,
      durationMs,
      expectStatus(expected: number): ApiResponse<T> {
        if (this.status !== expected) {
          throw new Error(
            `Expected HTTP ${expected} but received HTTP ${this.status} on ${method} ${path}\nResponse Data: ${JSON.stringify(
              this.data
            )}`
          );
        }
        return this;
      },
    };

    return apiResponse;
  }

  // --- Auth Helpers ---
  auth = {
    register: (payload: { email: string; password: string; displayName?: string }) =>
      this.request('POST', '/api/v1/auth/register', payload),
    login: (payload: { email: string; password: string }) =>
      this.request('POST', '/api/v1/auth/login', payload),
    refresh: (payload: { refreshToken: string }) =>
      this.request('POST', '/api/v1/auth/refresh', payload),
    logout: (payload: { refreshToken?: string }) =>
      this.request('POST', '/api/v1/auth/logout', payload),
    me: (customToken?: string) =>
      this.request('GET', '/api/v1/auth/me', undefined, customToken ? { Authorization: `Bearer ${customToken}` } : {}),
  };

  // --- Teams Helpers ---
  teams = {
    create: (payload: { name: string; callsign?: string; safeRadiusMeters?: number }) =>
      this.request('POST', '/api/v1/teams', payload),
    list: () => this.request('GET', '/api/v1/teams'),
    get: (id: string) => this.request('GET', `/api/v1/teams/${id}`),
    update: (id: string, payload: { name?: string; safeRadiusMeters?: number; version?: number }) =>
      this.request('PUT', `/api/v1/teams/${id}`, payload),
    addMember: (teamId: string, payload: { userId: string; role?: string }) =>
      this.request('POST', `/api/v1/teams/${teamId}/members`, payload),
    removeMember: (teamId: string, userId: string) =>
      this.request('DELETE', `/api/v1/teams/${teamId}/members/${userId}`),
  };

  // --- Waypoints Helpers ---
  waypoints = {
    create: (payload: {
      teamId?: string;
      name: string;
      symbol: string;
      latitude: number;
      longitude: number;
      altitude?: number;
      isHazard?: boolean;
      hazardRadiusMeters?: number;
      sequenceOrder?: number;
    }) => this.request('POST', '/api/v1/waypoints', payload),
    list: (teamId?: string) =>
      this.request('GET', teamId ? `/api/v1/waypoints?teamId=${teamId}` : '/api/v1/waypoints'),
    update: (id: string, payload: { name?: string; sequenceOrder?: number }) =>
      this.request('PATCH', `/api/v1/waypoints/${id}`, payload),
    delete: (id: string) => this.request('DELETE', `/api/v1/waypoints/${id}`),
  };

  // --- Tracks Helpers ---
  tracks = {
    create: (payload: {
      teamId?: string;
      name: string;
      difficulty?: string;
      corridorWidthMeters?: number;
      path: Array<[number, number]>;
    }) => this.request('POST', '/api/v1/tracks', payload),
    get: (id: string) => this.request('GET', `/api/v1/tracks/${id}`),
    update: (id: string, payload: { name?: string; version?: number }) =>
      this.request('PUT', `/api/v1/tracks/${id}`, payload),
    archive: (id: string, isArchived = true) =>
      this.request('PATCH', `/api/v1/tracks/${id}`, { isArchived }),
    evaluate: (id: string, payload: { latitude: number; longitude: number; headingDeg?: number }) =>
      this.request('POST', `/api/v1/tracks/${id}/evaluate`, payload),
    sarCorridor: (id: string) =>
      this.request('POST', `/api/v1/tracks/${id}/sar-corridor`, {}),
  };

  // --- Geofences Helpers ---
  geofences = {
    create: (payload: {
      teamId?: string;
      name: string;
      fenceType?: string;
      shapeType: 'CIRCLE' | 'POLYGON';
      centerLatitude?: number;
      centerLongitude?: number;
      radiusMeters?: number;
      polygonCoordinates?: Array<[number, number]>;
      breachAction?: string;
    }) => this.request('POST', '/api/v1/geofences', payload),
    list: () => this.request('GET', '/api/v1/geofences'),
    update: (id: string, payload: { isActive?: boolean }) =>
      this.request('PATCH', `/api/v1/geofences/${id}`, payload),
    delete: (id: string) => this.request('DELETE', `/api/v1/geofences/${id}`),
    check: (id: string, payload: { latitude: number; longitude: number }) =>
      this.request('POST', `/api/v1/geofences/${id}/check`, payload),
  };

  // --- Telemetry Helpers ---
  telemetry = {
    insert: (payload: {
      userId?: string;
      meshNodeId?: string;
      latitude: number;
      longitude: number;
      altitude?: number;
      speedMps?: number;
      headingDeg?: number;
      batteryLevel?: number;
      transportType?: string;
      privacyMode?: string;
      recordedAt?: string;
    }) => this.request('POST', '/api/v1/telemetry', payload),
    batchInsert: (points: Array<any>) =>
      this.request('POST', '/api/v1/telemetry/batch', { points }),
    history: (params: { userId?: string; trackId?: string; from?: number; to?: number; limit?: number } = {}) => {
      const q = new URLSearchParams();
      if (params.userId) q.set('userId', params.userId);
      if (params.trackId) q.set('trackId', params.trackId);
      if (params.from) q.set('from', params.from.toString());
      if (params.to) q.set('to', params.to.toString());
      if (params.limit) q.set('limit', params.limit.toString());
      return this.request('GET', `/api/v1/telemetry/history?${q.toString()}`);
    },
  };

  // --- Mesh Helpers ---
  mesh = {
    listNodes: () => this.request('GET', '/api/v1/mesh/nodes'),
    heartbeat: (payload: { nodeId: string; name?: string; battery?: number }) =>
      this.request('POST', '/api/v1/mesh/nodes/heartbeat', payload),
  };

  // --- Emergency SOS Helpers ---
  emergency = {
    triggerSos: (payload: {
      emergencyType: string;
      latitude: number;
      longitude: number;
      notes?: string;
      priority?: string;
    }) => this.request('POST', '/api/v1/emergency/sos', payload),
    resolve: (id: string, payload: { resolutionNotes: string }) =>
      this.request('PATCH', `/api/v1/emergency/${id}/resolve`, payload),
  };
}
