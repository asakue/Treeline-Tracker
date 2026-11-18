/**
 * @fileoverview Backend Service Entrypoint
 * Bootstraps database connection, Express application, and handles graceful shutdown.
 */

import * as http from 'node:http';
import * as dotenv from 'dotenv';
import { db, queryClient } from './db/client.js';
import { createDrizzleRepositories } from './repositories/drizzle.repositories.js';
import { TokenService } from './auth/jwt.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { createApp } from './app.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function bootstrap() {
  console.log('[Treeline Backend] Initializing service...');

  // Initialize Drizzle Repositories and Token Service
  const repos = createDrizzleRepositories(db);
  const tokenService = new TokenService(repos.tokens, process.env.JWT_SECRET);

  const app = createApp({
    repos,
    tokenService,
    rateLimiter,
  });

  const server = http.createServer(app);

  server.listen(PORT, HOST, () => {
    console.log(`[Treeline Backend] Server running at http://${HOST}:${PORT}`);
    console.log(`[Treeline Backend] API endpoints active under /api/v1`);
  });

  // Graceful Shutdown
  const shutdown = async (signal: string) => {
    console.log(`[Treeline Backend] Received ${signal}. Starting graceful shutdown...`);
    rateLimiter.destroy();

    server.close(async () => {
      console.log('[Treeline Backend] HTTP server closed.');
      try {
        await queryClient.end();
        console.log('[Treeline Backend] Database connection pool drained.');
      } catch (err) {
        console.error('[Treeline Backend] Error during pool drain:', err);
      }
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[Treeline Backend] Force closing after 10s timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[Treeline Backend] Fatal startup error:', err);
  process.exit(1);
});
