/**
 * Meshtastic Data application envelope wire codec.
 */

import { DataPayload, PortNum } from './types';
import { WireWriter, WireReader, WireType } from './wire';

export function encodeData(data: DataPayload): Uint8Array {
  const writer = new WireWriter();
  writer.writeVarint(1, data.portnum);
  writer.writeBytes(2, data.payload);

  if (data.want_response !== undefined) {
    writer.writeVarint(3, data.want_response);
  }
  if (data.dest !== undefined) {
    writer.writeFixed32(4, data.dest);
  }
  if (data.source !== undefined) {
    writer.writeFixed32(5, data.source);
  }
  if (data.request_id !== undefined) {
    writer.writeVarint(6, data.request_id);
  }
  if (data.reply_id !== undefined) {
    writer.writeVarint(7, data.reply_id);
  }
  if (data.emoji !== undefined) {
    writer.writeFixed32(8, data.emoji);
  }

  return writer.finish();
}

export function decodeData(bytes: Uint8Array): DataPayload {
  const reader = new WireReader(bytes);
  const data: DataPayload = {
    portnum: PortNum.UNKNOWN_APP,
    payload: new Uint8Array(0)
  };

  while (reader.hasMore()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1:
        data.portnum = reader.readVarint() as PortNum;
        break;
      case 2:
        data.payload = reader.readBytes();
        break;
      case 3:
        data.want_response = reader.readVarint() !== 0;
        break;
      case 4:
        data.dest = reader.readFixed32();
        break;
      case 5:
        data.source = reader.readFixed32();
        break;
      case 6:
        data.request_id = reader.readVarint();
        break;
      case 7:
        data.reply_id = reader.readVarint();
        break;
      case 8:
        data.emoji = reader.readFixed32();
        break;
      default:
        reader.skip(wireType);
        break;
    }
  }

  return data;
}
