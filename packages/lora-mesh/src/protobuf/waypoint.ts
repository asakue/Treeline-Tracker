/**
 * Meshtastic Waypoint wire codec.
 * Geofences, POIs, waypoints with icon emoji and scaled coordinates.
 */

import { WaypointMessage } from './types';
import { WireWriter, WireReader, WireType } from './wire';

export function encodeWaypoint(wp: WaypointMessage): Uint8Array {
  const writer = new WireWriter();
  writer.writeVarint(1, wp.id);

  if (wp.latitude_i !== undefined) {
    writer.writeSFixed32(2, wp.latitude_i);
  }
  if (wp.longitude_i !== undefined) {
    writer.writeSFixed32(3, wp.longitude_i);
  }
  if (wp.expire !== undefined) {
    writer.writeFixed32(4, wp.expire);
  }
  if (wp.locked_to !== undefined) {
    writer.writeVarint(5, wp.locked_to);
  }
  if (wp.name) {
    writer.writeString(6, wp.name);
  }
  if (wp.description) {
    writer.writeString(7, wp.description);
  }
  if (wp.icon !== undefined) {
    writer.writeFixed32(8, wp.icon);
  }

  return writer.finish();
}

export function decodeWaypoint(bytes: Uint8Array): WaypointMessage {
  const reader = new WireReader(bytes);
  const wp: WaypointMessage = {
    id: 0,
    name: ''
  };

  while (reader.hasMore()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1:
        wp.id = reader.readVarint();
        break;
      case 2:
        wp.latitude_i = reader.readSFixed32();
        break;
      case 3:
        wp.longitude_i = reader.readSFixed32();
        break;
      case 4:
        wp.expire = reader.readFixed32();
        break;
      case 5:
        wp.locked_to = reader.readVarint();
        break;
      case 6:
        wp.name = reader.readString();
        break;
      case 7:
        wp.description = reader.readString();
        break;
      case 8:
        wp.icon = reader.readFixed32();
        break;
      default:
        reader.skip(wireType);
        break;
    }
  }

  return wp;
}
