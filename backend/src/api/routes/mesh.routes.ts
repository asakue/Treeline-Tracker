/**
 * @fileoverview Mesh Nodes & LoRa Packets REST API Routes
 * Endpoints: GET /nodes, POST /nodes, POST /nodes/heartbeat, GET /messages
 */

import { Router } from 'express';
import { z } from 'zod';
import { IRepositories } from '../../repositories/interfaces.js';
import { TokenService } from '../../auth/jwt.js';
import { createAuthGuard, AuthenticatedRequest } from '../../middleware/auth.guard.js';
import { validateBody } from '../../middleware/validation.js';
import { NotFoundError } from '../../middleware/error-handler.js';

const registerNodeSchema = z.object({
  nodeNum: z.number().int().positive(),
  nodeIdStr: z.string().min(2).max(20),
  shortName: z.string().max(10).optional(),
  longName: z.string().max(100).optional(),
  hwModel: z.string().optional(),
  macAddress: z.string().optional(),
  publicKey: z.string().optional(),
  teamId: z.string().uuid().optional(),
  role: z.string().optional().default('ROUTER_CLIENT'),
});

const heartbeatSchema = z.object({
  nodeNum: z.number().int().positive(),
  batteryLevel: z.number().int().min(0).max(100).optional(),
  voltage: z.number().optional(),
  channelUtilization: z.number().optional(),
  airUtilTx: z.number().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  altitude: z.number().optional(),
});

export function createMeshRouter(repos: IRepositories, tokenService: TokenService): Router {
  const router = Router();
  const authGuard = createAuthGuard(tokenService);

  // 1. List Mesh Nodes
  router.get('/nodes', authGuard.optionalAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const { teamId, activeWithinMinutes } = req.query;
      const nodes = await repos.mesh.list({
        teamId: teamId as string,
        activeWithinMinutes: activeWithinMinutes ? parseInt(activeWithinMinutes as string, 10) : undefined,
      });

      return res.status(200).json({
        success: true,
        data: nodes,
      });
    } catch (err) {
      next(err);
    }
  });

  // 2. Register / Bind Mesh Node
  router.post('/nodes', authGuard.optionalAuth, validateBody(registerNodeSchema), async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = req.user;
      const body = req.body;

      const node = await repos.mesh.registerNode({
        ...body,
        userId: user?.sub || null,
        teamId: body.teamId || null,
        shortName: body.shortName || null,
        longName: body.longName || null,
        hwModel: body.hwModel || null,
        macAddress: body.macAddress || null,
        publicKey: body.publicKey || null,
        batteryLevel: null,
        voltage: null,
        channelUtilization: null,
        airUtilTx: null,
        latitude: null,
        longitude: null,
        altitude: null,
        lastHeard: new Date(),
      });

      return res.status(201).json({
        success: true,
        data: node,
      });
    } catch (err) {
      next(err);
    }
  });

  // 3. Node Heartbeat (Radio metrics & position)
  router.post('/nodes/heartbeat', authGuard.optionalAuth, validateBody(heartbeatSchema), async (req, res, next) => {
    try {
      const { nodeNum, ...vitals } = req.body;
      const updated = await repos.mesh.updateHeartbeat(nodeNum, vitals);

      if (!updated) {
        throw new NotFoundError(`Mesh node ${nodeNum} not registered`, 'NODE_NOT_FOUND');
      }

      return res.status(200).json({
        success: true,
        data: {
          nodeNum: updated.nodeNum,
          status: 'ONLINE',
          lastHeard: updated.lastHeard,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // 4. Mesh Packet Logs
  router.get('/messages', authGuard.optionalAuth, async (req, res, next) => {
    try {
      const { teamId, limit } = req.query;
      const messages = await repos.mesh.getMessages({
        teamId: teamId as string,
        limit: limit ? parseInt(limit as string, 10) : 100,
      });

      return res.status(200).json({
        success: true,
        data: messages,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
