/**
 * GPS Codec for Meshtastic Position encoding and decoding.
 * Handles 1e7 scaled integers, boundary checks, and packet building.
 */

import { PositionMessage, LocationSource, MeshPacket, PortNum, PacketPriority } from '../protobuf/types';
import { encodePosition, decodePosition } from '../protobuf/position';

export const GPS_SCALING_FACTOR = 1e7;

export interface DecodedGps {
  latitude: number;
  longitude: number;
  altitude?: number;
  time?: number;
  locationSource?: LocationSource;
  satsInView?: number;
  accuracy?: number;
}

export function clampLatitude(lat: number): number {
  if (isNaN(lat)) return 0;
  return Math.max(-90, Math.min(90, lat));
}

export function clampLongitude(lon: number): number {
  if (isNaN(lon)) return 0;
  return Math.max(-180, Math.min(180, lon));
}

export function degreesToScaledInt(degrees: number): number {
  return Math.round(degrees * GPS_SCALING_FACTOR);
}

export function scaledIntToDegrees(scaled: number): number {
  return scaled / GPS_SCALING_FACTOR;
}

export function encodeGps(
  latitude: number,
  longitude: number,
  altitude?: number,
  options?: Partial<PositionMessage>
): PositionMessage {
  const clampedLat = clampLatitude(latitude);
  const clampedLon = clampLongitude(longitude);

  return {
    latitude_i: degreesToScaledInt(clampedLat),
    longitude_i: degreesToScaledInt(clampedLon),
    altitude: altitude !== undefined ? Math.round(altitude) : undefined,
    time: options?.time ?? Math.floor(Date.now() / 1000),
    location_source: options?.location_source ?? LocationSource.LOC_INTERNAL,
    sats_in_view: options?.sats_in_view,
    gps_accuracy: options?.gps_accuracy,
    ground_speed: options?.ground_speed,
    ground_track: options?.ground_track,
    precision_bits: options?.precision_bits
  };
}

export function decodeGps(pos: PositionMessage): DecodedGps {
  return {
    latitude: scaledIntToDegrees(pos.latitude_i),
    longitude: scaledIntToDegrees(pos.longitude_i),
    altitude: pos.altitude,
    time: pos.time,
    locationSource: pos.location_source,
    satsInView: pos.sats_in_view,
    accuracy: pos.gps_accuracy
  };
}

export function buildPositionPacket(
  fromNode: number,
  toNode: number = 0xffffffff,
  latitude: number,
  longitude: number,
  altitude?: number,
  packetOptions?: Partial<MeshPacket>
): MeshPacket {
  const posMessage = encodeGps(latitude, longitude, altitude);
  const payloadBytes = encodePosition(posMessage);

  return {
    from: fromNode,
    to: toNode,
    channel: packetOptions?.channel ?? 0,
    id: packetOptions?.id ?? Math.floor(Math.random() * 0xffffffff),
    hop_limit: packetOptions?.hop_limit ?? 3,
    want_ack: packetOptions?.want_ack ?? false,
    priority: packetOptions?.priority ?? PacketPriority.BACKGROUND,
    decoded: {
      portnum: PortNum.POSITION_APP,
      payload: payloadBytes
    }
  };
}

export function parsePositionPacket(packet: MeshPacket): DecodedGps | null {
  if (!packet.decoded || packet.decoded.portnum !== PortNum.POSITION_APP) {
    return null;
  }
  try {
    const pos = decodePosition(packet.decoded.payload);
    return decodeGps(pos);
  } catch {
    return null;
  }
}
