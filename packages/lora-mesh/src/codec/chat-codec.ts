/**
 * Mesh Text Chat Codec.
 * Encodes and decodes UTF-8 text messages within the LoRa MTU limit (<= 228 bytes).
 */

import { MeshPacket, PortNum, PacketPriority, NODENUM_BROADCAST } from '../protobuf/types';

export const MAX_MESH_TEXT_LENGTH = 228;

export function encodeChatMessage(text: string): Uint8Array {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  if (bytes.length > MAX_MESH_TEXT_LENGTH) {
    // Truncate to maximum allowable byte length cleanly
    return bytes.slice(0, MAX_MESH_TEXT_LENGTH);
  }
  return bytes;
}

export function decodeChatMessage(bytes: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

export function buildChatPacket(
  fromNode: number,
  toNode: number = NODENUM_BROADCAST,
  text: string,
  options?: Partial<MeshPacket>
): MeshPacket {
  const payloadBytes = encodeChatMessage(text);

  return {
    from: fromNode,
    to: toNode,
    channel: options?.channel ?? 0,
    id: options?.id ?? Math.floor(Math.random() * 0xffffffff),
    hop_limit: options?.hop_limit ?? 3,
    want_ack: options?.want_ack ?? (toNode !== NODENUM_BROADCAST),
    priority: options?.priority ?? PacketPriority.DEFAULT,
    decoded: {
      portnum: PortNum.TEXT_MESSAGE_APP,
      payload: payloadBytes
    }
  };
}

export function parseChatPacket(packet: MeshPacket): {
  text: string;
  from: number;
  to: number;
  isBroadcast: boolean;
} | null {
  if (!packet.decoded || packet.decoded.portnum !== PortNum.TEXT_MESSAGE_APP) {
    return null;
  }

  const text = decodeChatMessage(packet.decoded.payload);
  return {
    text,
    from: packet.from,
    to: packet.to,
    isBroadcast: packet.to === NODENUM_BROADCAST
  };
}
