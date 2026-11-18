/**
 * Meshtastic FromRadio wire codec.
 * Radio-to-client streaming message envelope.
 */

import { FromRadio, MyNodeInfo } from './types';
import { WireWriter, WireReader, WireType } from './wire';
import { encodeMeshPacket, decodeMeshPacket } from './mesh-packet';
import { encodeNodeInfo, decodeNodeInfo } from './user';

export function encodeMyNodeInfo(info: MyNodeInfo): Uint8Array {
  const writer = new WireWriter();
  writer.writeVarint(1, info.my_node_num);
  if (info.reboot_count !== undefined) {
    writer.writeVarint(4, info.reboot_count);
  }
  if (info.has_gps !== undefined) {
    writer.writeVarint(7, info.has_gps);
  }
  return writer.finish();
}

export function decodeMyNodeInfo(bytes: Uint8Array): MyNodeInfo {
  const reader = new WireReader(bytes);
  const info: MyNodeInfo = {
    my_node_num: 0
  };
  while (reader.hasMore()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1:
        info.my_node_num = reader.readVarint();
        break;
      case 4:
        info.reboot_count = reader.readVarint();
        break;
      case 7:
        info.has_gps = reader.readVarint() !== 0;
        break;
      default:
        reader.skip(wireType);
        break;
    }
  }
  return info;
}

export function encodeFromRadio(fromRadio: FromRadio): Uint8Array {
  const writer = new WireWriter();

  writer.writeVarint(1, fromRadio.id);

  if (fromRadio.packet) {
    writer.writeMessage(2, encodeMeshPacket(fromRadio.packet));
  }
  if (fromRadio.my_info) {
    writer.writeMessage(3, encodeMyNodeInfo(fromRadio.my_info));
  }
  if (fromRadio.node_info) {
    writer.writeMessage(4, encodeNodeInfo(fromRadio.node_info));
  }
  if (fromRadio.config_complete_id !== undefined) {
    writer.writeVarint(5, fromRadio.config_complete_id);
  }
  if (fromRadio.rebooted !== undefined) {
    writer.writeVarint(6, fromRadio.rebooted);
  }

  return writer.finish();
}

export function decodeFromRadio(bytes: Uint8Array): FromRadio {
  const reader = new WireReader(bytes);
  const fromRadio: FromRadio = {
    id: 0
  };

  while (reader.hasMore()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1:
        fromRadio.id = reader.readVarint();
        break;
      case 2:
        fromRadio.packet = decodeMeshPacket(reader.readBytes());
        break;
      case 3:
        fromRadio.my_info = decodeMyNodeInfo(reader.readBytes());
        break;
      case 4:
        fromRadio.node_info = decodeNodeInfo(reader.readBytes());
        break;
      case 5:
        fromRadio.config_complete_id = reader.readVarint();
        break;
      case 6:
        fromRadio.rebooted = reader.readVarint() !== 0;
        break;
      default:
        reader.skip(wireType);
        break;
    }
  }

  return fromRadio;
}
