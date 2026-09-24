import { describe, it, expect } from 'vitest';
import { generateGpxString } from '../gpx-exporter';
import type { Route } from '../../domain/types';

describe('GPX Exporter', () => {
  const mockRoutes: Route[] = [
    {
      id: 'test-1',
      name: 'Эльбрус <Тест & Проверка>',
      location: 'Кавказ',
      difficulty: 'Сложно',
      distance: '25 км',
      time: '8 ч',
      type: 'Горный',
      altitude: '5642 м',
      coordinates: '43.3550, 42.4392',
      path: [
        [43.285, 42.518],
        [43.295, 42.516],
      ],
    },
    {
      id: 'test-2',
      name: 'Таганрогский залив',
      location: 'Ростовская область',
      difficulty: 'Легко',
      distance: '15 км',
      time: '4 ч',
      type: 'Равнинный',
      altitude: '50 м',
      coordinates: '47.1652, 39.2011',
      path: [
        [47.1652, 39.2011],
        [47.1660, 39.1960],
      ],
      isArchived: true,
    },
  ];

  it('generates a valid GPX 1.1 XML document with escaped characters and trackpoints', () => {
    const gpx = generateGpxString(mockRoutes);

    expect(gpx.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(gpx).toContain('<gpx version="1.1"');
    expect(gpx).toContain('Эльбрус &lt;Тест &amp; Проверка&gt;');
    expect(gpx).toContain('<trkpt lat="43.285000" lon="42.518000">');
    expect(gpx).toContain('<ele>5642</ele>');
    expect(gpx).toContain('(В архиве)');
  });
});
