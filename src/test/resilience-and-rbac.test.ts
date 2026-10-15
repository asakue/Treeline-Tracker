import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateAndIncrementVersion, ConcurrencyConflictError } from '@/core/domain/occ';
import { Rbac, ROLE_PERMISSIONS } from '@/core/security/rbac-service';
import { TransportManager } from '@/core/transport';
import { ChaosSimulator } from '@/core/transport/chaos-simulator';
import { AuditLogger } from '@/core/transport/audit-logger';

describe('Resilience, OCC, RBAC & Transport Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ChaosSimulator.updateConfig({
      forceOfflineInternet: false,
      forceOfflineMesh: false,
      packetDropRate: 0,
      batteryOverride: null,
    });
  });

  describe('1. Optimistic Concurrency Control (OCC) Engine', () => {
    it('successfully increments entity version on matching version', () => {
      const currentEntity = {
        id: 'route-caucasus-1',
        name: 'Перевал Азау',
        version: 1,
      };

      const result = validateAndIncrementVersion(currentEntity, {
        name: 'Перевал Азау (Новый трек)',
        expectedVersion: 1,
      });

      expect(result.newVersion).toBe(2);
      expect(result.updated.version).toBe(2);
      expect(result.updated.name).toBe('Перевал Азау (Новый трек)');
      expect(result.updated.updatedAt).toBeDefined();
    });

    it('throws ConcurrencyConflictError when expectedVersion does not match current version', () => {
      const currentEntity = {
        id: 'group-777',
        name: 'Экспедиция 2026',
        version: 3,
      };

      expect(() => {
        validateAndIncrementVersion(currentEntity, {
          name: 'Конфликтное переименование',
          expectedVersion: 2,
        });
      }).toThrowError(ConcurrencyConflictError);
    });

    it('defaults unversioned entities to version 1 and increments to 2', () => {
      const unversioned = {
        id: 'legacy-route',
        name: 'Старая тропа',
      };

      const result = validateAndIncrementVersion(unversioned, {
        name: 'Старая тропа (обновлено)',
      });

      expect(result.newVersion).toBe(2);
      expect(result.updated.version).toBe(2);
    });
  });

  describe('2. Role-Based Access Control (RBAC) & Multi-Factor Authentication', () => {
    it('enforces distinct permission matrix across roles', () => {
      expect(ROLE_PERMISSIONS.hiker.canCreateGroup).toBe(false);
      expect(ROLE_PERMISSIONS.hiker.canTriggerSOS).toBe(true);

      expect(ROLE_PERMISSIONS.guide.canCreateGroup).toBe(true);
      expect(ROLE_PERMISSIONS.guide.canDrawRoute).toBe(true);
      expect(ROLE_PERMISSIONS.guide.canAccessSARAI).toBe(false);

      expect(ROLE_PERMISSIONS.rescuer.canAccessSARAI).toBe(true);
      expect(ROLE_PERMISSIONS.rescuer.canAcknowledgeEmergency).toBe(true);
      expect(ROLE_PERMISSIONS.rescuer.requiresMfa).toBe(true);

      expect(ROLE_PERMISSIONS.admin.canCreateGroup).toBe(true);
      expect(ROLE_PERMISSIONS.admin.canAccessChaosSimulator).toBe(true);
      expect(ROLE_PERMISSIONS.admin.requiresMfa).toBe(true);
    });

    it('allows role switching and verifies permission changes', () => {
      Rbac.switchRole('hiker');
      expect(Rbac.getSession().role).toBe('hiker');
      expect(Rbac.hasPermission('canCreateGroup')).toBe(false);

      Rbac.switchRole('guide');
      expect(Rbac.getSession().role).toBe('guide');
      expect(Rbac.hasPermission('canCreateGroup')).toBe(true);
    });

    it('requires and validates 6-digit MFA for rescuer role', () => {
      Rbac.switchRole('rescuer');
      const session = Rbac.getSession();
      expect(session.role).toBe('rescuer');

      // Valid 6-digit code
      const verified = Rbac.verifyMfa('654321');
      expect(verified).toBe(true);
      expect(Rbac.getSession().isMfaVerified).toBe(true);

      // Invalid code rejection
      const invalidResult = Rbac.verifyMfa('abc');
      expect(invalidResult).toBe(false);
    });

    it('supports anonymous guest sign-in and seamless account linking', () => {
      Rbac.signInAnonymously('Таёжный гость');
      const anonSession = Rbac.getSession();
      expect(anonSession.isAnonymous).toBe(true);
      expect(anonSession.displayName).toBe('Таёжный гость');

      // Link to Google account
      Rbac.linkAccount('hiker@gmail.com', 'Михаил Таёжный');
      const linkedSession = Rbac.getSession();
      expect(linkedSession.isAnonymous).toBe(false);
      expect(linkedSession.email).toBe('hiker@gmail.com');
      expect(linkedSession.provider).toBe('google');
    });

    it('clears session securely on sign-out', () => {
      Rbac.signIn('guide@mountains.ru', 'Инструктор Сергей', 'guide');
      expect(Rbac.getSession().isAnonymous).toBe(false);

      Rbac.signOut();
      expect(Rbac.getSession().isAnonymous).toBe(true);
      expect(Rbac.getSession().role).toBe('hiker');
    });
  });

  describe('3. Resilient Transport Layer & Failover Pipeline', () => {
    it('detects primary internet connection and reports INTERNET channel', () => {
      ChaosSimulator.updateConfig({
        forceOfflineInternet: false,
        forceOfflineMesh: false,
      });

      const status = TransportManager.getStatus();
      expect(status.activeChannel).toBe('INTERNET');
      expect(status.isInternetOnline).toBe(true);
    });

    it('fails over to MESH_CORE when Internet drops', () => {
      ChaosSimulator.updateConfig({
        forceOfflineInternet: true,
        forceOfflineMesh: false,
      });

      const status = TransportManager.getStatus();
      expect(status.activeChannel).toBe('MESH_CORE');
      expect(status.isInternetOnline).toBe(false);
      expect(status.isMeshOnline).toBe(true);
      expect(status.meshSignalDbm).toBeDefined();
    });

    it('fails over to OFFLINE_QUEUE when both Internet and Mesh are down', async () => {
      ChaosSimulator.updateConfig({
        forceOfflineInternet: true,
        forceOfflineMesh: true,
      });

      const status = TransportManager.getStatus();
      expect(status.activeChannel).toBe('OFFLINE_QUEUE');

      const sendResult = await TransportManager.sendPacket({
        type: 'LOCATION_UPDATE',
        priority: 'NORMAL',
        timestamp: Date.now(),
        payload: { lat: 43.5, lon: 42.1 },
      });

      expect(sendResult.delivered).toBe(false);
      expect(sendResult.channel).toBe('OFFLINE_QUEUE');

      const updatedStatus = TransportManager.getStatus();
      expect(updatedStatus.queuedCount).toBeGreaterThan(0);
    });

    it('flushes offline queue when connection is restored', async () => {
      // Restore connection
      ChaosSimulator.updateConfig({
        forceOfflineInternet: false,
        forceOfflineMesh: false,
      });

      const flushedCount = await TransportManager.flushQueue();
      expect(flushedCount).toBeGreaterThanOrEqual(0);

      const status = TransportManager.getStatus();
      expect(status.queuedCount).toBe(0);
    });
  });

  describe('4. Chaos Simulator & Anomaly Injection', () => {
    it('drops packets when packetDropRate is 1.0 (100%)', () => {
      ChaosSimulator.updateConfig({ packetDropRate: 1.0 });
      expect(ChaosSimulator.shouldDropPacket()).toBe(true);
    });

    it('never drops packets when packetDropRate is 0.0 (0%)', () => {
      ChaosSimulator.updateConfig({ packetDropRate: 0.0 });
      expect(ChaosSimulator.shouldDropPacket()).toBe(false);
    });

    it('allows battery override simulation', () => {
      ChaosSimulator.updateConfig({ batteryOverride: 12 });
      expect(ChaosSimulator.getConfig().batteryOverride).toBe(12);

      ChaosSimulator.updateConfig({ batteryOverride: null });
      expect(ChaosSimulator.getConfig().batteryOverride).toBeNull();
    });
  });

  describe('5. Real-Time Audit Logger Stream', () => {
    it('logs structured events and notifies subscribers', () => {
      let notifiedCategory = '';

      const unsubscribe = AuditLogger.subscribe((entry) => {
        notifiedCategory = entry.category;
      });

      const entry = AuditLogger.log('OCC', 'Проверка версии маршрута №12 успешна');
      expect(entry.category).toBe('OCC');
      expect(notifiedCategory).toBe('OCC');

      const occEntries = AuditLogger.getEntries('OCC');
      expect(occEntries.length).toBeGreaterThan(0);
      expect(occEntries[0].message).toContain('Проверка версии');

      unsubscribe();
    });

    it('clears audit logs cleanly', () => {
      AuditLogger.log('TRANSPORT', 'Тестовый пакет отправлен');
      AuditLogger.clear();

      // Clear records an audit entry that it was cleared
      const entries = AuditLogger.getEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].category).toBe('AUTH');
      expect(entries[0].message).toContain('Журнал аудита очищен');
    });
  });
});
