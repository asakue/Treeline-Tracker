/**
 * 5-state streaming FSM parser for Meshtastic Serial UART demarcation.
 * Sync magic: 0x94 0xC3. Max frame length: 512 bytes.
 */

export const SERIAL_MAGIC_SYNC1 = 0x94;
export const SERIAL_MAGIC_SYNC2 = 0xc3;
export const MAX_TO_FROM_RADIO_SIZE = 512;

export enum SerialFsmState {
  SEEK_SYNC1 = 0,
  EXPECT_SYNC2 = 1,
  READ_LEN_HI = 2,
  READ_LEN_LO = 3,
  COLLECT_PAYLOAD = 4
}

export class WebSerialFsmParser {
  private state = SerialFsmState.SEEK_SYNC1;
  private lenHi = 0;
  private payloadLen = 0;
  private bufferIdx = 0;
  private readonly buffer = new Uint8Array(MAX_TO_FROM_RADIO_SIZE);

  public getState(): SerialFsmState {
    return this.state;
  }

  public reset(): void {
    this.state = SerialFsmState.SEEK_SYNC1;
    this.lenHi = 0;
    this.payloadLen = 0;
    this.bufferIdx = 0;
  }

  public parse(chunk: Uint8Array, onFrame: (frameBytes: Uint8Array) => void): void {
    for (let i = 0; i < chunk.length; i++) {
      const b = chunk[i];

      switch (this.state) {
        case SerialFsmState.SEEK_SYNC1:
          if (b === SERIAL_MAGIC_SYNC1) {
            this.state = SerialFsmState.EXPECT_SYNC2;
          }
          break;

        case SerialFsmState.EXPECT_SYNC2:
          if (b === SERIAL_MAGIC_SYNC2) {
            this.state = SerialFsmState.READ_LEN_HI;
          } else if (b === SERIAL_MAGIC_SYNC1) {
            // Consecutive sync1 keeps waiting for sync2
            this.state = SerialFsmState.EXPECT_SYNC2;
          } else {
            // Discard noise and search again
            this.state = SerialFsmState.SEEK_SYNC1;
          }
          break;

        case SerialFsmState.READ_LEN_HI:
          this.lenHi = b;
          this.state = SerialFsmState.READ_LEN_LO;
          break;

        case SerialFsmState.READ_LEN_LO:
          this.payloadLen = ((this.lenHi << 8) | b) >>> 0;
          if (this.payloadLen === 0 || this.payloadLen > MAX_TO_FROM_RADIO_SIZE) {
            // Framing error / noise: reset immediately to sync seek
            this.state = SerialFsmState.SEEK_SYNC1;
          } else {
            this.bufferIdx = 0;
            this.state = SerialFsmState.COLLECT_PAYLOAD;
          }
          break;

        case SerialFsmState.COLLECT_PAYLOAD:
          this.buffer[this.bufferIdx++] = b;
          if (this.bufferIdx === this.payloadLen) {
            const frameBytes = this.buffer.slice(0, this.payloadLen);
            this.state = SerialFsmState.SEEK_SYNC1;
            onFrame(frameBytes);
          }
          break;
      }
    }
  }

  public static encodeFrame(protobufBytes: Uint8Array): Uint8Array {
    if (protobufBytes.length === 0) {
      throw new Error('Cannot encode empty frame');
    }
    if (protobufBytes.length > MAX_TO_FROM_RADIO_SIZE) {
      throw new Error(
        `Frame exceeds maximum allowable length of ${MAX_TO_FROM_RADIO_SIZE} bytes (got ${protobufBytes.length})`
      );
    }

    const frame = new Uint8Array(4 + protobufBytes.length);
    frame[0] = SERIAL_MAGIC_SYNC1;
    frame[1] = SERIAL_MAGIC_SYNC2;
    frame[2] = (protobufBytes.length >> 8) & 0xff;
    frame[3] = protobufBytes.length & 0xff;
    frame.set(protobufBytes, 4);
    return frame;
  }
}
