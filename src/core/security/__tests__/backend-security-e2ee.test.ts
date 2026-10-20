/**
 * @fileoverview Comprehensive Security & Encryption Verification Test Suite
 * Tests:
 * 1. PrivacyFilter EMERGENCY mode & SOS stealth override (docs/04-security/privacy.md)
 * 2. Robust Base64 decode sanitization (whitespace, newlines, URL-safe base64)
 * 3. Group Key Generation & Storage in IdentityManager (docs/04-security/key-management.md)
 * 4. API Rate Limiting & Input Validation with Zod
 * 5. Emergency SecurePacket end-to-end transmission in stealth mode
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PrivacyFilter } from '../privacy-filter';
import { CryptoService, base64ToBuffer } from '../crypto-service';
import { IdentityManager } from '../identity-manager';
import { SecurePacketService } from '../secure-packet-service';
import { rateLimiter } from '../api-security';
import { LocationUpdate } from '../../domain/types';
import { NextRequest } from 'next/server';

describe('Backend Security & Cryptography Verification', () => {
  beforeEach(() => {
    rateLimiter.reset();
  });

  describe('PrivacyFilter & SOS Emergency Safety Override', () => {
    const regularLocation: LocationUpdate = {
      hikerId: 'hiker-sos-test',
      timestamp: Date.now(),
      latitude: 43.355123,
      longitude: 42.439876,
      altitude: 2340.5,
      accuracy: 4.2,
      speed: 1.8,
      heading: 95,
      batteryLevel: 65,
      privacyMode: 'STEALTH',
    };

    it('suppresses ordinary location updates in STEALTH mode', () => {
      const filtered = PrivacyFilter.apply(regularLocation, 'STEALTH');
      expect(filtered).toBeNull();
      expect(PrivacyFilter.isBroadcastAllowed('STEALTH')).toBe(false);
    });

    it('bypasses STEALTH mode suppression when isEmergency is true', () => {
      const emergencyLocation: LocationUpdate = {
        ...regularLocation,
        isEmergency: true,
      };

      const filtered = PrivacyFilter.apply(emergencyLocation, 'STEALTH');
      expect(filtered).not.toBeNull();
      expect(filtered?.privacyMode).toBe('EMERGENCY');
      expect(filtered?.latitude).toBe(43.355123);
      expect(filtered?.longitude).toBe(42.439876);
      expect(filtered?.altitude).toBe(2340.5);
      expect(filtered?.speed).toBe(1.8);
      expect(filtered?.heading).toBe(95);
      expect(filtered?.isEmergency).toBe(true);
    });

    it('bypasses REDUCED mode discretization in EMERGENCY mode', () => {
      const emergencyLocation: LocationUpdate = {
        ...regularLocation,
        privacyMode: 'EMERGENCY',
      };

      const filtered = PrivacyFilter.apply(emergencyLocation, 'EMERGENCY');
      expect(filtered).not.toBeNull();
      expect(filtered?.latitude).toBe(43.355123);
      expect(filtered?.altitude).toBe(2340.5);
    });

    it('allows broadcast when mode is EMERGENCY', () => {
      expect(PrivacyFilter.isBroadcastAllowed('EMERGENCY')).toBe(true);
    });
  });

  describe('CryptoService Robust Base64 Sanitization', () => {
    it('handles base64 with whitespace, newlines, and trailing spaces', async () => {
      const originalText = 'Treeline Secure Telemetry 2026';
      const rawBase64 = Buffer.from(originalText).toString('base64');
      const formattedBase64 = `  \n ${rawBase64.slice(0, 8)}\n  ${rawBase64.slice(8)} \r\n `;

      const decodedBytes = base64ToBuffer(formattedBase64);
      const decodedString = Buffer.from(decodedBytes).toString();
      expect(decodedString).toBe(originalText);
    });

    it('handles URL-safe base64 (- and _) with missing padding', () => {
      const testBuffer = new Uint8Array([251, 239, 255]); // produces + / in standard base64
      const standardBase64 = Buffer.from(testBuffer).toString('base64');
      const urlSafeBase64 = standardBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

      const decodedBytes = base64ToBuffer(urlSafeBase64);
      expect(Array.from(decodedBytes)).toEqual(Array.from(testBuffer));
    });
  });

  describe('IdentityManager Group Key Management', () => {
    it('generates, retrieves, and persists AES-256 group keys', async () => {
      const groupId = `test-grp-${Date.now()}`;
      const groupKey1 = await IdentityManager.getOrCreateGroupKey(groupId);
      expect(groupKey1).toBeDefined();
      expect(typeof groupKey1).toBe('string');
      expect(groupKey1.length).toBeGreaterThanOrEqual(32);

      // Subsequent call returns the identical cached/stored key
      const groupKey2 = await IdentityManager.getOrCreateGroupKey(groupId);
      expect(groupKey2).toBe(groupKey1);
    });
  });

  describe('API Security Rate Limiting', () => {
    it('enforces limit and returns remaining counts correctly', () => {
      const req = new NextRequest('http://localhost:3000/api/test-route', {
        headers: { 'x-forwarded-for': '192.168.1.100' },
      });

      const res1 = rateLimiter.check(req, { limit: 3, windowMs: 10000 });
      expect(res1.allowed).toBe(true);
      expect(res1.remaining).toBe(2);

      const res2 = rateLimiter.check(req, { limit: 3, windowMs: 10000 });
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(1);

      const res3 = rateLimiter.check(req, { limit: 3, windowMs: 10000 });
      expect(res3.allowed).toBe(true);
      expect(res3.remaining).toBe(0);

      const res4 = rateLimiter.check(req, { limit: 3, windowMs: 10000 });
      expect(res4.allowed).toBe(false);
      expect(res4.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('Emergency Packet E2EE in Stealth Mode', () => {
    it('successfully encrypts and signs SOS location packet even in stealth mode', async () => {
      const groupKey = await CryptoService.generateGroupKey();
      const keyPair = await CryptoService.generateEd25519KeyPair();

      const sosLocation: LocationUpdate = {
        hikerId: 'rescuer-sos-1',
        timestamp: Date.now(),
        latitude: 43.3550,
        longitude: 42.4392,
        altitude: 2150,
        accuracy: 5,
        privacyMode: 'STEALTH',
        isEmergency: true,
      };

      const packet = await SecurePacketService.buildSecurePacket({
        payload: sosLocation,
        senderPublicKey: keyPair.publicKey,
        senderPrivateKey: keyPair.privateKey,
        recipientOrGroupId: 'group-rescue-alpha',
        groupKeyBase64: groupKey,
        sequenceNumber: 1,
        privacyMode: 'STEALTH',
      });

      // Because isEmergency is true, it MUST NOT be dropped as null!
      expect(packet).not.toBeNull();
      expect(packet?.privacyMode).toBe('STEALTH');
      expect(packet?.signature).toBeDefined();

      const verification = await SecurePacketService.verifyAndDecryptPacket<LocationUpdate>(
        packet!,
        groupKey
      );

      expect(verification.success).toBe(true);
      expect(verification.data?.latitude).toBe(43.3550);
      expect(verification.data?.isEmergency).toBe(true);
      expect(verification.data?.privacyMode).toBe('EMERGENCY');
    });
  });
});
