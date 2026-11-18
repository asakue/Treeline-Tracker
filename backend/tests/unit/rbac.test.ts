/**
 * @fileoverview Unit Tests for Role-Based Access Control (RBAC)
 */

import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  hasRoleAtLeast,
  canManageTeam,
  canResolveEmergency,
  ROLE_HIERARCHY,
} from '../../src/auth/rbac.js';

describe('RBAC Unit Tests', () => {
  it('correctly orders role hierarchy (admin > rescuer > guide > hiker)', () => {
    expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.rescuer);
    expect(ROLE_HIERARCHY.rescuer).toBeGreaterThan(ROLE_HIERARCHY.guide);
    expect(ROLE_HIERARCHY.guide).toBeGreaterThan(ROLE_HIERARCHY.hiker);

    expect(hasRoleAtLeast('admin', 'guide')).toBe(true);
    expect(hasRoleAtLeast('guide', 'admin')).toBe(false);
    expect(hasRoleAtLeast('guide', 'guide')).toBe(true);
  });

  it('evaluates permissions for each role accurately', () => {
    // Admin has all permissions
    expect(hasPermission('admin', 'admin:all')).toBe(true);
    expect(hasPermission('admin', 'emergency:resolve')).toBe(true);

    // Rescuer can resolve emergencies
    expect(hasPermission('rescuer', 'emergency:resolve')).toBe(true);
    expect(hasPermission('rescuer', 'admin:all')).toBe(false);

    // Guide can manage teams and tracks but not resolve general SAR emergencies
    expect(hasPermission('guide', 'team:manage')).toBe(true);
    expect(hasPermission('guide', 'track:create')).toBe(true);
    expect(hasPermission('guide', 'emergency:resolve')).toBe(false);

    // Hiker has basic access
    expect(hasPermission('hiker', 'telemetry:write')).toBe(true);
    expect(hasPermission('hiker', 'emergency:create')).toBe(true);
    expect(hasPermission('hiker', 'team:manage')).toBe(false);
  });

  it('correctly decides team management rights', () => {
    expect(canManageTeam('admin', false)).toBe(true);
    expect(canManageTeam('guide', true)).toBe(true);
    expect(canManageTeam('guide', false)).toBe(false);
    expect(canManageTeam('hiker', true)).toBe(false);
  });

  it('correctly decides emergency resolution rights', () => {
    expect(canResolveEmergency('admin', false)).toBe(true);
    expect(canResolveEmergency('rescuer', false)).toBe(true);
    expect(canResolveEmergency('hiker', true)).toBe(true); // Original reporter can resolve
    expect(canResolveEmergency('hiker', false)).toBe(false); // Other hiker cannot resolve
  });
});
