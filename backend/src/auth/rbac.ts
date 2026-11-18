/**
 * @fileoverview Role-Based Access Control (RBAC) System
 * Defines role hierarchy, capabilities, and permission check utilities.
 */

export type UserRole = 'hiker' | 'guide' | 'rescuer' | 'admin';

export type Permission =
  | 'telemetry:write'
  | 'telemetry:read'
  | 'emergency:create'
  | 'emergency:read'
  | 'emergency:acknowledge'
  | 'emergency:resolve'
  | 'team:create'
  | 'team:manage'
  | 'team:read'
  | 'track:create'
  | 'track:manage'
  | 'track:read'
  | 'geofence:manage'
  | 'mesh:manage'
  | 'admin:all';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  hiker: 1,
  guide: 2,
  rescuer: 3,
  admin: 4,
};

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  hiker: [
    'telemetry:write',
    'telemetry:read',
    'emergency:create',
    'emergency:read',
    'team:read',
    'track:create',
    'track:read',
  ],
  guide: [
    'telemetry:write',
    'telemetry:read',
    'emergency:create',
    'emergency:read',
    'emergency:acknowledge',
    'team:create',
    'team:manage',
    'team:read',
    'track:create',
    'track:manage',
    'track:read',
    'geofence:manage',
    'mesh:manage',
  ],
  rescuer: [
    'telemetry:write',
    'telemetry:read',
    'emergency:create',
    'emergency:read',
    'emergency:acknowledge',
    'emergency:resolve',
    'team:read',
    'team:manage',
    'track:create',
    'track:manage',
    'track:read',
    'geofence:manage',
    'mesh:manage',
  ],
  admin: [
    'telemetry:write',
    'telemetry:read',
    'emergency:create',
    'emergency:read',
    'emergency:acknowledge',
    'emergency:resolve',
    'team:create',
    'team:manage',
    'team:read',
    'track:create',
    'track:manage',
    'track:read',
    'geofence:manage',
    'mesh:manage',
    'admin:all',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  if (role === 'admin') return true;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasRoleAtLeast(currentRole: UserRole, requiredRole: UserRole): boolean {
  return (ROLE_HIERARCHY[currentRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}

export function canManageTeam(userRole: UserRole, isTeamLeaderOrCreator: boolean): boolean {
  if (userRole === 'admin') return true;
  if (userRole === 'guide' && isTeamLeaderOrCreator) return true;
  return false;
}

export function canResolveEmergency(userRole: UserRole, isReporter: boolean): boolean {
  if (userRole === 'admin' || userRole === 'rescuer') return true;
  return isReporter;
}
