/**
 * @fileoverview Phase 2 Security Layer Automated Verification Test Suite
 * Tests Ed25519 Signatures, AES-256-GCM AEAD, Anti-Replay, Privacy Filters,
 * and End-to-End Secure Packet Lifecycle.
 */

import { CryptoService } from '../crypto-service';
import { PrivacyFilter } from '../privacy-filter';
import { ReplayProtection } from '../replay-protection';
import { IdentityManager } from '../identity-manager';
import { SecurePacketService } from '../secure-packet-service';
import { LocationUpdate, SecurePacket } from '../../domain/types';
import { describe, it } from 'vitest';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    passedTests++;
    console.log(`✅ PASS: ${message}`);
  }
}

export async function runSecurityTestSuite() {
  console.log('====================================================');
  console.log('🛡️  PHASE 2 SECURITY LAYER AUTOMATED TEST SUITE');
  console.log('====================================================\n');

  // --- SUITE 1: Web Crypto Key Generation & Digital Signatures (Ed25519) ---
  console.log('--- Suite 1: Web Crypto Digital Signatures (Ed25519) ---');
  const keyPair = await CryptoService.generateEd25519KeyPair();
  assert(!!keyPair.publicKey && keyPair.publicKey.length > 20, 'Ed25519 public key generated in Base64');
  assert(!!keyPair.privateKey && keyPair.privateKey.length > 20, 'Ed25519 private key generated in Base64');

  const testMessage = 'GPS_PACKET:lat=43.3550,lon=42.4392,alt=2150,seq=104';
  const signature = await CryptoService.signData(testMessage, keyPair.privateKey);
  assert(!!signature && signature.length > 30, 'Data signed successfully with Ed25519 private key');

  const isValidSig = await CryptoService.verifySignature(testMessage, signature, keyPair.publicKey);
  assert(isValidSig === true, 'Valid Ed25519 signature successfully verified');

  const isTamperedSig = await CryptoService.verifySignature(
    testMessage + '_TAMPERED',
    signature,
    keyPair.publicKey
  );
  assert(isTamperedSig === false, 'Tampered payload rejected by Ed25519 verification');

  const anotherKeyPair = await CryptoService.generateEd25519KeyPair();
  const isWrongKeySig = await CryptoService.verifySignature(
    testMessage,
    signature,
    anotherKeyPair.publicKey
  );
  assert(isWrongKeySig === false, 'Signature with wrong public key correctly rejected');

  // --- SUITE 2: Group Encryption (AES-256-GCM AEAD) ---
  console.log('\n--- Suite 2: Symmetric Encryption (AES-256-GCM AEAD) ---');
  const groupKey = await CryptoService.generateGroupKey();
  assert(!!groupKey && groupKey.length > 30, 'AES-256-GCM group key generated');

  const sensitivePayload = JSON.stringify({
    medicalInfo: 'Allergy: Penicillin',
    hikerId: 'user-dan-1',
    sosDetails: 'Injured ankle near pass',
  });

  const encrypted = await CryptoService.encryptAesGcm(sensitivePayload, groupKey);
  assert(!!encrypted.ciphertext && encrypted.ciphertext !== sensitivePayload, 'Payload encrypted to ciphertext');
  assert(!!encrypted.iv && encrypted.iv.length > 10, '12-byte IV generated and encoded');
  assert(!!encrypted.authTag && encrypted.authTag.length > 10, '16-byte AEAD auth tag generated');

  const decrypted = await CryptoService.decryptAesGcm(
    encrypted.ciphertext,
    encrypted.iv,
    encrypted.authTag,
    groupKey
  );
  assert(decrypted === sensitivePayload, 'AES-256-GCM decrypted plaintext matches original sensitive payload');

  // Test decryption with corrupted auth tag
  let corruptedTagFailed = false;
  try {
    const corruptedTag = Buffer.from(encrypted.authTag, 'base64');
    corruptedTag[0] = corruptedTag[0] ^ 0xff; // flip bit
    await CryptoService.decryptAesGcm(
      encrypted.ciphertext,
      encrypted.iv,
      corruptedTag.toString('base64'),
      groupKey
    );
  } catch {
    corruptedTagFailed = true;
  }
  assert(corruptedTagFailed, 'Corrupted authentication tag rejected by AES-GCM AEAD');

  // --- SUITE 3: Privacy Filter (NORMAL, REDUCED, STEALTH) ---
  console.log('\n--- Suite 3: Geodata Privacy Filter ---');
  const rawLocation: LocationUpdate = {
    hikerId: 'hiker-77',
    timestamp: Date.now(),
    latitude: 43.3551234,
    longitude: 42.4398765,
    altitude: 2150.5,
    accuracy: 4.8,
    speed: 1.4,
    heading: 180,
    batteryLevel: 88,
    privacyMode: 'NORMAL',
  };

  const normalFiltered = PrivacyFilter.apply(rawLocation, 'NORMAL');
  assert(normalFiltered !== null, 'NORMAL mode allows transmission');
  assert(normalFiltered?.latitude === 43.3551234, 'NORMAL mode preserves raw high-precision latitude');
  assert(normalFiltered?.altitude === 2150.5, 'NORMAL mode preserves exact altitude');

  const reducedFiltered = PrivacyFilter.apply(rawLocation, 'REDUCED');
  assert(reducedFiltered !== null, 'REDUCED mode allows transmission');
  assert(reducedFiltered?.latitude !== rawLocation.latitude, 'REDUCED mode obfuscates exact latitude to grid');
  assert(reducedFiltered?.altitude === undefined, 'REDUCED mode strips altitude to prevent elevation fingerprinting');
  assert(reducedFiltered?.speed === undefined, 'REDUCED mode strips speed metrics');
  assert((reducedFiltered?.accuracy ?? 0) >= 200, 'REDUCED mode sets minimum accuracy threshold to 200m');

  const stealthFiltered = PrivacyFilter.apply(rawLocation, 'STEALTH');
  assert(stealthFiltered === null, 'STEALTH mode suppresses transmission completely (returns null)');
  assert(PrivacyFilter.isBroadcastAllowed('STEALTH') === false, 'STEALTH mode broadcast flag is false');
  assert(PrivacyFilter.isBroadcastAllowed('NORMAL') === true, 'NORMAL mode broadcast flag is true');

  // --- SUITE 4: Anti-Replay & Freshness Engine ---
  console.log('\n--- Suite 4: Anti-Replay Protection & Freshness Window ---');
  const replayEngine = new ReplayProtection();
  const dummyPacket: SecurePacket = {
    version: 1,
    packetId: '11111111-1111-4111-8111-111111111111',
    senderPublicKey: keyPair.publicKey,
    recipientOrGroupId: 'group-north-pass',
    timestamp: Date.now(),
    sequenceNumber: 1,
    privacyMode: 'NORMAL',
    payloadCiphertext: 'mock_ct',
    iv: 'mock_iv_base64==',
    authTag: 'mock_tag_base64=',
    signature: 'mock_sig',
  };

  const check1 = replayEngine.validatePacket(dummyPacket);
  assert(check1.valid === true, 'Initial fresh packet passes anti-replay check');
  replayEngine.recordPacket(dummyPacket);

  const checkReplay = replayEngine.validatePacket(dummyPacket);
  assert(checkReplay.valid === false && Boolean(checkReplay.reason?.includes('Replay detected')), 'Replayed packetId is rejected');

  // Sequence regression test
  const regressedSeqPacket: SecurePacket = {
    ...dummyPacket,
    packetId: '22222222-2222-4222-8222-222222222222',
    sequenceNumber: 1, // Same or lower than recorded sequence 1
  };
  const checkRegression = replayEngine.validatePacket(regressedSeqPacket);
  assert(checkRegression.valid === false && Boolean(checkRegression.reason?.includes('Sequence regression')), 'Sequence number regression rejected');

  // Freshness expiration test (>10 min)
  const expiredPacket: SecurePacket = {
    ...dummyPacket,
    packetId: '33333333-3333-4333-8333-333333333333',
    timestamp: Date.now() - 15 * 60 * 1000, // 15 mins ago
    sequenceNumber: 2,
  };
  const checkExpired = replayEngine.validatePacket(expiredPacket);
  assert(checkExpired.valid === false && Boolean(checkExpired.reason?.includes('expired')), 'Packet older than 10 minutes rejected');

  // Clock skew test (>1 min in future)
  const futurePacket: SecurePacket = {
    ...dummyPacket,
    packetId: '44444444-4444-4444-8444-444444444444',
    timestamp: Date.now() + 5 * 60 * 1000, // 5 mins in future
    sequenceNumber: 2,
  };
  const checkFuture = replayEngine.validatePacket(futurePacket);
  assert(checkFuture.valid === false && Boolean(checkFuture.reason?.includes('future')), 'Packet from the future rejected');

  // --- SUITE 5: Identity Manager & Fingerprinting ---
  console.log('\n--- Suite 5: Identity Manager & Fingerprinting ---');
  const identity = await IdentityManager.createNewIdentity('Анна');
  assert(identity.displayName === 'Анна', 'Identity created with display name');
  assert(!!identity.userId && !!identity.publicKey && !!identity.privateKey, 'Identity contains valid credentials');

  const fingerprint = await IdentityManager.getPublicKeyFingerprint(identity.publicKey);
  assert(fingerprint.length === 9 && fingerprint.includes(':'), 'Calculated formatted public key fingerprint (e.g. A1B2:C3D4)');

  // --- SUITE 6: End-to-End Secure Packet Lifecycle ---
  console.log('\n--- Suite 6: Full Secure Packet Pipeline (Build -> Verify -> Decrypt) ---');
  const sharedGroupKey = await CryptoService.generateGroupKey();
  const aliceKeyPair = await CryptoService.generateEd25519KeyPair();

  const originalLocation: LocationUpdate = {
    hikerId: 'alice-01',
    timestamp: Date.now(),
    latitude: 43.355,
    longitude: 42.439,
    altitude: 2200,
    accuracy: 5,
    privacyMode: 'NORMAL',
  };

  const securePacket = await SecurePacketService.buildSecurePacket({
    payload: originalLocation,
    senderPublicKey: aliceKeyPair.publicKey,
    senderPrivateKey: aliceKeyPair.privateKey,
    recipientOrGroupId: 'group-elbrus-2026',
    groupKeyBase64: sharedGroupKey,
    sequenceNumber: 101,
    privacyMode: 'NORMAL',
  });

  assert(securePacket !== null, 'Secure packet successfully built and signed');
  assert(securePacket?.sequenceNumber === 101, 'Packet preserves sequence number');
  assert(!!securePacket?.signature, 'Packet contains cryptographic signature');

  const verification = await SecurePacketService.verifyAndDecryptPacket<LocationUpdate>(
    securePacket!,
    sharedGroupKey
  );

  assert(verification.success === true, 'Secure packet verified and decrypted end-to-end');
  assert(verification.data?.latitude === originalLocation.latitude, 'Decrypted latitude matches original');
  assert(verification.data?.hikerId === 'alice-01', 'Decrypted hikerId matches original');

  // Test packet with tampered ciphertext in pipeline
  const tamperedPacket: SecurePacket = {
    ...securePacket!,
    payloadCiphertext: Buffer.from('corrupted_payload').toString('base64'),
  };
  const tamperedVerification = await SecurePacketService.verifyAndDecryptPacket<LocationUpdate>(
    tamperedPacket,
    sharedGroupKey
  );
  assert(tamperedVerification.success === false, 'Tampered ciphertext rejected during end-to-end verification');

  // Test stealth mode packet building
  const stealthPacket = await SecurePacketService.buildSecurePacket({
    payload: originalLocation,
    senderPublicKey: aliceKeyPair.publicKey,
    senderPrivateKey: aliceKeyPair.privateKey,
    recipientOrGroupId: 'group-elbrus-2026',
    groupKeyBase64: sharedGroupKey,
    sequenceNumber: 102,
    privacyMode: 'STEALTH',
  });
  assert(stealthPacket === null, 'Building packet in STEALTH mode correctly returns null (no broadcast)');

  console.log('\n====================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} SECURITY TESTS PASSED SUCCESSFULLY!`);
  console.log('====================================================\n');
}

// Auto-run if executed directly
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('security-phase2.test')) {
  runSecurityTestSuite().catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  });
}

describe('Phase 2 Security Layer Automated Verification', () => {
  it('executes the full cryptographic verification suite', async () => {
    await runSecurityTestSuite();
  });
});

