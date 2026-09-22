import { generateGpxString } from '../gpx-exporter';
import type { Route } from '../../domain/types';

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

console.log('Testing GPX generation...');
const gpx = generateGpxString(mockRoutes);

// Assertions
if (!gpx.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
  throw new Error('Missing XML header');
}
if (!gpx.includes('<gpx version="1.1"')) {
  throw new Error('Missing GPX 1.1 tag');
}
if (!gpx.includes('Эльбрус &lt;Тест &amp; Проверка&gt;')) {
  throw new Error('XML characters were not properly escaped');
}
if (!gpx.includes('<trkpt lat="43.285000" lon="42.518000">')) {
  throw new Error('Trackpoints not properly formatted');
}
if (!gpx.includes('<ele>5642</ele>')) {
  throw new Error('Elevation not properly extracted');
}
if (!gpx.includes('(В архиве)')) {
  throw new Error('Archive marker missing in description');
}

console.log('✅ ALL GPX TESTS PASSED SUCCESSFULLY!');
