import { describe, it, expect } from 'vitest';
import {
  detectRouteRegion,
  autoDetectRouteType,
  autoDetectRoutingProfile,
  autoDetectDifficulty,
} from '../lib/auto-classification-service';

describe('Auto-Classification Service', () => {
  describe('detectRouteRegion', () => {
    it('returns "Не определено" for empty route', () => {
      expect(detectRouteRegion([])).toBe('Не определено');
    });

    it('identifies Central Caucasus (Elbrus)', () => {
      const elbrusCoords: [number, number][] = [
        [43.349, 42.445],
        [43.355, 42.440],
      ];
      const region = detectRouteRegion(elbrusCoords);
      expect(region).toContain('Приэльбрусье');
    });

    it('identifies Western Caucasus (Dombay)', () => {
      const dombayCoords: [number, number][] = [
        [43.29, 41.62],
        [43.30, 41.63],
      ];
      const region = detectRouteRegion(dombayCoords);
      expect(region).toContain('Домбай');
    });

    it('identifies Krasnaya Polyana / Sochi', () => {
      const kpCoords: [number, number][] = [
        [43.68, 40.21],
        [43.69, 40.22],
      ];
      const region = detectRouteRegion(kpCoords);
      expect(region).toContain('Красная Поляна');
    });

    it('identifies Altai Mountains (Belukha)', () => {
      const altaiCoords: [number, number][] = [
        [49.80, 86.58],
        [49.81, 86.59],
      ];
      const region = detectRouteRegion(altaiCoords);
      expect(region).toContain('Алтай');
    });

    it('identifies Baikal / BBT', () => {
      const baikalCoords: [number, number][] = [
        [51.88, 104.95],
        [51.89, 104.96],
      ];
      const region = detectRouteRegion(baikalCoords);
      expect(region).toContain('Байкал');
    });

    it('identifies Ergaki / Sayany', () => {
      const sayanyCoords: [number, number][] = [
        [52.83, 93.45],
        [52.84, 93.46],
      ];
      const region = detectRouteRegion(sayanyCoords);
      expect(region).toContain('Ергаки');
    });

    it('identifies Khibiny (Kola Peninsula)', () => {
      const khibinyCoords: [number, number][] = [
        [67.65, 33.65],
        [67.66, 33.66],
      ];
      const region = detectRouteRegion(khibinyCoords);
      expect(region).toContain('Хибины');
    });

    it('identifies Kamchatka Volcanoes', () => {
      const kamchatkaCoords: [number, number][] = [
        [55.85, 160.64],
        [55.86, 160.65],
      ];
      const region = detectRouteRegion(kamchatkaCoords);
      expect(region).toContain('Камчатка');
    });

    it('identifies Crimean Mountains', () => {
      const crimeaCoords: [number, number][] = [
        [44.75, 34.25],
        [44.76, 34.26],
      ];
      const region = detectRouteRegion(crimeaCoords);
      expect(region).toContain('Крым');
    });

    it('identifies Alps (Mont Blanc)', () => {
      const alpsCoords: [number, number][] = [
        [45.83, 6.86],
        [45.84, 6.87],
      ];
      const region = detectRouteRegion(alpsCoords);
      expect(region).toContain('Альпы');
    });

    it('falls back to coordinates for unknown remote locations', () => {
      const remoteCoords: [number, number][] = [
        [15.1234, 45.5678],
      ];
      const region = detectRouteRegion(remoteCoords);
      expect(region).toContain('15.12° с.ш., 45.57° в.д.');
    });
  });

  describe('autoDetectRouteType', () => {
    it('classifies as "Горный" when elevation is high', () => {
      expect(autoDetectRouteType({ maxElevationM: 1500 })).toBe('Горный');
    });

    it('classifies as "Горный" when slope is steep', () => {
      expect(autoDetectRouteType({ maxSlopeDeg: 20 })).toBe('Горный');
    });

    it('classifies as "Горный" when ascent is significant', () => {
      expect(autoDetectRouteType({ ascentM: 350 })).toBe('Горный');
    });

    it('classifies as "Равнинный" when flat and low altitude', () => {
      expect(
        autoDetectRouteType({
          maxElevationM: 180,
          maxSlopeDeg: 4,
          ascentM: 50,
        })
      ).toBe('Равнинный');
    });

    it('supports array of coordinates in mountain region', () => {
      const elbrusCoords: [number, number][] = [
        [43.349, 42.445],
        [43.355, 42.440],
      ];
      expect(autoDetectRouteType(elbrusCoords)).toBe('Горный');
    });
  });

  describe('autoDetectRoutingProfile', () => {
    it('selects "hiking-mountain" for Caucasus coordinates', () => {
      const coords: [number, number][] = [[43.35, 42.44]];
      expect(autoDetectRoutingProfile(coords)).toBe('hiking-mountain');
    });

    it('selects "hiking-mountain" when slope >= 25 deg', () => {
      const coords: [number, number][] = [[55.75, 37.61]]; // Moscow
      expect(autoDetectRoutingProfile(coords, { maxSlopeDeg: 28 })).toBe('hiking-mountain');
    });

    it('selects "trekking" for gentle terrain outside mountain polygons', () => {
      const coords: [number, number][] = [[55.75, 37.61]]; // Moscow
      expect(autoDetectRoutingProfile(coords, { maxSlopeDeg: 5, maxElevationM: 160 })).toBe(
        'trekking'
      );
    });
  });

  describe('autoDetectDifficulty', () => {
    it('maps SAC T1 and gentle elevation to "Легко"', () => {
      expect(
        autoDetectDifficulty({
          sacDifficulty: 'T1',
          ascentM: 80,
          distanceKm: 4,
        })
      ).toBe('Легко');
    });

    it('maps SAC T2 or moderate ascent to "Средне"', () => {
      expect(
        autoDetectDifficulty({
          sacDifficulty: 'T2',
          ascentM: 300,
          distanceKm: 8,
        })
      ).toBe('Средне');
    });

    it('maps SAC T3 or steep ascent to "Сложно"', () => {
      expect(
        autoDetectDifficulty({
          sacDifficulty: 'T3',
          ascentM: 800,
          distanceKm: 16,
        })
      ).toBe('Сложно');
    });

    it('maps SAC T4 or high alpine parameters to "Очень сложно"', () => {
      expect(
        autoDetectDifficulty({
          sacDifficulty: 'T4',
          ascentM: 1500,
          maxSlopeDeg: 38,
          distanceKm: 28,
        })
      ).toBe('Очень сложно');
    });
  });
});
