/**
 * @fileoverview Topographic Grid-Based A* Mountain Path Synthesizer
 * Generates terrain-aware paths across off-trail mountain areas by optimizing
 * slope costs, avoiding avalanche-prone gradients (28°-45°) and impassable cliffs (>45°).
 */

import { calculateDistanceMeters, evaluateSegmentSlope } from './terrain-physics';
import { getElevationForCoordinates } from '@/features/elevation/lib/elevation-service';

export interface GridRouterOptions {
  profile?: 'hiking-mountain' | 'trekking' | 'hiking-wet';
  maxSlopeDegrees?: number;
  corridorWidthMeters?: number;
  sampleStepMeters?: number;
}

interface GridNode {
  id: string;
  lat: number;
  lng: number;
  elevation: number;
  gScore: number;
  fScore: number;
  parent: GridNode | null;
}

/**
 * Synthesizes a terrain-aware path between key waypoints when no OSM/BRouter trail exists
 */
export async function synthesizeTerrainAwarePath(
  keyPoints: [number, number][],
  options: GridRouterOptions = {}
): Promise<[number, number][]> {
  if (!keyPoints || keyPoints.length < 2) {
    return keyPoints || [];
  }

  const resultPath: [number, number][] = [];

  for (let seg = 0; seg < keyPoints.length - 1; seg++) {
    const start = keyPoints[seg];
    const finish = keyPoints[seg + 1];

    const segmentPath = await synthesizeSingleSegment(start, finish, options);
    if (resultPath.length > 0 && segmentPath.length > 0) {
      // Avoid duplicating junction point
      resultPath.push(...segmentPath.slice(1));
    } else {
      resultPath.push(...segmentPath);
    }
  }

  return resultPath;
}

/**
 * Computes an A* path over a topographic DEM corridor between two points
 */
async function synthesizeSingleSegment(
  start: [number, number],
  finish: [number, number],
  options: GridRouterOptions
): Promise<[number, number][]> {
  const directDistM = calculateDistanceMeters(start[0], start[1], finish[0], finish[1]);

  // For very short hops (< 60m), return direct line
  if (directDistM < 60) {
    return [start, finish];
  }

  const profile = options.profile || 'hiking-mountain';
  const corridorWidthMeters = options.corridorWidthMeters ?? 400;
  const numSteps = Math.min(24, Math.max(8, Math.round(directDistM / 80)));
  const lateralSteps = 7; // -3, -2, -1, 0, 1, 2, 3 lateral offsets

  const dLat = finish[0] - start[0];
  const dLng = finish[1] - start[1];

  // Perpendicular vector normalized for lateral width
  const len = Math.sqrt(dLat * dLat + dLng * dLng) || 1;
  const perpLatUnit = -dLng / len;
  const perpLngUnit = dLat / len;

  // Degrees per meter approximate conversion at typical latitudes (~43-45 deg)
  const degPerMeterLat = 1 / 111320;
  const degPerMeterLng = 1 / (111320 * Math.cos((start[0] * Math.PI) / 180));

  const lateralOffsetDegLat = perpLatUnit * (corridorWidthMeters / 2) * degPerMeterLat;
  const lateralOffsetDegLng = perpLngUnit * (corridorWidthMeters / 2) * degPerMeterLng;

  // 1. Generate candidate grid coordinates
  const gridCoords: [number, number][] = [];
  const coordIndexMap = new Map<string, number>();

  for (let s = 0; s <= numSteps; s++) {
    const t = s / numSteps;
    const centerLat = start[0] + dLat * t;
    const centerLng = start[1] + dLng * t;

    if (s === 0) {
      gridCoords.push(start);
      coordIndexMap.set(`0_0`, gridCoords.length - 1);
      continue;
    }

    if (s === numSteps) {
      gridCoords.push(finish);
      coordIndexMap.set(`${numSteps}_0`, gridCoords.length - 1);
      continue;
    }

    for (let l = -3; l <= 3; l++) {
      const lateralRatio = l / 3;
      // Parabolic corridor boundary: wider in the middle, narrowing at endpoints
      const corridorEnvelope = Math.sin(t * Math.PI);
      const lat = centerLat + lateralOffsetDegLat * lateralRatio * corridorEnvelope;
      const lng = centerLng + lateralOffsetDegLng * lateralRatio * corridorEnvelope;

      gridCoords.push([lat, lng]);
      coordIndexMap.set(`${s}_${l}`, gridCoords.length - 1);
    }
  }

  // 2. Enrich grid points with DEM elevations
  const elevationsData = await getElevationForCoordinates(gridCoords);
  const elevations = elevationsData.map((d) => d.elevation);

  // 3. Build A* nodes
  const nodes = new Map<string, GridNode>();

  const getNode = (s: number, l: number): GridNode | null => {
    const key = `${s}_${l}`;
    if (nodes.has(key)) return nodes.get(key)!;

    const idx = coordIndexMap.get(key);
    if (idx === undefined) return null;

    const [lat, lng] = gridCoords[idx];
    const elevation = elevations[idx] || 0;

    const node: GridNode = {
      id: key,
      lat,
      lng,
      elevation,
      gScore: Infinity,
      fScore: Infinity,
      parent: null,
    };
    nodes.set(key, node);
    return node;
  };

  const startNode = getNode(0, 0);
  const finishNode = getNode(numSteps, 0);

  if (!startNode || !finishNode) {
    return [start, finish];
  }

  startNode.gScore = 0;
  startNode.fScore = calculateDistanceMeters(startNode.lat, startNode.lng, finishNode.lat, finishNode.lng);

  const openSet = new Set<GridNode>([startNode]);
  const closedSet = new Set<string>();

  // Profile-based slope penalties
  const slopePenaltyMultiplier =
    profile === 'hiking-wet' ? 3.0 : profile === 'trekking' ? 1.8 : 1.2;

  while (openSet.size > 0) {
    // Pick node with lowest fScore
    let current: GridNode | null = null;
    for (const node of openSet) {
      if (!current || node.fScore < current.fScore) {
        current = node;
      }
    }

    if (!current) break;

    if (current.id === finishNode.id) {
      // Reconstruct path
      const path: [number, number][] = [];
      let curr: GridNode | null = current;
      while (curr) {
        path.unshift([curr.lat, curr.lng]);
        curr = curr.parent;
      }
      return path;
    }

    openSet.delete(current);
    closedSet.add(current.id);

    const [sStr, lStr] = current.id.split('_');
    const s = parseInt(sStr, 10);
    const l = parseInt(lStr, 10);

    const nextStep = s + 1;
    if (nextStep > numSteps) continue;

    // Determine neighbor candidates in next step
    const neighborLateralIndices: number[] = nextStep === numSteps ? [0] : [-3, -2, -1, 0, 1, 2, 3];

    for (const nL of neighborLateralIndices) {
      // Restrict lateral jump to avoid zig-zag noise
      if (s > 0 && Math.abs(nL - l) > 2) continue;

      const neighbor = getNode(nextStep, nL);
      if (!neighbor || closedSet.has(neighbor.id)) continue;

      const segSlope = evaluateSegmentSlope(
        [current.lat, current.lng, current.elevation],
        [neighbor.lat, neighbor.lng, neighbor.elevation]
      );

      // Block impassable cliffs (>45°)
      if (Math.abs(segSlope.slopeDeg) > 46) {
        continue;
      }

      // Penalty calculation
      let slopeCostMultiplier = 1.0;
      const absSlope = Math.abs(segSlope.slopeDeg);

      if (absSlope > 12) {
        slopeCostMultiplier += ((absSlope - 12) / 10) * slopePenaltyMultiplier;
      }

      // Avalanche zone penalty (28° - 45°)
      if (absSlope >= 28 && absSlope <= 45) {
        slopeCostMultiplier *= profile === 'hiking-wet' ? 3.5 : 2.0;
      }

      // Climbing penalty (extra metabolic effort for positive ascent)
      if (segSlope.elevDiffM > 0) {
        slopeCostMultiplier += (segSlope.elevDiffM / segSlope.distanceM) * 2.0;
      }

      const stepCost = segSlope.distanceM * slopeCostMultiplier;
      const tentativeGScore = current.gScore + stepCost;

      if (tentativeGScore < neighbor.gScore) {
        neighbor.parent = current;
        neighbor.gScore = tentativeGScore;
        const hDist = calculateDistanceMeters(neighbor.lat, neighbor.lng, finishNode.lat, finishNode.lng);
        neighbor.fScore = tentativeGScore + hDist;

        if (!openSet.has(neighbor)) {
          openSet.add(neighbor);
        }
      }
    }
  }

  // Fallback to direct interpolated points if path search didn't complete
  const fallbackPoints: [number, number][] = [];
  for (let s = 0; s <= numSteps; s++) {
    const t = s / numSteps;
    fallbackPoints.push([start[0] + dLat * t, start[1] + dLng * t]);
  }
  return fallbackPoints;
}
