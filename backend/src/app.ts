/**
 * @fileoverview Express Application Factory
 * Configures middleware, rate limiting, route registration, and error handling.
 */

import express, { Express } from 'express';
import cors from 'cors';
import { IRepositories } from './repositories/interfaces.js';
import { TokenService } from './auth/jwt.js';
import { SlidingWindowRateLimiter, rateLimiter as defaultRateLimiter } from './middleware/rate-limiter.js';
import { createApiRouter } from './api/index.js';
import { errorHandler, NotFoundError } from './middleware/error-handler.js';

export interface AppConfig {
  repos: IRepositories;
  tokenService: TokenService;
  rateLimiter?: SlidingWindowRateLimiter;
  corsOrigin?: string;
}

export function createApp(config: AppConfig): Express {
  const app = express();

  // 1. CORS Configuration
  app.use(cors({
    origin: config.corsOrigin || process.env.CORS_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Emergency-Priority',
      'X-RateLimit-Bypass',
    ],
  }));

  // 2. Request Parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 3. Multi-tier Sliding Window Rate Limiter
  const activeRateLimiter = config.rateLimiter || defaultRateLimiter;
  app.use(activeRateLimiter.middleware());

  // 4. API v1 Router
  app.use('/api/v1', createApiRouter(config.repos, config.tokenService));

  // 5. Root route
  app.get('/', (_req, res) => {
    res.json({
      name: 'Treeline Tracker API',
      version: '1.0.0',
      docs: '/api/v1/health',
    });
  });

  // 6. Catch-all 404 Handler
  app.use((_req, _res, next) => {
    next(new NotFoundError('The requested endpoint was not found on this server', 'ENDPOINT_NOT_FOUND'));
  });

  // 7. Centralized Error Handler
  app.use(errorHandler);

  return app;
}
