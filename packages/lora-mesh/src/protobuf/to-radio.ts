/**
 * Meshtastic ToRadio wire codec.
 * Command envelope sent from client to radio.
 */

import { ToRadio } from './types';
import { WireWriter, WireReader, WireType } from './wire';
import { encodeMeshPacket, decodeMeshPacket } from './mesh-packet';

export function encodeToRadio(toRadio: ToRadio): Uint8Array {
  const writer = new WireWriter();

  if (toRadio.packet) {
    writer.writeMessage(1, encodeMeshPacket(toRadio.packet));
  }
  if (toRadio.want_config_id !== undefined) {
    writer.writeVarint(2, toRadio.want_config_id);
  }
  if (toRadio.disconnect !== undefined) {
    writer.writeVarint(3, toRadio.disconnect);
  }

  return writer.finish();
}

export function decodeToRadio(bytes: Uint8Array): ToRadio {
  const reader = new WireReader(bytes);
  const toRadio: ToRadio = {};

  while (reader.hasMore()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1:
        toRadio.packet = decodeMeshPacket(reader.readBytes());
        break;
      case 2:
        toRadio.want_config_id = reader.readVarint();
        break;
      case 3:
        toRadio.disconnect = reader.readVarint() !== 0;
        break;
      default:
        reader.skip(wireType);
        break;
    }
  }

  return toRadio;
}
