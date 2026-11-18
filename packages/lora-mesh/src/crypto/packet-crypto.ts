/**
 * AES-CTR Packet Encryption & Decryption Utilities for Meshtastic Payloads.
 * Nonce layout: 8 bytes packetId (LE) + 4 bytes fromNode (LE) + 4 bytes counter.
 */

export const DEFAULT_MESHTASTIC_KEY = new Uint8Array([
  0xd4, 0xf1, 0xbb, 0x3a, 0x20, 0x29, 0x07, 0x59,
  0xf0, 0xbc, 0xff, 0xab, 0xcf, 0x4e, 0x69, 0x01
]);

export function buildNonce(packetId: number, fromNode: number): Uint8Array {
  const nonce = new Uint8Array(16);
  const view = new DataView(nonce.buffer, nonce.byteOffset, 16);

  // Bytes 0-7: 64-bit packet ID little-endian
  view.setBigUint64(0, BigInt(packetId), true);

  // Bytes 8-11: 32-bit fromNode little-endian
  view.setUint32(8, fromNode >>> 0, true);

  // Bytes 12-15: Counter starts at 0
  view.setUint32(12, 0, false);

  return nonce;
}

export async function encryptPayload(
  plaintext: Uint8Array,
  key: Uint8Array = DEFAULT_MESHTASTIC_KEY,
  packetId: number,
  fromNode: number
): Promise<Uint8Array> {
  const nonce = buildNonce(packetId, fromNode);
  const cryptoObj = globalThis.crypto;

  const cryptoKey = await cryptoObj.subtle.importKey(
    'raw',
    key as unknown as BufferSource,
    { name: 'AES-CTR' },
    false,
    ['encrypt']
  );

  const ciphertextBuffer = await cryptoObj.subtle.encrypt(
    {
      name: 'AES-CTR',
      counter: nonce as unknown as BufferSource,
      length: 64
    },
    cryptoKey,
    plaintext as unknown as BufferSource
  );

  return new Uint8Array(ciphertextBuffer);
}

export async function decryptPayload(
  ciphertext: Uint8Array,
  key: Uint8Array = DEFAULT_MESHTASTIC_KEY,
  packetId: number,
  fromNode: number
): Promise<Uint8Array> {
  const nonce = buildNonce(packetId, fromNode);
  const cryptoObj = globalThis.crypto;

  const cryptoKey = await cryptoObj.subtle.importKey(
    'raw',
    key as unknown as BufferSource,
    { name: 'AES-CTR' },
    false,
    ['decrypt']
  );

  const decryptedBuffer = await cryptoObj.subtle.decrypt(
    {
      name: 'AES-CTR',
      counter: nonce as unknown as BufferSource,
      length: 64
    },
    cryptoKey,
    ciphertext as unknown as BufferSource
  );

  return new Uint8Array(decryptedBuffer);
}
