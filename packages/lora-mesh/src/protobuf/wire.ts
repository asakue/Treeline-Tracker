/**
 * WireReader and WireWriter for binary Protobuf encoding/decoding.
 * Pure TypeScript, zero external dependencies.
 */

import { encodeVarint, decodeVarint, decodeVarintBigInt } from './varint';

export enum WireType {
  VARINT = 0,
  FIXED64 = 1,
  LENGTH_DELIMITED = 2,
  START_GROUP = 3,
  END_GROUP = 4,
  FIXED32 = 5
}

export class WireWriter {
  private chunks: Uint8Array[] = [];
  private totalLength = 0;

  private append(chunk: Uint8Array): void {
    this.chunks.push(chunk);
    this.totalLength += chunk.length;
  }

  public writeTag(fieldNumber: number, wireType: WireType): void {
    const tag = ((fieldNumber << 3) | wireType) >>> 0;
    this.append(encodeVarint(tag));
  }

  public writeVarint(fieldNumber: number, value: number | bigint | boolean): void {
    if (typeof value === 'boolean') {
      value = value ? 1 : 0;
    }
    this.writeTag(fieldNumber, WireType.VARINT);
    this.append(encodeVarint(value));
  }

  public writeFixed32(fieldNumber: number, value: number): void {
    this.writeTag(fieldNumber, WireType.FIXED32);
    const buf = new Uint8Array(4);
    const view = new DataView(buf.buffer, buf.byteOffset, 4);
    view.setUint32(0, value >>> 0, true);
    this.append(buf);
  }

  public writeSFixed32(fieldNumber: number, value: number): void {
    this.writeTag(fieldNumber, WireType.FIXED32);
    const buf = new Uint8Array(4);
    const view = new DataView(buf.buffer, buf.byteOffset, 4);
    view.setInt32(0, value | 0, true);
    this.append(buf);
  }

  public writeFloat(fieldNumber: number, value: number): void {
    this.writeTag(fieldNumber, WireType.FIXED32);
    const buf = new Uint8Array(4);
    const view = new DataView(buf.buffer, buf.byteOffset, 4);
    view.setFloat32(0, value, true);
    this.append(buf);
  }

  public writeFixed64(fieldNumber: number, value: number | bigint): void {
    this.writeTag(fieldNumber, WireType.FIXED64);
    const buf = new Uint8Array(8);
    const view = new DataView(buf.buffer, buf.byteOffset, 8);
    view.setBigUint64(0, BigInt(value), true);
    this.append(buf);
  }

  public writeDouble(fieldNumber: number, value: number): void {
    this.writeTag(fieldNumber, WireType.FIXED64);
    const buf = new Uint8Array(8);
    const view = new DataView(buf.buffer, buf.byteOffset, 8);
    view.setFloat64(0, value, true);
    this.append(buf);
  }

  public writeBytes(fieldNumber: number, bytes: Uint8Array): void {
    this.writeTag(fieldNumber, WireType.LENGTH_DELIMITED);
    this.append(encodeVarint(bytes.length));
    this.append(bytes);
  }

  public writeString(fieldNumber: number, str: string): void {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);
    this.writeBytes(fieldNumber, encoded);
  }

  public writeMessage(fieldNumber: number, messageBytes: Uint8Array): void {
    this.writeBytes(fieldNumber, messageBytes);
  }

  public finish(): Uint8Array {
    const out = new Uint8Array(this.totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

export class WireReader {
  private buffer: Uint8Array;
  private view: DataView;
  private pos = 0;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  public get offset(): number {
    return this.pos;
  }

  public hasMore(): boolean {
    return this.pos < this.buffer.length;
  }

  public readTag(): { fieldNumber: number; wireType: WireType } {
    const { value: tag, bytesRead } = decodeVarint(this.buffer, this.pos);
    this.pos += bytesRead;
    const wireType = (tag & 0x07) as WireType;
    const fieldNumber = tag >>> 3;
    return { fieldNumber, wireType };
  }

  public readVarint(): number {
    const { value, bytesRead } = decodeVarint(this.buffer, this.pos);
    this.pos += bytesRead;
    return value;
  }

  public readVarintBigInt(): bigint {
    const { value, bytesRead } = decodeVarintBigInt(this.buffer, this.pos);
    this.pos += bytesRead;
    return value;
  }

  public readFixed32(): number {
    if (this.pos + 4 > this.buffer.length) {
      throw new Error('Unexpected end of buffer reading fixed32');
    }
    const val = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return val;
  }

  public readSFixed32(): number {
    if (this.pos + 4 > this.buffer.length) {
      throw new Error('Unexpected end of buffer reading sfixed32');
    }
    const val = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return val;
  }

  public readFloat(): number {
    if (this.pos + 4 > this.buffer.length) {
      throw new Error('Unexpected end of buffer reading float');
    }
    const val = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return val;
  }

  public readFixed64(): bigint {
    if (this.pos + 8 > this.buffer.length) {
      throw new Error('Unexpected end of buffer reading fixed64');
    }
    const val = this.view.getBigUint64(this.pos, true);
    this.pos += 8;
    return val;
  }

  public readDouble(): number {
    if (this.pos + 8 > this.buffer.length) {
      throw new Error('Unexpected end of buffer reading double');
    }
    const val = this.view.getFloat64(this.pos, true);
    this.pos += 8;
    return val;
  }

  public readBytes(): Uint8Array {
    const length = this.readVarint();
    if (this.pos + length > this.buffer.length) {
      throw new Error(`Unexpected end of buffer reading bytes of length ${length}`);
    }
    const slice = this.buffer.subarray(this.pos, this.pos + length);
    this.pos += length;
    return slice;
  }

  public readString(): string {
    const bytes = this.readBytes();
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  }

  public skip(wireType: WireType): void {
    switch (wireType) {
      case WireType.VARINT:
        this.readVarintBigInt();
        break;
      case WireType.FIXED64:
        if (this.pos + 8 > this.buffer.length) throw new Error('Unexpected EOF');
        this.pos += 8;
        break;
      case WireType.LENGTH_DELIMITED: {
        const len = this.readVarint();
        if (this.pos + len > this.buffer.length) throw new Error('Unexpected EOF');
        this.pos += len;
        break;
      }
      case WireType.FIXED32:
        if (this.pos + 4 > this.buffer.length) throw new Error('Unexpected EOF');
        this.pos += 4;
        break;
      default:
        throw new Error(`Unsupported wire type to skip: ${wireType}`);
    }
  }
}
