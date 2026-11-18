/**
 * @fileoverview Password Hashing Service supporting Argon2id with automatic Scrypt fallback
 * Conforms to OWASP Password Storage Guidelines and Milestone 1 Architecture.
 */

import crypto from 'node:crypto';

export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
  needsRehash(hash: string): boolean;
}

/**
 * Scrypt-based password hasher using Node.js built-in crypto.
 * Zero external dependencies, guaranteed cross-platform compilation-free execution.
 */
export class ScryptPasswordHasher implements IPasswordHasher {
  // OWASP Recommended Scrypt parameters
  private readonly N = 16384;      // CPU/memory cost parameter (2^14)
  private readonly r = 8;          // Block size parameter
  private readonly p = 1;          // Parallelization parameter
  private readonly keyLength = 64; // Derived key length in bytes
  private readonly maxmem = 64 * 1024 * 1024; // 64 MB memory limit

  async hash(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(
        password,
        salt,
        this.keyLength,
        { N: this.N, r: this.r, p: this.p, maxmem: this.maxmem },
        (err, key) => (err ? reject(err) : resolve(key))
      );
    });

    // Standard Modular Crypt Format for Scrypt:
    // $scrypt$ln=<log2(N)>,r=<r>,p=<p>$<salt_hex>$<derived_key_hex>
    const ln = Math.log2(this.N);
    return `$scrypt$ln=${ln},r=${this.r},p=${this.p}$${salt}$${derivedKey.toString('hex')}`;
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    if (!storedHash.startsWith('$scrypt$')) {
      return false;
    }

    const parts = storedHash.split('$');
    // Format: ["", "scrypt", "ln=14,r=8,p=1", "<salt>", "<hash>"]
    if (parts.length !== 5) {
      return false;
    }

    const paramsStr = parts[2];
    const salt = parts[3];
    const originalHashHex = parts[4];

    const params: Record<string, number> = {};
    for (const item of paramsStr.split(',')) {
      const [k, v] = item.split('=');
      if (k && v) {
        params[k] = parseInt(v, 10);
      }
    }

    const N = Math.pow(2, params.ln || 14);
    const r = params.r || 8;
    const p = params.p || 1;

    try {
      const originalKeyBuf = Buffer.from(originalHashHex, 'hex');

      const derivedKey = await new Promise<Buffer>((resolve, reject) => {
        crypto.scrypt(
          password,
          salt,
          originalKeyBuf.length,
          { N, r, p, maxmem: this.maxmem },
          (err, key) => (err ? reject(err) : resolve(key))
        );
      });

      if (derivedKey.length !== originalKeyBuf.length) {
        return false;
      }

      // Constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(derivedKey, originalKeyBuf);
    } catch {
      return false;
    }
  }

  needsRehash(_hash: string): boolean {
    return false;
  }
}

/**
 * Argon2id password hasher utilizing 'argon2' native library.
 */
export class Argon2idPasswordHasher implements IPasswordHasher {
  private argon2Lib: any;

  constructor(argon2Lib: any) {
    this.argon2Lib = argon2Lib;
  }

  async hash(password: string): Promise<string> {
    return this.argon2Lib.hash(password, {
      type: this.argon2Lib.argon2id ?? 2,
      memoryCost: 65536, // 64 MB
      timeCost: 3,       // 3 iterations
      parallelism: 4,    // 4 threads
      hashLength: 32,
    });
  }

  async verify(password: string, hash: string): Promise<boolean> {
    try {
      return await this.argon2Lib.verify(hash, password);
    } catch {
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    try {
      return this.argon2Lib.needsRehash(hash, {
        memoryCost: 65536,
        timeCost: 3,
      });
    } catch {
      return false;
    }
  }
}

/**
 * Hybrid Password Service:
 * Prefers Argon2id if native module compiles and loads;
 * Gracefully and seamlessly falls back to Scrypt without downtime or errors.
 */
export class HybridPasswordService implements IPasswordHasher {
  private activeHasher: IPasswordHasher;
  private isArgon2Available = false;
  private scryptHasher = new ScryptPasswordHasher();
  private argon2Hasher: Argon2idPasswordHasher | null = null;
  private initPromise: Promise<void>;

  constructor() {
    this.activeHasher = this.scryptHasher;
    this.initPromise = this.initArgon2();
  }

  public async ready(): Promise<void> {
    await this.initPromise;
  }

  private async initArgon2(): Promise<void> {
    try {
      // Dynamic import to avoid crash if argon2 is not installed or failed compiling
      const argon2Module = await import('argon2');
      this.argon2Hasher = new Argon2idPasswordHasher(argon2Module);
      this.activeHasher = this.argon2Hasher;
      this.isArgon2Available = true;
    } catch {
      this.activeHasher = this.scryptHasher;
      this.isArgon2Available = false;
    }
  }

  async hash(password: string): Promise<string> {
    await this.ready();
    return this.activeHasher.hash(password);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    await this.ready();

    if (hash.startsWith('$argon2')) {
      if (this.isArgon2Available && this.argon2Hasher) {
        return this.argon2Hasher.verify(password, hash);
      }
      // If stored hash is argon2 but argon2 cannot be loaded in this process
      return false;
    }

    if (hash.startsWith('$scrypt$')) {
      return this.scryptHasher.verify(password, hash);
    }

    return false;
  }

  needsRehash(hash: string): boolean {
    if (hash.startsWith('$scrypt$') && this.isArgon2Available) {
      return true;
    }
    return this.activeHasher.needsRehash(hash);
  }
}

export const passwordService = new HybridPasswordService();
