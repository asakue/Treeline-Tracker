/**
 * @fileoverview Teams REST API Routes
 * Endpoints: GET /, POST /, GET /:id, PUT /:id (OCC), DELETE /:id, POST /:id/members, DELETE /:id/members/:userId
 */

import { Router } from 'express';
import { z } from 'zod';
import { IRepositories } from '../../repositories/interfaces.js';
import { TokenService } from '../../auth/jwt.js';
import { createAuthGuard, AuthenticatedRequest } from '../../middleware/auth.guard.js';
import { validateBody } from '../../middleware/validation.js';
import { NotFoundError, ForbiddenError } from '../../middleware/error-handler.js';

const createTeamSchema = z.object({
  name: z.string().min(2).max(100),
  callsign: z.string().min(2).max(20).optional(),
  description: z.string().optional(),
  location: z.string().optional().default(''),
  distance: z.string().optional().default('0 км'),
  difficulty: z.string().optional().default('Средне'),
  safeRadiusMeters: z.number().positive().optional().default(500.0),
  sharedKeyId: z.string().optional(),
  startDate: z.string().optional(),
  leaderName: z.string().optional(),
});

const updateTeamSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  callsign: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  distance: z.string().optional(),
  difficulty: z.string().optional(),
  safeRadiusMeters: z.number().positive().optional(),
  status: z.enum(['PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'EMERGENCY']).optional(),
  version: z.number().int().min(1),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['LEADER', 'GUIDE', 'MEDIC', 'MEMBER', 'RESCUER']).optional().default('MEMBER'),
});

export function createTeamsRouter(repos: IRepositories, tokenService: TokenService): Router {
  const router = Router();
  const authGuard = createAuthGuard(tokenService);

  // 1. List Teams
  router.get('/', authGuard.requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const { status } = req.query;
      const user = req.user!;

      let teamsList;
      if (user.role === 'admin' || user.role === 'rescuer') {
        teamsList = await repos.teams.list({ status: status as string });
      } else {
        teamsList = await repos.teams.list({ status: status as string, userId: user.sub });
      }

      return res.status(200).json({
        success: true,
        data: teamsList,
      });
    } catch (err) {
      next(err);
    }
  });

  // 2. Create Team
  router.post(
    '/',
    authGuard.requireAuth,
    authGuard.requireRole(['guide', 'rescuer', 'admin']),
    validateBody(createTeamSchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const user = req.user!;
        const body = req.body;

        const team = await repos.teams.create({
          ...body,
          createdByUserId: user.sub,
          adminId: user.role === 'admin' ? user.sub : null,
          leaderName: body.leaderName || user.displayName,
          status: 'ACTIVE',
        });

        return res.status(201).json({
          success: true,
          data: team,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // 3. Get Team Details
  router.get('/:id', authGuard.requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = req.params.id as string;
      const team = await repos.teams.findById(id);
      if (!team) {
        throw new NotFoundError('Team not found', 'TEAM_NOT_FOUND');
      }

      const members = await repos.teams.getMembers(id);
      const activeGeofences = await repos.geofences.list({ teamId: id, activeOnly: true });

      return res.status(200).json({
        success: true,
        data: {
          ...team,
          members,
          geofences: activeGeofences,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // 4. Update Team with OCC check
  router.put(
    '/:id',
    authGuard.requireAuth,
    validateBody(updateTeamSchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const id = req.params.id as string;
        const { version, ...updateFields } = req.body;
        const user = req.user!;

        const team = await repos.teams.findById(id);
        if (!team) {
          throw new NotFoundError('Team not found', 'TEAM_NOT_FOUND');
        }

        // Check permission (Admin, Creator, or Leader)
        const members = await repos.teams.getMembers(id);
        const isLeader = members.some(m => m.userId === user.sub && m.role === 'LEADER');
        const isCreator = team.createdByUserId === user.sub;

        if (user.role !== 'admin' && !isLeader && !isCreator) {
          throw new ForbiddenError('Only team leaders or administrators can modify team details');
        }

        // Repository validates OCC version matching; throws OccConflictError (409) on mismatch
        const updated = await repos.teams.update(id, version, updateFields);

        return res.status(200).json({
          success: true,
          data: updated,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // 5. Delete Team
  router.delete('/:id', authGuard.requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = req.params.id as string;
      const user = req.user!;

      const team = await repos.teams.findById(id);
      if (!team) {
        throw new NotFoundError('Team not found', 'TEAM_NOT_FOUND');
      }

      if (user.role !== 'admin' && team.createdByUserId !== user.sub) {
        throw new ForbiddenError('Only team creator or administrator can delete team');
      }

      const deleted = await repos.teams.delete(id);
      return res.status(200).json({
        success: true,
        data: { deleted },
      });
    } catch (err) {
      next(err);
    }
  });

  // 6. Add Team Member
  router.post(
    '/:id/members',
    authGuard.requireAuth,
    validateBody(addMemberSchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const id = req.params.id as string;
        const { userId, role } = req.body;

        const team = await repos.teams.findById(id);
        if (!team) {
          throw new NotFoundError('Team not found', 'TEAM_NOT_FOUND');
        }

        const member = await repos.teams.addMember(id, userId, role);
        return res.status(201).json({
          success: true,
          data: member,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // 7. Remove Team Member
  router.delete('/:id/members/:userId', authGuard.requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = req.params.id as string;
      const userId = req.params.userId as string;
      const user = req.user!;

      const team = await repos.teams.findById(id);
      if (!team) {
        throw new NotFoundError('Team not found', 'TEAM_NOT_FOUND');
      }

      // Allowed if admin, creator, or self leaving
      if (user.role !== 'admin' && team.createdByUserId !== user.sub && user.sub !== userId) {
        throw new ForbiddenError('Forbidden to remove member');
      }

      const removed = await repos.teams.removeMember(id, userId);
      return res.status(200).json({
        success: true,
        data: { removed },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
