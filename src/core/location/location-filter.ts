/**
 * @fileoverview Location Filter Engine (Deadband, Throttle, Geofence Safe Radius)
 * Conforms to FR-002, FR-006, NFR-007, NFR-008, and UC-02
 */

import { encodeGeohash } from './geohash';
import { AuditLogger } from '../transport/audit-logger';
import type { DebouncedGeofenceEvaluation } from '../domain/types';
export type { DebouncedGeofenceEvaluation } from '../domain/types';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
  batteryLevel?: number;
  timestamp?: number;
}

export interface GeofenceEvaluation {
  status: 'INSIDE' | 'WARNING' | 'BREACH';
  distanceMeters: number;
  safeRadiusMeters: number;
  deviationMeters: number; // positive if breached
  message: string;
}

export interface LocationFilterConfig {
  deadbandMeters?: number; // Minimum movement distance required to transmit (default: 5m)
  minIntervalMs?: number;   // Minimum time elapsed required to transmit (default: 5000ms)
  adaptiveBatterySavings?: boolean; // Increases interval if battery is low
}

/**
 * Calculates Great-Circle distance between two coordinates in meters (Haversine formula)
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export class LocationFilter {
  private lastTransmittedLocation: LocationCoordinates | null = null;
  private lastTransmittedTimestamp = 0;
  private deadbandMeters: number;
  private minIntervalMs: number;
  private adaptiveBattery: boolean;

  constructor(config: LocationFilterConfig = {}) {
    this.deadbandMeters = config.deadbandMeters ?? 5; // 5 meters default deadband
    this.minIntervalMs = config.minIntervalMs ?? 5000; // 5 seconds default throttle
    this.adaptiveBattery = config.adaptiveBatterySavings ?? true;
  }

  /**
   * Evaluates if a raw location sample should be transmitted or filtered out (Deadband + Throttle)
   */
  public evaluateTransmission(
    incoming: LocationCoordinates,
    isEmergency = false
  ): { shouldTransmit: boolean; reason: 'OK' | 'DEADBAND_FILTERED' | 'THROTTLED'; distanceMoved: number } {
    const now = incoming.timestamp ?? Date.now();

    // Emergency / SOS signals ALWAYS bypass all filters
    if (isEmergency) {
      this.lastTransmittedLocation = incoming;
      this.lastTransmittedTimestamp = now;
      return { shouldTransmit: true, reason: 'OK', distanceMoved: 0 };
    }

    if (!this.lastTransmittedLocation) {
      this.lastTransmittedLocation = incoming;
      this.lastTransmittedTimestamp = now;
      return { shouldTransmit: true, reason: 'OK', distanceMoved: 0 };
    }

    const distanceMoved = calculateHaversineDistanceMeters(
      this.lastTransmittedLocation.latitude,
      this.lastTransmittedLocation.longitude,
      incoming.latitude,
      incoming.longitude
    );

    // 1. Deadband check: has user moved enough?
    if (distanceMoved < this.deadbandMeters) {
      return { shouldTransmit: false, reason: 'DEADBAND_FILTERED', distanceMoved };
    }

    // 2. Throttle check: has enough time elapsed?
    let dynamicMinInterval = this.minIntervalMs;
    if (this.adaptiveBattery && incoming.batteryLevel !== undefined) {
      if (incoming.batteryLevel <= 15) {
        dynamicMinInterval = Math.max(dynamicMinInterval, 30000); // 30s in critical battery mode
      } else if (incoming.batteryLevel <= 30) {
        dynamicMinInterval = Math.max(dynamicMinInterval, 15000); // 15s in low battery mode
      }
    }

    const elapsed = now - this.lastTransmittedTimestamp;
    if (elapsed < dynamicMinInterval) {
      return { shouldTransmit: false, reason: 'THROTTLED', distanceMoved };
    }

    // Passed both filters
    this.lastTransmittedLocation = incoming;
    this.lastTransmittedTimestamp = now;
    return { shouldTransmit: true, reason: 'OK', distanceMoved };
  }

  /**
   * Resets filter internal state
   */
  public reset() {
    this.lastTransmittedLocation = null;
    this.lastTransmittedTimestamp = 0;
  }

  /**
   * Evaluates participant distance against a safe geofence radius (UC-02)
   */
  public static evaluateGeofence(
    hikerLocation: { latitude: number; longitude: number; name?: string },
    anchorLocation: { latitude: number; longitude: number },
    safeRadiusMeters = 500
  ): GeofenceEvaluation {
    const distanceMeters = calculateHaversineDistanceMeters(
      hikerLocation.latitude,
      hikerLocation.longitude,
      anchorLocation.latitude,
      anchorLocation.longitude
    );

    const deviationMeters = distanceMeters - safeRadiusMeters;

    if (deviationMeters > 0) {
      const message = `Внимание: участник ${hikerLocation.name || 'Турист'} покинул безопасную зону на ${Math.round(deviationMeters)} м (дистанция: ${Math.round(distanceMeters)} м, лимит: ${safeRadiusMeters} м)`;
      AuditLogger.log('SECURITY', `[ГЕОЗОНА] ВЫХОД ИЗ БЕЗОПАСНОГО РАДИУСА: ${message}`);
      return {
        status: 'BREACH',
        distanceMeters,
        safeRadiusMeters,
        deviationMeters,
        message,
      };
    }

    if (distanceMeters > safeRadiusMeters * 0.85) {
      const message = `Предупреждение: участник ${hikerLocation.name || 'Турист'} приближается к границе зоны (${Math.round(distanceMeters)} м / ${safeRadiusMeters} м)`;
      return {
        status: 'WARNING',
        distanceMeters,
        safeRadiusMeters,
        deviationMeters: 0,
        message,
      };
    }

    return {
      status: 'INSIDE',
      distanceMeters,
      safeRadiusMeters,
      deviationMeters: 0,
      message: `В пределах безопасного радиуса (${Math.round(distanceMeters)} м)`,
    };
  }

  /**
   * Evaluates participant distance using temporal debounce window and hysteresis
   */
  public static evaluateDebouncedGeofence(
    hikerLocation: { latitude: number; longitude: number; name?: string; hikerId?: string; timestamp?: number },
    anchorLocation: { latitude: number; longitude: number },
    safeRadiusMeters = 500,
    debouncer?: GeofenceDebouncer,
    isEmergency = false
  ): DebouncedGeofenceEvaluation {
    const id = hikerLocation.hikerId || hikerLocation.name || 'default-hiker';
    const engine = debouncer || defaultGlobalDebouncer;
    return engine.evaluate(id, hikerLocation, anchorLocation, safeRadiusMeters, isEmergency);
  }

  /**
   * Generates geohash spatial token for location
   */
  public static getGeohash(latitude: number, longitude: number, precision = 9): string {
    return encodeGeohash(latitude, longitude, precision);
  }
}

export interface GeofenceSample {
  latitude: number;
  longitude: number;
  timestamp: number;
  distanceMeters: number;
  status: 'INSIDE' | 'WARNING' | 'BREACH';
}

export interface HikerDebounceState {
  samples: GeofenceSample[];
  confirmedStatus: 'INSIDE' | 'WARNING' | 'BREACH';
  consecutiveBreachCount: number;
  lastUpdatedAt: number;
}

export interface DebouncerOptions {
  windowSize?: number;          // Consecutive samples needed to confirm breach (default: 3)
  hysteresisMeters?: number;    // Deadband buffer to return to inside (default: 15m)
  maxSpeedMps?: number;         // Speed threshold for GPS teleportation glitch (default: 15 m/s)
  historyTtlMs?: number;        // History TTL (default: 10 minutes)
}

/**
 * Временной фильтр подтверждения выхода из геозоны (Debouncer)
 * - Скользящее окно из N последовательных точек для предотвращения ложных тревог от скачков GPS
 * - Отсечение нереалистичных скоростей перемещения (глитчи мультипути / переотражения)
 * - Гистерезис 15м на границе геозоны для исключения дребезга (flapping)
 * - Мгновенный байпас при сигнале бедствия SOS (isEmergency === true)
 */
export class GeofenceDebouncer {
  private states = new Map<string, HikerDebounceState>();
  public readonly windowSize: number;
  public readonly hysteresisMeters: number;
  public readonly maxSpeedMps: number;
  public readonly historyTtlMs: number;

  constructor(options: DebouncerOptions = {}) {
    this.windowSize = options.windowSize ?? 3;
    this.hysteresisMeters = options.hysteresisMeters ?? 15;
    this.maxSpeedMps = options.maxSpeedMps ?? 15;
    this.historyTtlMs = options.historyTtlMs ?? 600_000; // 10 мин
  }

  public evaluate(
    hikerId: string,
    hikerLocation: { latitude: number; longitude: number; name?: string; timestamp?: number },
    anchorLocation: { latitude: number; longitude: number },
    safeRadiusMeters = 500,
    isEmergency = false
  ): DebouncedGeofenceEvaluation {
    const now = hikerLocation.timestamp ?? Date.now();

    // 1. Очистка устаревших состояний по TTL
    this.pruneExpired(now);

    // 2. Получение или инициализация состояния участника
    let state = this.states.get(hikerId);
    if (!state) {
      state = {
        samples: [],
        confirmedStatus: 'INSIDE',
        consecutiveBreachCount: 0,
        lastUpdatedAt: now,
      };
      this.states.set(hikerId, state);
    }

    // 3. Расчет прямого геодезического расстояния
    const rawDistM = calculateHaversineDistanceMeters(
      hikerLocation.latitude,
      hikerLocation.longitude,
      anchorLocation.latitude,
      anchorLocation.longitude
    );

    // 4. Фильтр аномалий телепортации GPS (отсечение выбросов)
    let flappingDetected = false;
    let smoothedDistM = rawDistM;

    const lastSample = state.samples[state.samples.length - 1];
    if (lastSample && now > lastSample.timestamp) {
      const dtSec = (now - lastSample.timestamp) / 1000;
      if (dtSec >= 0.5 && dtSec < 120) {
        const stepDistM = calculateHaversineDistanceMeters(
          lastSample.latitude,
          lastSample.longitude,
          hikerLocation.latitude,
          hikerLocation.longitude
        );
        const speed = stepDistM / dtSec;
        if (speed > this.maxSpeedMps && !isEmergency) {
          flappingDetected = true;
          // Сглаживание: экспоненциальное взвешивание с предыдущей точкой
          smoothedDistM = (lastSample.distanceMeters * 2 + rawDistM) / 3;
          AuditLogger.log(
            'SECURITY',
            `[ГЕОЗОНА] Скачок GPS ${hikerLocation.name || hikerId} (${speed.toFixed(1)} м/с): сглажено с ${rawDistM.toFixed(1)}м до ${smoothedDistM.toFixed(1)}м`
          );
        }
      }
    }

    const effectiveDist = smoothedDistM;

    // 5. Определение статуса одиночного замера
    let sampleStatus: 'INSIDE' | 'WARNING' | 'BREACH';
    if (effectiveDist > safeRadiusMeters) {
      sampleStatus = 'BREACH';
    } else if (effectiveDist > safeRadiusMeters * 0.85) {
      sampleStatus = 'WARNING';
    } else {
      sampleStatus = 'INSIDE';
    }

    if (sampleStatus === 'BREACH') {
      state.consecutiveBreachCount++;
    } else {
      state.consecutiveBreachCount = 0;
    }

    state.samples.push({
      latitude: hikerLocation.latitude,
      longitude: hikerLocation.longitude,
      timestamp: now,
      distanceMeters: effectiveDist,
      status: sampleStatus,
    });
    if (state.samples.length > 10) {
      state.samples.shift();
    }
    state.lastUpdatedAt = now;

    // 6. Определение подтвержденного статуса с учетом Debounce-окна и гистерезиса
    let finalStatus: 'INSIDE' | 'WARNING' | 'BREACH';
    let isConfirmed = false;

    if (isEmergency) {
      // Экстренный SOS обходит буфер и сразу фиксирует тревогу
      state.confirmedStatus = 'BREACH';
      isConfirmed = true;
      finalStatus = 'BREACH';
    } else if (state.confirmedStatus === 'BREACH') {
      // Если ранее подтвержден BREACH — возврат только при преодолении порога гистерезиса
      const returnThreshold = safeRadiusMeters - this.hysteresisMeters;
      if (effectiveDist <= returnThreshold) {
        state.confirmedStatus = 'INSIDE';
        isConfirmed = true;
        finalStatus = 'INSIDE';
      } else if (effectiveDist <= safeRadiusMeters) {
        finalStatus = 'WARNING';
        isConfirmed = true;
      } else {
        finalStatus = 'BREACH';
        isConfirmed = true;
      }
    } else {
      // Ранее был INSIDE или WARNING
      if (sampleStatus === 'BREACH') {
        if (state.consecutiveBreachCount >= this.windowSize) {
          state.confirmedStatus = 'BREACH';
          isConfirmed = true;
          finalStatus = 'BREACH';
        } else {
          // Окно еще не заполнено — переводим в WARNING без паники
          finalStatus = 'WARNING';
          isConfirmed = false;
        }
      } else {
        state.confirmedStatus = sampleStatus;
        isConfirmed = true;
        finalStatus = sampleStatus;
      }
    }

    const deviationMeters = finalStatus === 'BREACH'
      ? Number((effectiveDist - safeRadiusMeters).toFixed(1))
      : 0;

    let message: string;
    if (finalStatus === 'BREACH') {
      const prefix = isConfirmed ? 'Тревога (подтверждено)' : 'Внимание';
      message = `${prefix}: участник ${hikerLocation.name || 'Турист'} покинул безопасную зону на ${Math.round(deviationMeters)} м (дистанция: ${Math.round(effectiveDist)} м, лимит: ${safeRadiusMeters} м)`;
      if (isConfirmed) {
        AuditLogger.log('SECURITY', `[ГЕОЗОНА] ПОДТВЕРЖДЕННЫЙ ВЫХОД: ${message}`);
      }
    } else if (finalStatus === 'WARNING') {
      message = `Предупреждение: участник ${hikerLocation.name || 'Турист'} приближается к границе зоны (${Math.round(effectiveDist)} м / ${safeRadiusMeters} м)`;
    } else {
      message = `В пределах безопасного радиуса (${Math.round(effectiveDist)} м)`;
    }

    return {
      status: finalStatus,
      distanceMeters: Number(rawDistM.toFixed(1)),
      safeRadiusMeters,
      deviationMeters,
      message,
      isConfirmed,
      consecutiveBreachCount: state.consecutiveBreachCount,
      smoothedDistanceMeters: Number(effectiveDist.toFixed(1)),
      flappingDetected,
    };
  }

  public reset(hikerId?: string) {
    if (hikerId) {
      this.states.delete(hikerId);
    } else {
      this.states.clear();
    }
  }

  private pruneExpired(now: number) {
    for (const [id, state] of this.states.entries()) {
      if (now - state.lastUpdatedAt > this.historyTtlMs) {
        this.states.delete(id);
      }
    }
  }
}

export const defaultGlobalDebouncer = new GeofenceDebouncer();

