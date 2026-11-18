/**
 * Meshtastic MQTT ServiceEnvelope wire codec.
 * Encapsulates MeshPacket with channel_id and gateway_id for MQTT routing.
 */

import { ServiceEnvelope } from './types';
import { WireWriter, WireReader, WireType } from './wire';
import { encodeMeshPacket, decodeMeshPacket } from './mesh-packet';

export function encodeServiceEnvelope(env: ServiceEnvelope): Uint8Array {
  const writer = new WireWriter();

  writer.writeMessage(1, encodeMeshPacket(env.packet));
  writer.writeString(2, env.channel_id);
  writer.writeString(3, env.gateway_id);

  return writer.finish();
}

export function decodeServiceEnvelope(bytes: Uint8Array): ServiceEnvelope {
  const reader = new WireReader(bytes);
  let packet = null;
  let channel_id = '';
  let gateway_id = '';

  while (reader.hasMore()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1:
        packet = decodeMeshPacket(reader.readBytes());
        break;
      case 2:
        channel_id = reader.readString();
        break;
      case 3:
        gateway_id = reader.readString();
        break;
      default:
        reader.skip(wireType);
        break;
    }
  }

  if (!packet) {
    throw new Error('ServiceEnvelope missing required field packet');
  }

  return {
    packet,
    channel_id,
    gateway_id
  };
}
