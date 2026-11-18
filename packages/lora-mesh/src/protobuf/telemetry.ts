/**
 * Meshtastic Telemetry wire codec.
 * DeviceMetrics and EnvironmentMetrics.
 */

import { TelemetryMessage, DeviceMetrics, EnvironmentMetrics } from './types';
import { WireWriter, WireReader, WireType } from './wire';

export function encodeDeviceMetrics(dm: DeviceMetrics): Uint8Array {
  const writer = new WireWriter();
  if (dm.battery_level !== undefined) {
    writer.writeVarint(1, dm.battery_level);
  }
  if (dm.voltage !== undefined) {
    writer.writeFloat(2, dm.voltage);
  }
  if (dm.channel_utilization !== undefined) {
    writer.writeFloat(3, dm.channel_utilization);
  }
  if (dm.air_util_tx !== undefined) {
    writer.writeFloat(4, dm.air_util_tx);
  }
  if (dm.uptime_seconds !== undefined) {
    writer.writeVarint(5, dm.uptime_seconds);
  }
  return writer.finish();
}

export function decodeDeviceMetrics(bytes: Uint8Array): DeviceMetrics {
  const reader = new WireReader(bytes);
  const dm: DeviceMetrics = {};
  while (reader.hasMore()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1:
        dm.battery_level = reader.readVarint();
        break;
      case 2:
        dm.voltage = reader.readFloat();
        break;
      case 3:
        dm.channel_utilization = reader.readFloat();
        break;
      case 4:
        dm.air_util_tx = reader.readFloat();
        break;
      case 5:
        dm.uptime_seconds = reader.readVarint();
        break;
      default:
        reader.skip(wireType);
        break;
    }
  }
  return dm;
}

export function encodeEnvironmentMetrics(em: EnvironmentMetrics): Uint8Array {
  const writer = new WireWriter();
  if (em.temperature !== undefined) {
    writer.writeFloat(1, em.temperature);
  }
  if (em.relative_humidity !== undefined) {
    writer.writeFloat(2, em.relative_humidity);
  }
  if (em.barometric_pressure !== undefined) {
    writer.writeFloat(3, em.barometric_pressure);
  }
  if (em.gas_resistance !== undefined) {
    writer.writeFloat(4, em.gas_resistance);
  }
  if (em.iaq !== undefined) {
    writer.writeVarint(7, em.iaq);
  }
  return writer.finish();
}

export function decodeEnvironmentMetrics(bytes: Uint8Array): EnvironmentMetrics {
  const reader = new WireReader(bytes);
  const em: EnvironmentMetrics = {};
  while (reader.hasMore()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1:
        em.temperature = reader.readFloat();
        break;
      case 2:
        em.relative_humidity = reader.readFloat();
        break;
      case 3:
        em.barometric_pressure = reader.readFloat();
        break;
      case 4:
        em.gas_resistance = reader.readFloat();
        break;
      case 7:
        em.iaq = reader.readVarint();
        break;
      default:
        reader.skip(wireType);
        break;
    }
  }
  return em;
}

export function encodeTelemetry(telemetry: TelemetryMessage): Uint8Array {
  const writer = new WireWriter();
  if (telemetry.time !== undefined) {
    writer.writeFixed32(1, telemetry.time);
  }
  if (telemetry.device_metrics) {
    writer.writeMessage(2, encodeDeviceMetrics(telemetry.device_metrics));
  }
  if (telemetry.environment_metrics) {
    writer.writeMessage(3, encodeEnvironmentMetrics(telemetry.environment_metrics));
  }
  return writer.finish();
}

export function decodeTelemetry(bytes: Uint8Array): TelemetryMessage {
  const reader = new WireReader(bytes);
  const telemetry: TelemetryMessage = {};

  while (reader.hasMore()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1:
        telemetry.time = reader.readFixed32();
        break;
      case 2:
        telemetry.device_metrics = decodeDeviceMetrics(reader.readBytes());
        break;
      case 3:
        telemetry.environment_metrics = decodeEnvironmentMetrics(reader.readBytes());
        break;
      default:
        reader.skip(wireType);
        break;
    }
  }

  return telemetry;
}
