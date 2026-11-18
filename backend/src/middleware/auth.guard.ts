/**
 * @fileoverview Authentication & RBAC Guard Middleware
 * Verifies Bearer JWT access tokens and enforces role-based and team-based authorizations.
 */

import { Request, Response, NextFunction } from 'express';
import { TokenService, JwtAccessTokenPayload } from '../auth/jwt.js';
import { UserRole } from '../auth/rbac.js';

export interface AuthenticatedRequest extends Request {
  user?: JwtAccessTokenPayload;
}

export function createAuthGuard(tokenService: TokenService) {
  return {
    /**
     * Verifies Bearer JWT access token and attaches user to request.
     */
    requireAuth: (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
          message: 'Missing or malformed Authorization header with Bearer token',
        });
      }

      const token = authHeader.slice(7).trim();
      try {
        const decoded = tokenService.verifyAccessToken(token);
        req.user = decoded;
        next();
      } catch (err: any) {
        const isExpired = err.name === 'TokenExpiredError';
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_ACCESS_TOKEN',
          message: isExpired ? 'Access token expired' : 'Invalid access token',
        });
      }
    },

    /**
     * Optional authentication: decodes user if token is present, continues anonymously if not.
     */
    optionalAuth: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        try {
          req.user = tokenService.verifyAccessToken(token);
        } catch {
          // Ignore invalid token in optional auth
        }
      }
      next();
    },

    /**
     * Checks if user possesses one of the allowed roles.
     */
    requireRole: (allowedRoles: UserRole[]) => {
      return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          });
        }

        if (!allowedRoles.includes(req.user.role)) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            code: 'FORBIDDEN',
            message: `Action requires one of roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
          });
        }

        next();
      };
    },

    /**
     * Checks team membership or SAR/admin override.
     */
    requireTeamAccess: (teamIdParamKey = 'id') => {
      return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            code: 'UNAUTHORIZED',
          });
        }

        // Rescuers and Admins have global mission access
        if (req.user.role === 'rescuer' || req.user.role === 'admin') {
          return next();
        }

        const targetTeamId = req.params[teamIdParamKey] || req.body?.teamId;
        if (!targetTeamId || !req.user.teams.includes(targetTeamId)) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            code: 'FORBIDDEN',
            message: 'You are not a member of this expedition team',
          });
        }

        next();
      };
    },
  };
}
