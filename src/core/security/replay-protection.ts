/**
 * @fileoverview Anti-Replay and Freshness Validation Engine
 * Conforms to Threat Model (docs/04-security/threat-model.md - T-004) and ADR-002
 */

import { SecurePacket } from '../domain/types';

export class ReplayProtection {
  // 10 minutes freshness window (600,000 ms)
  private static readonly MAX_AGE_MS = 10 * 60 * 1000;
  // 1 minute allowed future clock skew (60,000 ms)
  private static readonly MAX_FUTURE_SKEW_MS = 60 * 1000;
  // Maximum number of cached packet IDs to prevent memory leaks
  private static readonly MAX_SEEN_PACKETS = 2000;

  private seenPacketIds: Set<string> = new Set();
  private senderSequences: Map<string, number> = new Map();

  /**
   * Validates if a packet meets freshness, monotonic sequence, and uniqueness criteria
   */
  validatePacket(packet: SecurePacket, now: number = Date.now()): { valid: boolean; reason?: string } {
    const age = now - packet.timestamp;

    // Check packet freshness (older than 10 minutes)
    if (age > ReplayProtection.MAX_AGE_MS) {
      return {
        valid: false,
        reason: `Packet expired: age ${Math.round(age / 1000)}s exceeds threshold (${ReplayProtection.MAX_AGE_MS / 1000}s)`,
      };
    }

    // Check future clock skew
    if (age < -ReplayProtection.MAX_FUTURE_SKEW_MS) {
      return {
        valid: false,
        reason: `Packet timestamp is in future by ${Math.round(-age / 1000)}s (clock skew violation)`,
      };
    }

    // Check uniqueness / deduplication
    if (this.seenPacketIds.has(packet.packetId)) {
      return {
        valid: false,
        reason: `Replay detected: packetId ${packet.packetId} was already processed`,
      };
    }

    // Check sequence number monotonicity per sender
    const lastSeq = this.senderSequences.get(packet.senderPublicKey);
    if (lastSeq !== undefined && packet.sequenceNumber <= lastSeq) {
      return {
        valid: false,
        reason: `Sequence regression: got seq ${packet.sequenceNumber}, expected > ${lastSeq}`,
      };
    }

    return { valid: true };
  }

  /**
   * Records a validated packet in the anti-replay tracker
   */
  recordPacket(packet: SecurePacket): void {
    if (this.seenPacketIds.size >= ReplayProtection.MAX_SEEN_PACKETS) {
      // Clear oldest half of seen IDs when limit is reached
      const idsArray = Array.from(this.seenPacketIds);
      this.seenPacketIds = new Set(idsArray.slice(Math.floor(idsArray.length / 2)));
    }

    this.seenPacketIds.add(packet.packetId);
    this.senderSequences.set(packet.senderPublicKey, packet.sequenceNumber);
  }

  /**
   * Resets internal tracker state (useful for tests or new group session)
   */
  reset(): void {
    this.seenPacketIds.clear();
    this.senderSequences.clear();
  }
}
