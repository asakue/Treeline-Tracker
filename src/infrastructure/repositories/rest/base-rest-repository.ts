/**
 * @fileoverview Base REST Repository with Authentication, Timeout & Endpoint Resolution
 */

import { Rbac } from '@/core/security/rbac-service';

export interface RequestOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export abstract class BaseRestRepository {
  protected defaultTimeoutMs = 3000;

  /**
   * Resolves the configured API base URL
   */
  protected getBaseUrl(): string {
    if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) {
      const url = process.env.NEXT_PUBLIC_API_URL.trim();
      if (url.length > 0) {
        return url.replace(/\/$/, '');
      }
    }
    if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
      return window.location.origin;
    }
    return 'http://localhost:3000';
  }

  /**
   * Resolves endpoint URLs with support for both Next.js co-located routes (/api/*)
   * and standalone backend service routes (/api/v1/*).
   */
  protected toUrl(endpointPath: string): string {
    const base = this.getBaseUrl();
    const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;

    // If targeting /api/v1 standalone backend service, translate Next.js route paths to backend paths
    if (base.endsWith('/api/v1')) {
      if (cleanPath.startsWith('/api/groups')) {
        return `${base}${cleanPath.replace('/api/groups', '/teams')}`;
      }
      if (cleanPath.startsWith('/api/routes')) {
        return `${base}${cleanPath.replace('/api/routes', '/tracks')}`;
      }
      if (cleanPath.startsWith('/api/emergency')) {
        return `${base}${cleanPath.replace('/api/emergency', '/emergency/sos')}`;
      }
      if (cleanPath.startsWith('/api/locations')) {
        return `${base}${cleanPath.replace('/api/locations', '/telemetry/batch')}`;
      }
    }

    return `${base}${cleanPath}`;
  }

  /**
   * Constructs standard HTTP headers including RBAC auth tokens and JSON content type
   */
  protected getAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const rbacHeaders = typeof window !== 'undefined' ? Rbac.getAuthHeaders() : {};
    return {
      'Content-Type': 'application/json',
      ...rbacHeaders,
      ...extra,
    };
  }

  /**
   * Evaluates browser online status
   */
  protected isOnline(): boolean {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  }

  /**
   * Executes fetch with AbortSignal timeout and unrolls standard JSON envelopes
   */
  protected async fetchWithTimeout<T>(
    url: string,
    init: RequestInit = {},
    timeoutMs = this.defaultTimeoutMs
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: this.getAuthHeaders(init.headers as Record<string, string>),
      });

      if (!response.ok) {
        let errMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errJson = await response.json();
          if (errJson.error) {
            errMessage = errJson.error;
          } else if (errJson.message) {
            errMessage = errJson.message;
          }
        } catch {
          // ignore parsing error
        }
        throw new Error(errMessage);
      }

      const json = await response.json();

      // Unwrap standard API response envelope: { success: true, data: T }
      if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
        return json.data as T;
      }
      return json as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
