/**
 * @fileoverview Complete End-to-End Secure Packet Pipeline
 * Conforms to ADR-002, ADR-003, ADR-004 and docs/04-security/encryption.md
 */

import { SecurePacket, PrivacyMode, LocationUpdate } from '../domain/types';
import { SecurePacketSchema } from '../domain/schemas';
import { CryptoService } from './crypto-service';
import { PrivacyFilter } from './privacy-filter';
import { ReplayProtection } from './replay-protection';

export interface PacketBuildParams<T> {
  payload: T;
  senderPublicKey: string;
  senderPrivateKey: string;
  recipientOrGroupId: string;
  groupKeyBase64: string;
  sequenceNumber: number;
  privacyMode?: PrivacyMode;
}

export interface VerificationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  packetId?: string;
}

export class SecurePacketService {
  private static replayProtection = new ReplayProtection();

  /**
   * Generates a deterministic canonical string of the packet for signing/verification
   */
  static getPacketSigningPayload(
    packet: Omit<SecurePacket, 'signature'>
  ): string {
    return [
      `v:${packet.version}`,
      `id:${packet.packetId}`,
      `sender:${packet.senderPublicKey}`,
      `target:${packet.recipientOrGroupId}`,
      `ts:${packet.timestamp}`,
      `seq:${packet.sequenceNumber}`,
      `pm:${packet.privacyMode}`,
      `iv:${packet.iv}`,
      `tag:${packet.authTag}`,
      `ct:${packet.payloadCiphertext}`,
    ].join('|');
  }

  /**
   * Builds, encrypts, and signs a SecurePacket
   */
  static async buildSecurePacket<T>(
    params: PacketBuildParams<T>
  ): Promise<SecurePacket | null> {
    const privacyMode = params.privacyMode || 'NORMAL';

    let processedPayload: T = params.payload;

    // Apply privacy filter if payload is a LocationUpdate
    if (
      params.payload &&
      typeof params.payload === 'object' &&
      'latitude' in params.payload &&
      'longitude' in params.payload
    ) {
      const filtered = PrivacyFilter.apply(
        params.payload as unknown as LocationUpdate,
        privacyMode
      );
      if (filtered === null) {
        // Stealth mode: transmission is suppressed
        return null;
      }
      processedPayload = filtered as unknown as T;
    }

    // Encrypt payload with AES-256-GCM
    const jsonString = JSON.stringify(processedPayload);
    const encrypted = await CryptoService.encryptAesGcm(
      jsonString,
      params.groupKeyBase64
    );

    const packetId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `00000000-0000-4000-8000-${Math.random().toString(16).substring(2, 14).padEnd(12, '0')}`;

    const unsignedPacket: Omit<SecurePacket, 'signature'> = {
      version: 1,
      packetId,
      senderPublicKey: params.senderPublicKey,
      recipientOrGroupId: params.recipientOrGroupId,
      timestamp: Date.now(),
      sequenceNumber: params.sequenceNumber,
      privacyMode,
      payloadCiphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
    };

    // Digitally sign the canonical payload with Ed25519
    const signingPayload = this.getPacketSigningPayload(unsignedPacket);
    const signature = await CryptoService.signData(
      signingPayload,
      params.senderPrivateKey
    );

    const securePacket: SecurePacket = {
      ...unsignedPacket,
      signature,
    };

    // Validate against Zod schema
    SecurePacketSchema.parse(securePacket);

    return securePacket;
  }

  /**
   * Verifies signature, checks anti-replay criteria, and decrypts the payload
   */
  static async verifyAndDecryptPacket<T>(
    packet: SecurePacket,
    groupKeyBase64: string,
    replayTracker: ReplayProtection = this.replayProtection
  ): Promise<VerificationResult<T>> {
    // 1. Zod Schema Validation
    const parseResult = SecurePacketSchema.safeParse(packet);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Schema validation failed: ${parseResult.error.message}`,
        packetId: packet.packetId,
      };
    }

    // 2. Anti-Replay & Freshness Check
    const replayCheck = replayTracker.validatePacket(packet);
    if (!replayCheck.valid) {
      return {
        success: false,
        error: replayCheck.reason,
        packetId: packet.packetId,
      };
    }

    // 3. Ed25519 Signature Verification
    const unsignedPacket: Omit<SecurePacket, 'signature'> = {
      version: packet.version,
      packetId: packet.packetId,
      senderPublicKey: packet.senderPublicKey,
      recipientOrGroupId: packet.recipientOrGroupId,
      timestamp: packet.timestamp,
      sequenceNumber: packet.sequenceNumber,
      privacyMode: packet.privacyMode,
      payloadCiphertext: packet.payloadCiphertext,
      iv: packet.iv,
      authTag: packet.authTag,
    };

    const signingPayload = this.getPacketSigningPayload(unsignedPacket);
    const isSignatureValid = await CryptoService.verifySignature(
      signingPayload,
      packet.signature,
      packet.senderPublicKey
    );

    if (!isSignatureValid) {
      return {
        success: false,
        error: 'Invalid digital signature: Ed25519 signature mismatch',
        packetId: packet.packetId,
      };
    }

    // 4. AES-256-GCM Decryption & AEAD Authenticity
    try {
      const decryptedJson = await CryptoService.decryptAesGcm(
        packet.payloadCiphertext,
        packet.iv,
        packet.authTag,
        groupKeyBase64
      );

      const parsedData = JSON.parse(decryptedJson) as T;

      // Record valid packet in replay tracker
      replayTracker.recordPacket(packet);

      return {
        success: true,
        data: parsedData,
        packetId: packet.packetId,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Decryption error';
      return {
        success: false,
        error: `AEAD decryption failed: ${errorMsg}`,
        packetId: packet.packetId,
      };
    }
  }

  /**
   * Access to default replay protection instance
   */
  static getReplayProtection(): ReplayProtection {
    return this.replayProtection;
  }
}
