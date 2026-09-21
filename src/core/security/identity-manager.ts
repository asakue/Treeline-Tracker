/**
 * @fileoverview Decentralized User Identity & Key Management
 * Conforms to ADR-002, ADR-003 and docs/04-security/identity.md
 */

import { UserIdentity } from '../domain/types';
import { CryptoService } from './crypto-service';

const STORAGE_KEY = 'treeline_local_identity';

export class IdentityManager {
  /**
   * Retrieves the existing local user identity or generates a new one
   */
  static async getOrCreateIdentity(defaultDisplayName: string = 'Турист'): Promise<UserIdentity> {
    if (typeof window === 'undefined') {
      const pair = await CryptoService.generateEd25519KeyPair();
      return {
        userId: 'node-temp-user',
        publicKey: pair.publicKey,
        privateKey: pair.privateKey,
        displayName: defaultDisplayName,
        createdAt: Date.now(),
      };
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserIdentity;
        if (parsed.userId && parsed.publicKey && parsed.privateKey) {
          return parsed;
        }
      }
    } catch {
      // If parsing fails, generate a new identity
    }

    return await this.createNewIdentity(defaultDisplayName);
  }

  /**
   * Generates a brand new Ed25519 keypair and persists it locally
   */
  static async createNewIdentity(displayName: string): Promise<UserIdentity> {
    const keyPair = await CryptoService.generateEd25519KeyPair();
    const userId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `usr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const identity: UserIdentity = {
      userId,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      displayName,
      createdAt: Date.now(),
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
      } catch {
        // Storage quota exceeded or disabled
      }
    }

    return identity;
  }

  /**
   * Rotates the user's keypair while keeping the display name
   */
  static async rotateIdentity(displayName?: string): Promise<UserIdentity> {
    const current = await this.getOrCreateIdentity();
    return await this.createNewIdentity(displayName || current.displayName);
  }

  /**
   * Computes a friendly 8-character verification fingerprint for the public key
   */
  static async getPublicKeyFingerprint(publicKeyBase64: string): Promise<string> {
    const hash = await CryptoService.sha256Hex(publicKeyBase64);
    return `${hash.slice(0, 4)}:${hash.slice(4, 8)}`.toUpperCase();
  }
}

export const getOrCreateLocalIdentity = (name?: string) =>
  IdentityManager.getOrCreateIdentity(name);

export const rotateLocalIdentity = (name?: string) =>
  IdentityManager.rotateIdentity(name);
