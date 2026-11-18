/**
 * In-memory Node Database for discovered LoRa mesh nodes.
 */

import { NodeInfoMessage, MeshPacket, UserMessage, PositionMessage, TelemetryMessage } from '../protobuf/types';

export class NodeDB {
  private nodes = new Map<number, NodeInfoMessage>();

  public getNode(nodeNum: number): NodeInfoMessage | undefined {
    return this.nodes.get(nodeNum);
  }

  public getAllNodes(): NodeInfoMessage[] {
    return Array.from(this.nodes.values());
  }

  public getActiveNodes(withinSeconds = 900): NodeInfoMessage[] {
    const cutoff = Math.floor(Date.now() / 1000) - withinSeconds;
    return this.getAllNodes().filter((n) => (n.last_heard ?? 0) >= cutoff);
  }

  public getOrCreateNode(nodeNum: number): NodeInfoMessage {
    let node = this.nodes.get(nodeNum);
    if (!node) {
      node = {
        num: nodeNum,
        last_heard: Math.floor(Date.now() / 1000)
      };
      this.nodes.set(nodeNum, node);
    }
    return node;
  }

  public updateFromPacket(packet: MeshPacket): NodeInfoMessage {
    const node = this.getOrCreateNode(packet.from);
    node.last_heard = packet.rx_time ?? Math.floor(Date.now() / 1000);
    if (packet.rx_snr !== undefined) {
      node.snr = packet.rx_snr;
    }
    if (packet.channel !== undefined) {
      node.channel = packet.channel;
    }
    if (packet.hop_start !== undefined && packet.hop_limit !== undefined) {
      node.hops_away = Math.max(0, packet.hop_start - packet.hop_limit);
    }
    return node;
  }

  public updateNodeInfo(info: NodeInfoMessage): void {
    const existing = this.getOrCreateNode(info.num);
    Object.assign(existing, info);
    this.nodes.set(info.num, existing);
  }

  public updateUser(nodeNum: number, user: UserMessage): void {
    const node = this.getOrCreateNode(nodeNum);
    node.user = user;
  }

  public updatePosition(nodeNum: number, position: PositionMessage): void {
    const node = this.getOrCreateNode(nodeNum);
    node.position = position;
  }

  public updateTelemetry(nodeNum: number, telemetry: TelemetryMessage): void {
    const node = this.getOrCreateNode(nodeNum);
    if (telemetry.device_metrics) {
      node.device_metrics = telemetry.device_metrics;
    }
  }

  public removeNode(nodeNum: number): boolean {
    return this.nodes.delete(nodeNum);
  }

  public clear(): void {
    this.nodes.clear();
  }

  public get size(): number {
    return this.nodes.size;
  }
}
