/**
 * Calculates the Haversine distance between two points on the Earth.
 * @param lat1 Latitude of the first point.
 * @param lon1 Longitude of the first point.
 * @param lat2 Latitude of the second point.
 * @param lon2 Longitude of the second point.
 * @returns The distance in kilometers.
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates the total distance, estimated time, and a mock altitude gain for a given route path.
 * @param path An array of [latitude, longitude] points.
 * @returns An object containing distance (km), time (hours), and altitude (meters).
 */
export function calculateRouteStats(path: [number, number][]): { distance: string; time: string; altitude: string } {
  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalDistance += haversineDistance(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]);
  }

  // --- Altitude Calculation ---
  // NOTE: This is a simplified mock calculation because we cannot access a real elevation API.
  // In a real application, you would query an API for each point's elevation.
  // This simulates some elevation gain based on the number of points.
  const mockAltitudeGain = Math.floor(totalDistance * 50 + path.length * 10 + Math.random() * 200);

  // --- Time Calculation (Naismith's Rule variant) ---
  // Base speed: 4 km/h
  // Additional time: 1 hour for every 400m of ascent
  const baseHours = totalDistance / 4;
  const ascentHours = mockAltitudeGain / 400;
  const totalHours = baseHours + ascentHours;
  
  const hours = Math.floor(totalHours);
  const minutes = Math.floor((totalHours - hours) * 60);

  let timeString: string;
  if (hours > 0 && minutes > 15) {
      timeString = `${hours}-${hours + 1} ч`;
  } else if (hours > 0) {
      timeString = `~${hours} ч`;
  } else {
      timeString = `~${minutes} мин`;
  }
  if (totalHours > 24) {
     const days = Math.floor(totalHours / 8); // Assuming 8h of walking per day
     timeString = `${days}-${days+1} д`
  }


  return {
    distance: `${totalDistance.toFixed(1)} км`,
    time: timeString,
    altitude: `${mockAltitudeGain} м`,
  };
}
