/**
 * Meshtastic User & NodeInfo wire codec.
 */

import { UserMessage, NodeInfoMessage } from './types';
import { WireWriter, WireReader, WireType } from './wire';
import { encodePosition, decodePosition } from './position';
import { encodeDeviceMetrics, decodeDeviceMetrics } from './telemetry';

export function encodeUser(user: UserMessage): Uint8Array {
  const writer = new WireWriter();
  if (user.id) {
    writer.writeString(1, user.id);
  }
  if (user.long_name) {
    writer.writeString(2, user.long_name);
  }
  if (user.short_name) {
    writer.writeString(3, user.short_name);
  }
  if (user.macaddr && user.macaddr.length > 0) {
    writer.writeBytes(4, user.macaddr);
  }
  if (user.hw_model) {
    writer.writeString(5, user.hw_model);
  }
  if (user.role) {
    writer.writeString(7, user.role);
  }
  if (user.public_key && user.public_key.length > 0) {
    writer.writeBytes(8, user.public_key);
  }
  return writer.finish();
}

export function decodeUser(bytes: Uint8Array): UserMessage {
  const reader = new WireReader(bytes);
  const user: UserMessage = {
    id: '',
    long_name: '',
    short_name: ''
  };

  while (reader.hasMore()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1:
        user.id = reader.readString();
        break;
      case 2:
        user.long_name = reader.readString();
        break;
      case 3:
        user.short_name = reader.readString();
        break;
      case 4:
        user.macaddr = reader.readBytes();
        break;
      case 5:
        user.hw_model = reader.readString();
        break;
      case 7:
        user.role = reader.readString();
        break;
      case 8:
        user.public_key = reader.readBytes();
        break;
      default:
        reader.skip(wireType);
        break;
    }
  }

  return user;
}

export function encodeNodeInfo(info: NodeInfoMessage): Uint8Array {
  const writer = new WireWriter();
  writer.writeVarint(1, info.num);

  if (info.user) {
    writer.writeMessage(2, encodeUser(info.user));
  }
  if (info.position) {
    writer.writeMessage(3, encodePosition(info.position));
  }
  if (info.snr !== undefined) {
    writer.writeFloat(4, info.snr);
  }
  if (info.last_heard !== undefined) {
    writer.writeFixed32(5, info.last_heard);
  }
  if (info.device_metrics) {
    writer.writeMessage(6, encodeDeviceMetrics(info.device_metrics));
  }
  if (info.channel !== undefined) {
    writer.writeVarint(7, info.channel);
  }
  if (info.via_mqtt !== undefined) {
    writer.writeVarint(8, info.via_mqtt);
  }
  if (info.hops_away !== undefined) {
    writer.writeVarint(9, info.hops_away);
  }

  return writer.finish();
}

export function decodeNodeInfo(bytes: Uint8Array): NodeInfoMessage {
  const reader = new WireReader(bytes);
  const node: NodeInfoMessage = {
    num: 0
  };

  while (reader.hasMore()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1:
        node.num = reader.readVarint();
        break;
      case 2:
        node.user = decodeUser(reader.readBytes());
        break;
      case 3:
        node.position = decodePosition(reader.readBytes());
        break;
      case 4:
        node.snr = reader.readFloat();
        break;
      case 5:
        node.last_heard = reader.readFixed32();
        break;
      case 6:
        node.device_metrics = decodeDeviceMetrics(reader.readBytes());
        break;
      case 7:
        node.channel = reader.readVarint();
        break;
      case 8:
        node.via_mqtt = reader.readVarint() !== 0;
        break;
      case 9:
        node.hops_away = reader.readVarint();
        break;
      default:
        reader.skip(wireType);
        break;
    }
  }

  return node;
}
