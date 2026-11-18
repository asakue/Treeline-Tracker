/**
 * Meshtastic MeshPacket root wire codec.
 */

import { MeshPacket, PacketPriority } from './types';
import { WireWriter, WireReader, WireType } from './wire';
import { encodeData, decodeData } from './data';

export function encodeMeshPacket(packet: MeshPacket): Uint8Array {
  const writer = new WireWriter();

  writer.writeFixed32(1, packet.from);
  writer.writeFixed32(2, packet.to);

  if (packet.channel !== undefined) {
    writer.writeVarint(3, packet.channel);
  }
  if (packet.decoded) {
    writer.writeMessage(4, encodeData(packet.decoded));
  }
  if (packet.encrypted && packet.encrypted.length > 0) {
    writer.writeBytes(5, packet.encrypted);
  }

  writer.writeFixed32(6, packet.id);

  if (packet.rx_time !== undefined) {
    writer.writeFixed32(7, packet.rx_time);
  }
  if (packet.rx_snr !== undefined) {
    writer.writeFloat(8, packet.rx_snr);
  }
  if (packet.hop_limit !== undefined) {
    writer.writeVarint(9, packet.hop_limit);
  }
  if (packet.want_ack !== undefined) {
    writer.writeVarint(10, packet.want_ack);
  }
  if (packet.priority !== undefined) {
    writer.writeVarint(11, packet.priority);
  }
  if (packet.rx_rssi !== undefined) {
    writer.writeVarint(12, packet.rx_rssi);
  }
  if (packet.hop_start !== undefined) {
    writer.writeVarint(15, packet.hop_start);
  }
  if (packet.pki_encrypted !== undefined) {
    writer.writeVarint(16, packet.pki_encrypted);
  }

  return writer.finish();
}

export function decodeMeshPacket(bytes: Uint8Array): MeshPacket {
  const reader = new WireReader(bytes);
  const packet: MeshPacket = {
    from: 0,
    to: 0,
    channel: 0,
    id: 0,
    hop_limit: 0,
    want_ack: false,
    priority: PacketPriority.UNSET
  };

  while (reader.hasMore()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1:
        packet.from = reader.readFixed32();
        break;
      case 2:
        packet.to = reader.readFixed32();
        break;
      case 3:
        packet.channel = reader.readVarint();
        break;
      case 4:
        packet.decoded = decodeData(reader.readBytes());
        break;
      case 5:
        packet.encrypted = reader.readBytes();
        break;
      case 6:
        packet.id = reader.readFixed32();
        break;
      case 7:
        packet.rx_time = reader.readFixed32();
        break;
      case 8:
        packet.rx_snr = reader.readFloat();
        break;
      case 9:
        packet.hop_limit = reader.readVarint();
        break;
      case 10:
        packet.want_ack = reader.readVarint() !== 0;
        break;
      case 11:
        packet.priority = reader.readVarint() as PacketPriority;
        break;
      case 12:
        packet.rx_rssi = reader.readVarint();
        break;
      case 15:
        packet.hop_start = reader.readVarint();
        break;
      case 16:
        packet.pki_encrypted = reader.readVarint() !== 0;
        break;
      default:
        reader.skip(wireType);
        break;
    }
  }

  return packet;
}
