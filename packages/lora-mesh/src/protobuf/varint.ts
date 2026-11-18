/**
 * Pure TypeScript Varint & ZigZag encoding/decoding.
 * Conforms to Google Protocol Buffers wire format standard.
 */

export function encodeVarint(val: number | bigint): Uint8Array {
  let n = BigInt(val);
  if (n < 0n) {
    // 64-bit two's complement for negative numbers in protobuf varint
    n = BigInt.asUintN(64, n);
  }

  const bytes: number[] = [];
  while (n >= 0x80n) {
    bytes.push(Number((n & 0x7fn) | 0x80n));
    n >>= 7n;
  }
  bytes.push(Number(n & 0x7fn));
  return new Uint8Array(bytes);
}

export function decodeVarint(buffer: Uint8Array, offset = 0): { value: number; bytesRead: number } {
  let result = 0n;
  let shift = 0n;
  let bytesRead = 0;

  while (offset + bytesRead < buffer.length) {
    const byte = buffer[offset + bytesRead];
    bytesRead++;
    result |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      break;
    }
    shift += 7n;
    if (shift >= 64n) {
      throw new Error('Varint overflow: exceeds 64 bits');
    }
  }

  if (bytesRead === 0 || (buffer[offset + bytesRead - 1] & 0x80) !== 0) {
    throw new Error('Truncated varint in buffer');
  }

  // Convert to signed 32-bit if it fits 64-bit negative representation
  if (result > 0x7fffffffffffffffn) {
    // Negative 64-bit integer
    const signedVal = Number(BigInt.asIntN(64, result));
    return { value: signedVal, bytesRead };
  }

  return { value: Number(result), bytesRead };
}

export function decodeVarintBigInt(buffer: Uint8Array, offset = 0): { value: bigint; bytesRead: number } {
  let result = 0n;
  let shift = 0n;
  let bytesRead = 0;

  while (offset + bytesRead < buffer.length) {
    const byte = buffer[offset + bytesRead];
    bytesRead++;
    result |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      break;
    }
    shift += 7n;
    if (shift >= 64n) {
      throw new Error('Varint overflow: exceeds 64 bits');
    }
  }

  if (bytesRead === 0 || (buffer[offset + bytesRead - 1] & 0x80) !== 0) {
    throw new Error('Truncated varint in buffer');
  }

  return { value: result, bytesRead };
}

export function encodeZigZag32(n: number): number {
  return ((n << 1) ^ (n >> 31)) >>> 0;
}

export function decodeZigZag32(n: number): number {
  return (n >>> 1) ^ -(n & 1);
}

export function encodeZigZag64(n: bigint): bigint {
  return (n << 1n) ^ (n >> 63n);
}

export function decodeZigZag64(n: bigint): bigint {
  return (n >> 1n) ^ (-(n & 1n));
}
