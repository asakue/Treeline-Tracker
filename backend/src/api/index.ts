/**
 * @fileoverview Main API Router mounting all `/api/v1` route families
 */

import { Router } from 'express';
import { IRepositories } from '../repositories/interfaces.js';
import { TokenService } from '../auth/jwt.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createTeamsRouter } from './routes/teams.routes.js';
import { createTracksRouter } from './routes/tracks.routes.js';
import { createWaypointsRouter } from './routes/waypoints.routes.js';
import { createGeofencesRouter } from './routes/geofences.routes.js';
import { createTelemetryRouter } from './routes/telemetry.routes.js';
import { createMeshRouter } from './routes/mesh.routes.js';
import { createEmergencyRouter } from './routes/emergency.routes.js';

export function createApiRouter(repos: IRepositories, tokenService: TokenService): Router {
  const router = Router();

  // Health check endpoint
  router.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'treeline-backend',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API route families
  router.use('/auth', createAuthRouter(repos, tokenService));
  router.use('/teams', createTeamsRouter(repos, tokenService));
  router.use('/tracks', createTracksRouter(repos, tokenService));
  router.use('/waypoints', createWaypointsRouter(repos, tokenService));
  router.use('/geofences', createGeofencesRouter(repos, tokenService));
  router.use('/telemetry', createTelemetryRouter(repos, tokenService));
  router.use('/mesh', createMeshRouter(repos, tokenService));
  router.use('/emergency', createEmergencyRouter(repos, tokenService));

  return router;
}
