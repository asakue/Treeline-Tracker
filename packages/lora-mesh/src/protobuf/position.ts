/**
 * Meshtastic Position wire codec.
 * Scaled integer latitude_i and longitude_i (1e7 scaling factor).
 */

import { PositionMessage, LocationSource } from './types';
import { WireWriter, WireReader, WireType } from './wire';

export function encodePosition(pos: PositionMessage): Uint8Array {
  const writer = new WireWriter();

  writer.writeSFixed32(1, pos.latitude_i);
  writer.writeSFixed32(2, pos.longitude_i);

  if (pos.altitude !== undefined) {
    writer.writeVarint(3, pos.altitude);
  }
  if (pos.time !== undefined) {
    writer.writeFixed32(4, pos.time);
  }
  if (pos.location_source !== undefined) {
    writer.writeVarint(5, pos.location_source);
  }
  if (pos.timestamp !== undefined) {
    writer.writeFixed32(7, pos.timestamp);
  }
  if (pos.gps_accuracy !== undefined) {
    writer.writeVarint(14, pos.gps_accuracy);
  }
  if (pos.ground_speed !== undefined) {
    writer.writeVarint(15, pos.ground_speed);
  }
  if (pos.ground_track !== undefined) {
    writer.writeVarint(16, pos.ground_track);
  }
  if (pos.sats_in_view !== undefined) {
    writer.writeVarint(19, pos.sats_in_view);
  }
  if (pos.precision_bits !== undefined) {
    writer.writeVarint(20, pos.precision_bits);
  }

  return writer.finish();
}

export function decodePosition(bytes: Uint8Array): PositionMessage {
  const reader = new WireReader(bytes);
  const pos: PositionMessage = {
    latitude_i: 0,
    longitude_i: 0
  };

  while (reader.hasMore()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1:
        pos.latitude_i = reader.readSFixed32();
        break;
      case 2:
        pos.longitude_i = reader.readSFixed32();
        break;
      case 3:
        pos.altitude = reader.readVarint();
        break;
      case 4:
        pos.time = reader.readFixed32();
        break;
      case 5:
        pos.location_source = reader.readVarint() as LocationSource;
        break;
      case 7:
        pos.timestamp = reader.readFixed32();
        break;
      case 14:
        pos.gps_accuracy = reader.readVarint();
        break;
      case 15:
        pos.ground_speed = reader.readVarint();
        break;
      case 16:
        pos.ground_track = reader.readVarint();
        break;
      case 19:
        pos.sats_in_view = reader.readVarint();
        break;
      case 20:
        pos.precision_bits = reader.readVarint();
        break;
      default:
        reader.skip(wireType);
        break;
    }
  }

  return pos;
}
