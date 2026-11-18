/**
 * Distress Beacon & SOS Protocol Codec.
 * High-priority emergency broadcast (Priority.ALERT = 110, target = 0xFFFFFFFF, want_ack = true).
 */

import { MeshPacket, PacketPriority, PortNum, NODENUM_BROADCAST } from '../protobuf/types';
import { encodeGps, buildPositionPacket } from './gps-codec';
import { encodePosition, decodePosition } from '../protobuf/position';

export interface SosBeaconOptions {
  fromNode: number;
  senderName: string;
  emergencyType: string; // 'MEDICAL_EMERGENCY' | 'LOST_PERSON' | 'GEAR_FAILURE' | 'SOS_SIGNAL'
  latitude: number;
  longitude: number;
  altitude?: number;
  batteryPercent?: number;
  notes?: string;
  hopLimit?: number;
}

export interface ParsedSosAlert {
  fromNode: number;
  emergencyType: string;
  senderName?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  batteryPercent?: number;
  notes?: string;
  timestamp: number;
  rawText?: string;
}

export class DistressCodec {
  public static buildTextPayload(options: SosBeaconOptions): string {
    const latStr = `${options.latitude >= 0 ? '+' : ''}${options.latitude.toFixed(4)}`;
    const lonStr = `${options.longitude >= 0 ? '+' : ''}${options.longitude.toFixed(4)}`;
    const batStr = options.batteryPercent !== undefined ? ` | Bat: ${options.batteryPercent}%` : '';
    const altStr = options.altitude !== undefined ? ` | Alt: ${Math.round(options.altitude)}m` : '';
    const notesStr = options.notes ? ` | ${options.notes}` : '';

    return `[SOS:${options.emergencyType}] Hiker: ${options.senderName} | Coords: ${latStr}, ${lonStr}${altStr}${batStr}${notesStr}`;
  }

  public static buildSosTextPacket(options: SosBeaconOptions): MeshPacket {
    const text = this.buildTextPayload(options);
    const textBytes = new TextEncoder().encode(text);

    return {
      from: options.fromNode,
      to: NODENUM_BROADCAST,
      channel: 0,
      id: Math.floor(Math.random() * 0xffffffff),
      hop_limit: options.hopLimit ?? 5,
      want_ack: true,
      priority: PacketPriority.ALERT, // Priority 110
      decoded: {
        portnum: PortNum.TEXT_MESSAGE_APP,
        payload: textBytes,
        want_response: true
      }
    };
  }

  public static buildSosPositionPacket(options: SosBeaconOptions): MeshPacket {
    const pos = encodeGps(options.latitude, options.longitude, options.altitude);
    const posBytes = encodePosition(pos);

    return {
      from: options.fromNode,
      to: NODENUM_BROADCAST,
      channel: 0,
      id: Math.floor(Math.random() * 0xffffffff),
      hop_limit: options.hopLimit ?? 5,
      want_ack: true,
      priority: PacketPriority.ALERT, // Priority 110
      decoded: {
        portnum: PortNum.POSITION_APP,
        payload: posBytes,
        want_response: true
      }
    };
  }

  public static buildSosBeacon(options: SosBeaconOptions): {
    textPacket: MeshPacket;
    positionPacket: MeshPacket;
  } {
    return {
      textPacket: this.buildSosTextPacket(options),
      positionPacket: this.buildSosPositionPacket(options)
    };
  }

  public static isDistressPacket(packet: MeshPacket): boolean {
    if (packet.priority >= PacketPriority.ALERT) {
      return true;
    }
    if (packet.decoded && packet.decoded.portnum === PortNum.TEXT_MESSAGE_APP) {
      const text = new TextDecoder().decode(packet.decoded.payload);
      if (text.startsWith('[SOS:') || text.startsWith('SOS:')) {
        return true;
      }
    }
    return false;
  }

  public static parseSosPacket(packet: MeshPacket): ParsedSosAlert | null {
    if (!this.isDistressPacket(packet)) {
      return null;
    }

    const alert: ParsedSosAlert = {
      fromNode: packet.from,
      emergencyType: 'SOS_SIGNAL',
      timestamp: packet.rx_time ? packet.rx_time * 1000 : Date.now()
    };

    if (packet.decoded) {
      if (packet.decoded.portnum === PortNum.POSITION_APP) {
        try {
          const pos = decodePosition(packet.decoded.payload);
          alert.latitude = pos.latitude_i / 1e7;
          alert.longitude = pos.longitude_i / 1e7;
          alert.altitude = pos.altitude;
        } catch {
          // ignore decode error
        }
      } else if (packet.decoded.portnum === PortNum.TEXT_MESSAGE_APP) {
        const text = new TextDecoder().decode(packet.decoded.payload);
        alert.rawText = text;

        // Parse regex: [SOS:TYPE] Hiker: NAME | Coords: LAT, LON | ...
        const matchType = text.match(/\[SOS:([^\]]+)\]/);
        if (matchType) {
          alert.emergencyType = matchType[1];
        }
        const matchHiker = text.match(/Hiker:\s*([^|]+)/);
        if (matchHiker) {
          alert.senderName = matchHiker[1].trim();
        }
        const matchCoords = text.match(/Coords:\s*([+-]?\d+\.?\d*),\s*([+-]?\d+\.?\d*)/);
        if (matchCoords) {
          alert.latitude = parseFloat(matchCoords[1]);
          alert.longitude = parseFloat(matchCoords[2]);
        }
        const matchBat = text.match(/Bat:\s*(\d+)%/);
        if (matchBat) {
          alert.batteryPercent = parseInt(matchBat[1], 10);
        }
      }
    }

    return alert;
  }
}
