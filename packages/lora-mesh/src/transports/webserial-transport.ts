/**
 * WebSerialTransport driver for Meshtastic LoRa devices via Serial UART.
 * Uses WebSerialFsmParser for stream demarcation (0x94 0xC3 framing).
 */

import { ILoRaMeshTransport, MeshTransportStatus, DeliveryResult, PacketHandler, StatusHandler } from './interfaces';
import { MeshPacket } from '../protobuf/types';
import { WebSerialFsmParser } from './webserial-fsm';
import { encodeToRadio } from '../protobuf/to-radio';
import { decodeFromRadio } from '../protobuf/from-radio';

export interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

export class WebSerialTransport implements ILoRaMeshTransport {
  public readonly name = 'WebSerial (Meshtastic 115200 8N1)';
  public readonly transportType = 'serial';

  private status: MeshTransportStatus = 'DISCONNECTED';
  private port: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private parser = new WebSerialFsmParser();
  private packetHandlers = new Set<PacketHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private readLoopActive = false;

  constructor(private injectedPort?: SerialPortLike) {}

  public getStatus(): MeshTransportStatus {
    return this.status;
  }

  private setStatus(newStatus: MeshTransportStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      for (const handler of this.statusHandlers) {
        handler(newStatus);
      }
    }
  }

  public async connect(): Promise<void> {
    if (this.status === 'CONNECTED') return;

    this.setStatus('CONNECTING');
    try {
      if (this.injectedPort) {
        this.port = this.injectedPort;
      } else if (typeof navigator !== 'undefined' && 'serial' in navigator) {
        this.port = await (navigator as any).serial.requestPort();
      } else {
        throw new Error('WebSerial API is not supported in this runtime environment');
      }

      if (!this.port) {
        throw new Error('No serial port selected');
      }

      await this.port.open({ baudRate: 115200 });

      if (!this.port.readable || !this.port.writable) {
        throw new Error('Serial port streams are unavailable');
      }

      this.reader = this.port.readable.getReader();
      this.writer = this.port.writable.getWriter();
      this.setStatus('CONNECTED');
      this.startReadLoop();
    } catch (err: any) {
      this.setStatus('ERROR');
      throw new Error(`Serial connection failed: ${err.message}`);
    }
  }

  private async startReadLoop(): Promise<void> {
    this.readLoopActive = true;
    try {
      while (this.readLoopActive && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value && value.length > 0) {
          this.parser.parse(value, (frameBytes) => {
            try {
              const fromRadio = decodeFromRadio(frameBytes);
              if (fromRadio.packet) {
                for (const handler of this.packetHandlers) {
                  handler(fromRadio.packet);
                }
              }
            } catch {
              // Frame decoding error ignored in raw stream
            }
          });
        }
      }
    } catch {
      this.setStatus('ERROR');
    } finally {
      this.readLoopActive = false;
      if (this.status === 'CONNECTED') {
        this.setStatus('DISCONNECTED');
      }
    }
  }

  public async disconnect(): Promise<void> {
    this.readLoopActive = false;
    try {
      if (this.reader) {
        await this.reader.cancel().catch(() => {});
        this.reader.releaseLock();
        this.reader = null;
      }
      if (this.writer) {
        await this.writer.close().catch(() => {});
        this.writer.releaseLock();
        this.writer = null;
      }
      if (this.port) {
        await this.port.close().catch(() => {});
        this.port = null;
      }
    } finally {
      this.setStatus('DISCONNECTED');
    }
  }

  public async sendPacket(packet: MeshPacket): Promise<DeliveryResult> {
    if (this.status !== 'CONNECTED' || !this.writer) {
      return { success: false, packetId: packet.id, error: 'Transport not connected' };
    }

    try {
      const toRadioBytes = encodeToRadio({ packet });
      const framed = WebSerialFsmParser.encodeFrame(toRadioBytes);
      await this.writer.write(framed);
      return { success: true, packetId: packet.id, latencyMs: 5 };
    } catch (err: any) {
      return { success: false, packetId: packet.id, error: err.message };
    }
  }

  public onPacket(handler: PacketHandler): () => void {
    this.packetHandlers.add(handler);
    return () => this.packetHandlers.delete(handler);
  }

  public onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }
}
