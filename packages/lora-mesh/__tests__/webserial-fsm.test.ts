import { describe, it, expect } from 'vitest';
import {
  WebSerialFsmParser,
  SerialFsmState,
  SERIAL_MAGIC_SYNC1,
  SERIAL_MAGIC_SYNC2,
  MAX_TO_FROM_RADIO_SIZE
} from '../src/transports/webserial-fsm';

describe('WebSerialFsmParser', () => {
  it('should parse a single complete frame', () => {
    const parser = new WebSerialFsmParser();
    const payload = new Uint8Array([0x08, 0x01, 0x12, 0x04, 0x74, 0x65, 0x73, 0x74]); // 8 bytes
    const frame = WebSerialFsmParser.encodeFrame(payload);

    const received: Uint8Array[] = [];
    parser.parse(frame, (bytes) => {
      received.push(bytes);
    });

    expect(received.length).toBe(1);
    expect(received[0]).toEqual(payload);
    expect(parser.getState()).toBe(SerialFsmState.SEEK_SYNC1);
  });

  it('should reject ESP32 bootloader ASCII chatter and sync on real frame', () => {
    const parser = new WebSerialFsmParser();
    const bootChatter = new TextEncoder().encode(
      'rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)\nconfigsip: 0, SPIWP:0xee\n'
    );
    const validPayload = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]);
    const validFrame = WebSerialFsmParser.encodeFrame(validPayload);

    // Combine chatter followed by valid frame
    const stream = new Uint8Array(bootChatter.length + validFrame.length);
    stream.set(bootChatter, 0);
    stream.set(validFrame, bootChatter.length);

    const received: Uint8Array[] = [];
    parser.parse(stream, (bytes) => {
      received.push(bytes);
    });

    expect(received.length).toBe(1);
    expect(received[0]).toEqual(validPayload);
  });

  it('should handle duplicate sync1 bytes (0x94 0x94 0xC3)', () => {
    const parser = new WebSerialFsmParser();
    const payload = new Uint8Array([1, 2, 3]);
    // Deliberately introduce extra 0x94 before sync2
    const stream = new Uint8Array([
      SERIAL_MAGIC_SYNC1,
      SERIAL_MAGIC_SYNC1,
      SERIAL_MAGIC_SYNC2,
      0x00,
      0x03,
      1,
      2,
      3
    ]);

    const received: Uint8Array[] = [];
    parser.parse(stream, (bytes) => {
      received.push(bytes);
    });

    expect(received.length).toBe(1);
    expect(received[0]).toEqual(payload);
  });

  it('should discard frames with declared length = 0 or > 512 bytes', () => {
    const parser = new WebSerialFsmParser();

    // 1. Length = 0
    const zeroLenStream = new Uint8Array([SERIAL_MAGIC_SYNC1, SERIAL_MAGIC_SYNC2, 0x00, 0x00]);
    let count = 0;
    parser.parse(zeroLenStream, () => count++);
    expect(count).toBe(0);
    expect(parser.getState()).toBe(SerialFsmState.SEEK_SYNC1);

    // 2. Length = 513 (> 512)
    const tooLongStream = new Uint8Array([SERIAL_MAGIC_SYNC1, SERIAL_MAGIC_SYNC2, 0x02, 0x01]); // 513
    parser.parse(tooLongStream, () => count++);
    expect(count).toBe(0);
    expect(parser.getState()).toBe(SerialFsmState.SEEK_SYNC1);
  });

  it('should parse fragmented streams arriving 1 byte at a time', () => {
    const parser = new WebSerialFsmParser();
    const payload = new Uint8Array([10, 20, 30, 40, 50]);
    const frame = WebSerialFsmParser.encodeFrame(payload);

    const received: Uint8Array[] = [];
    for (let i = 0; i < frame.length; i++) {
      parser.parse(new Uint8Array([frame[i]]), (bytes) => {
        received.push(bytes);
      });
    }

    expect(received.length).toBe(1);
    expect(received[0]).toEqual(payload);
  });

  it('should parse multiple back-to-back frames in chunks of arbitrary sizes', () => {
    const parser = new WebSerialFsmParser();
    const p1 = new Uint8Array([1, 2, 3]);
    const p2 = new Uint8Array([4, 5, 6, 7]);
    const f1 = WebSerialFsmParser.encodeFrame(p1);
    const f2 = WebSerialFsmParser.encodeFrame(p2);

    const combined = new Uint8Array(f1.length + f2.length);
    combined.set(f1, 0);
    combined.set(f2, f1.length);

    const received: Uint8Array[] = [];
    // Feed in 3-byte chunks
    for (let i = 0; i < combined.length; i += 3) {
      const slice = combined.subarray(i, Math.min(i + 3, combined.length));
      parser.parse(slice, (bytes) => {
        received.push(bytes);
      });
    }

    expect(received.length).toBe(2);
    expect(received[0]).toEqual(p1);
    expect(received[1]).toEqual(p2);
  });

  it('encodeFrame should throw on empty payload or payload > 512 bytes', () => {
    expect(() => WebSerialFsmParser.encodeFrame(new Uint8Array(0))).toThrow();
    expect(() => WebSerialFsmParser.encodeFrame(new Uint8Array(MAX_TO_FROM_RADIO_SIZE + 1))).toThrow();
  });
});
