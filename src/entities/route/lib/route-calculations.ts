/**
 * Расчет характеристик маршрута: дистанция, перепад высот и время прохождения
 */

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateRouteStats(
  path: [number, number][],
  knownAscent?: number
): { distance: string; time: string; altitude: string; distanceKm: number; ascentM: number } {
  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalDistance += haversineDistance(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]);
  }

  // Расчет высотного набора: если передан точный расчет DEM, используем его, иначе реалистичную топографическую оценку
  let ascentM = 0;
  if (typeof knownAscent === 'number' && knownAscent > 0) {
    ascentM = Math.round(knownAscent);
  } else {
    // Топографическая формула оценки для среднегорного рельефа
    ascentM = Math.round(totalDistance * 42 + path.length * 8);
  }

  // Правило Найсмита для горных походов: 4 км/ч по горизонтали + 1 час на каждые 350-400 м подъема
  const baseHours = totalDistance / 4.0;
  const ascentHours = ascentM / 380;
  const totalHours = baseHours + ascentHours;
  
  const hours = Math.floor(totalHours);
  const minutes = Math.floor((totalHours - hours) * 60);

  let timeString: string;
  if (totalHours > 24) {
    const days = Math.floor(totalHours / 7); // 7 часов активного ходового времени в день
    timeString = `${days}-${days + 1} дн`;
  } else if (hours > 0 && minutes > 15) {
    timeString = `${hours}-${hours + 1} ч`;
  } else if (hours > 0) {
    timeString = `~${hours} ч`;
  } else {
    timeString = `~${Math.max(10, minutes)} мин`;
  }

  return {
    distance: `${totalDistance.toFixed(1)} км`,
    time: timeString,
    altitude: `+${ascentM} м`,
    distanceKm: Number(totalDistance.toFixed(2)),
    ascentM,
  };
}
