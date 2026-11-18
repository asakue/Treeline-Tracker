/**
 * @fileoverview Unit Tests for Password Hashing and Verification
 */

import { describe, it, expect } from 'vitest';
import { ScryptPasswordHasher, HybridPasswordService } from '../../src/auth/password.js';

describe('Password Hashing Unit Tests', () => {
  describe('ScryptPasswordHasher', () => {
    const scrypt = new ScryptPasswordHasher();

    it('hashes passwords in modular crypt format', async () => {
      const password = 'StrongMountainPassword2026!';
      const hash = await scrypt.hash(password);

      expect(hash).toBeDefined();
      expect(hash.startsWith('$scrypt$')).toBe(true);
      expect(hash.split('$').length).toBe(5);
    });

    it('verifies correct passwords and rejects incorrect passwords', async () => {
      const password = 'CorrectPassword123#';
      const hash = await scrypt.hash(password);

      const isValid = await scrypt.verify(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await scrypt.verify('WrongPassword456!', hash);
      expect(isInvalid).toBe(false);
    });

    it('safely handles malformed and tampered hash strings without crashing', async () => {
      const isInvalid1 = await scrypt.verify('password', 'not-a-valid-hash');
      expect(isInvalid1).toBe(false);

      const isInvalid2 = await scrypt.verify('password', '$scrypt$invalid$format');
      expect(isInvalid2).toBe(false);

      const isInvalid3 = await scrypt.verify('password', '$argon2id$v=19$m=65536$abc$def');
      expect(isInvalid3).toBe(false);
    });
  });

  describe('HybridPasswordService', () => {
    const service = new HybridPasswordService();

    it('successfully hashes and verifies passwords using available engine', async () => {
      const password = 'HybridTestPassword!999';
      const hash = await service.hash(password);

      expect(hash).toBeDefined();
      const verified = await service.verify(password, hash);
      expect(verified).toBe(true);

      const rejected = await service.verify('WrongPassword', hash);
      expect(rejected).toBe(false);
    });

    it('verifies scrypt hashes even when hybrid service is running', async () => {
      const scrypt = new ScryptPasswordHasher();
      const password = 'ScryptUnderHybrid2026!';
      const scryptHash = await scrypt.hash(password);

      const verified = await service.verify(password, scryptHash);
      expect(verified).toBe(true);
    });
  });
});
