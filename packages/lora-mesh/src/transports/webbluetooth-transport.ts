/**
 * WebBluetoothTransport GATT client for Meshtastic BLE devices.
 * Service: 6ba1b218-15a8-461f-9fa8-5dcae273eafd
 * Characteristics: ToRadio (f75c76d2), FromRadio (2c55e69e), FromNum (ed9da18c)
 */

import { ILoRaMeshTransport, MeshTransportStatus, DeliveryResult, PacketHandler, StatusHandler } from './interfaces';
import { MeshPacket } from '../protobuf/types';
import { encodeToRadio } from '../protobuf/to-radio';
import { decodeFromRadio } from '../protobuf/from-radio';

export const MESHTASTIC_BLE_SERVICE_UUID = '6ba1b218-15a8-461f-9fa8-5dcae273eafd';
export const MESHTASTIC_BLE_TORADIO_UUID = 'f75c76d2-129e-4dad-a1dd-7866124401e7';
export const MESHTASTIC_BLE_FROMRADIO_UUID = '2c55e69e-4993-11ed-b878-0242ac120002';
export const MESHTASTIC_BLE_FROMNUM_UUID = 'ed9da18c-a800-4f66-a670-aa7547e34453';

export interface BluetoothCharacteristicLike {
  writeValue?(value: BufferSource): Promise<void>;
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
  readValue(): Promise<DataView>;
  startNotifications(): Promise<BluetoothCharacteristicLike>;
  stopNotifications(): Promise<BluetoothCharacteristicLike>;
  addEventListener(type: string, listener: (event: any) => void): void;
  removeEventListener(type: string, listener: (event: any) => void): void;
}

export interface BluetoothDeviceLike {
  gatt?: {
    connected: boolean;
    connect(): Promise<{
      getPrimaryService(service: string): Promise<{
        getCharacteristic(char: string): Promise<BluetoothCharacteristicLike>;
      }>;
    }>;
    disconnect(): void;
  };
}

export class WebBluetoothTransport implements ILoRaMeshTransport {
  public readonly name = 'WebBluetooth (Meshtastic BLE)';
  public readonly transportType = 'bluetooth';

  private status: MeshTransportStatus = 'DISCONNECTED';
  private device: BluetoothDeviceLike | null = null;
  private toRadioChar: BluetoothCharacteristicLike | null = null;
  private fromRadioChar: BluetoothCharacteristicLike | null = null;
  private fromNumChar: BluetoothCharacteristicLike | null = null;

  private packetHandlers = new Set<PacketHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private fromNumListener?: (event: any) => void;
  private isDraining = false;

  constructor(private injectedDevice?: BluetoothDeviceLike) {}

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
      if (this.injectedDevice) {
        this.device = this.injectedDevice;
      } else if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
        this.device = await (navigator as any).bluetooth.requestDevice({
          filters: [{ services: [MESHTASTIC_BLE_SERVICE_UUID] }]
        });
      } else {
        throw new Error('WebBluetooth API is not supported in this runtime environment');
      }

      if (!this.device || !this.device.gatt) {
        throw new Error('No Bluetooth device selected');
      }

      const server = await this.device.gatt.connect();
      const service = await server.getPrimaryService(MESHTASTIC_BLE_SERVICE_UUID);

      this.toRadioChar = await service.getCharacteristic(MESHTASTIC_BLE_TORADIO_UUID);
      this.fromRadioChar = await service.getCharacteristic(MESHTASTIC_BLE_FROMRADIO_UUID);
      this.fromNumChar = await service.getCharacteristic(MESHTASTIC_BLE_FROMNUM_UUID);

      this.fromNumListener = async () => {
        await this.drainQueue();
      };

      await this.fromNumChar.startNotifications();
      this.fromNumChar.addEventListener('characteristicvaluechanged', this.fromNumListener);

      this.setStatus('CONNECTED');

      // Trigger initial drain in case packets are already waiting
      await this.drainQueue();
    } catch (err: any) {
      this.setStatus('ERROR');
      throw new Error(`Bluetooth connection failed: ${err.message}`);
    }
  }

  public async drainQueue(): Promise<void> {
    if (this.isDraining || !this.fromRadioChar) return;
    this.isDraining = true;

    try {
      while (true) {
        const view = await this.fromRadioChar.readValue();
        if (!view || view.byteLength === 0) {
          break;
        }

        const rawBytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        try {
          const fromRadio = decodeFromRadio(rawBytes);
          if (fromRadio.packet) {
            for (const handler of this.packetHandlers) {
              handler(fromRadio.packet);
            }
          }
        } catch {
          // Skip invalid frame
        }
      }
    } catch (err) {
      // BLE read error
    } finally {
      this.isDraining = false;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.fromNumChar && this.fromNumListener) {
        this.fromNumChar.removeEventListener('characteristicvaluechanged', this.fromNumListener);
        await this.fromNumChar.stopNotifications().catch(() => {});
      }
      if (this.device?.gatt?.connected) {
        this.device.gatt.disconnect();
      }
    } finally {
      this.toRadioChar = null;
      this.fromRadioChar = null;
      this.fromNumChar = null;
      this.device = null;
      this.setStatus('DISCONNECTED');
    }
  }

  public async sendPacket(packet: MeshPacket): Promise<DeliveryResult> {
    if (this.status !== 'CONNECTED' || !this.toRadioChar) {
      return { success: false, packetId: packet.id, error: 'Bluetooth not connected' };
    }

    try {
      const bytes = encodeToRadio({ packet });
      if (this.toRadioChar.writeValueWithoutResponse) {
        await this.toRadioChar.writeValueWithoutResponse(bytes as unknown as BufferSource);
      } else if (this.toRadioChar.writeValue) {
        await this.toRadioChar.writeValue(bytes as unknown as BufferSource);
      } else {
        throw new Error('Characteristic has no write capability');
      }
      return { success: true, packetId: packet.id, latencyMs: 15 };
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
