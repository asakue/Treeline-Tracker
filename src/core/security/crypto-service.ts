/**
 * @fileoverview Web Crypto Native Security Primitives
 * Implementation conforming to ADR-002, ADR-003 and docs/04-security/encryption.md
 * Uses standard Web Crypto API (Ed25519 for digital signatures, AES-256-GCM for AEAD, SHA-256)
 */

export interface EncryptedPayload {
  ciphertext: string; // Base64
  iv: string;         // Base64
  authTag: string;    // Base64
}

export interface KeyPairBase64 {
  publicKey: string;  // Base64
  privateKey: string; // Base64
}

// Helper: Uint8Array <-> Base64
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

export function base64ToBuffer(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

export class CryptoService {
  /**
   * Generates an Ed25519 keypair for packet signing and verification
   */
  static async generateEd25519KeyPair(): Promise<KeyPairBase64> {
    const keyPair = (await crypto.subtle.generateKey(
      {
        name: 'Ed25519',
      },
      true,
      ['sign', 'verify']
    )) as CryptoKeyPair;

    const rawPublic = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const pkcs8Private = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    return {
      publicKey: bufferToBase64(rawPublic),
      privateKey: bufferToBase64(pkcs8Private),
    };
  }

  /**
   * Signs arbitrary string or binary data using an Ed25519 private key
   */
  static async signData(data: string | Uint8Array, privateKeyBase64: string): Promise<string> {
    const privateKeyBuffer = base64ToBuffer(privateKeyBase64);
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyBuffer as BufferSource,
      {
        name: 'Ed25519',
      },
      false,
      ['sign']
    );

    const encoder = new TextEncoder();
    const payloadBytes = typeof data === 'string' ? encoder.encode(data) : data;

    const signature = await crypto.subtle.sign(
      {
        name: 'Ed25519',
      },
      privateKey,
      payloadBytes as BufferSource
    );

    return bufferToBase64(signature);
  }

  /**
   * Verifies an Ed25519 digital signature
   */
  static async verifySignature(
    data: string | Uint8Array,
    signatureBase64: string,
    publicKeyBase64: string
  ): Promise<boolean> {
    try {
      const publicKeyBuffer = base64ToBuffer(publicKeyBase64);
      const signatureBuffer = base64ToBuffer(signatureBase64);

      const publicKey = await crypto.subtle.importKey(
        'raw',
        publicKeyBuffer as BufferSource,
        {
          name: 'Ed25519',
        },
        false,
        ['verify']
      );

      const encoder = new TextEncoder();
      const payloadBytes = typeof data === 'string' ? encoder.encode(data) : data;

      return await crypto.subtle.verify(
        {
          name: 'Ed25519',
        },
        publicKey,
        signatureBuffer as BufferSource,
        payloadBytes as BufferSource
      );
    } catch {
      return false;
    }
  }

  /**
   * Generates a 256-bit symmetric key for AES-GCM group encryption
   */
  static async generateGroupKey(): Promise<string> {
    const key = await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );

    const rawKey = await crypto.subtle.exportKey('raw', key);
    return bufferToBase64(rawKey);
  }

  /**
   * Encrypts plaintext with AES-256-GCM AEAD
   * Produces separate ciphertext and authentication tag
   */
  static async encryptAesGcm(plainText: string, keyBase64: string): Promise<EncryptedPayload> {
    const keyBuffer = base64ToBuffer(keyBase64);
    const key = await crypto.subtle.importKey(
      'raw',
      keyBuffer as BufferSource,
      {
        name: 'AES-GCM',
      },
      false,
      ['encrypt']
    );

    // 12-byte IV for standard AES-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(plainText);

    // Subtly produces ciphertext + 16 byte auth tag concatenated at the end
    const encryptedWithTag = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128,
      },
      key,
      encodedData as BufferSource
    );

    const encryptedBytes = new Uint8Array(encryptedWithTag);
    const tagLengthBytes = 16;
    const ciphertextBytes = encryptedBytes.slice(0, encryptedBytes.length - tagLengthBytes);
    const authTagBytes = encryptedBytes.slice(encryptedBytes.length - tagLengthBytes);

    return {
      ciphertext: bufferToBase64(ciphertextBytes),
      iv: bufferToBase64(iv),
      authTag: bufferToBase64(authTagBytes),
    };
  }

  /**
   * Decrypts AES-256-GCM ciphertext with integrity verification
   */
  static async decryptAesGcm(
    ciphertextBase64: string,
    ivBase64: string,
    authTagBase64: string,
    keyBase64: string
  ): Promise<string> {
    const keyBuffer = base64ToBuffer(keyBase64);
    const key = await crypto.subtle.importKey(
      'raw',
      keyBuffer as BufferSource,
      {
        name: 'AES-GCM',
      },
      false,
      ['decrypt']
    );

    const iv = base64ToBuffer(ivBase64);
    const ciphertext = base64ToBuffer(ciphertextBase64);
    const authTag = base64ToBuffer(authTagBase64);

    // Recombine ciphertext and 16-byte authentication tag
    const combined = new Uint8Array(ciphertext.length + authTag.length);
    combined.set(ciphertext, 0);
    combined.set(authTag, ciphertext.length);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
        tagLength: 128,
      },
      key,
      combined as BufferSource
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Computes SHA-256 hash formatted as lowercase hex string
   */
  static async sha256Hex(data: string | Uint8Array): Promise<string> {
    const encoder = new TextEncoder();
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
