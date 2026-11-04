/**
 * GIS and Spatial Calculation Service for Conakry Urban Transport
 * Handles geodesic distance calculations, coordinate verification,
 * and GeoJSON serialization.
 */

export class GisCalculationService {
  /**
   * Calculates geodesic distance in kilometers between two GPS points [lat, lng]
   * using the Haversine formula (WGS84 ellipsoid approximation).
   */
  static calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's mean radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  }

  /**
   * Calculates total length in km along a series of GeoJSON coordinates [[lng, lat], ...]
   */
  static calculatePolylineDistanceKm(coordinates) {
    if (!coordinates || coordinates.length < 2) return 0;

    let totalKm = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const [lon1, lat1] = coordinates[i];
      const [lon2, lat2] = coordinates[i + 1];
      totalKm += this.calculateDistanceKm(lat1, lon1, lat2, lon2);
    }

    return parseFloat(totalKm.toFixed(2));
  }

  /**
   * Estimates urban travel time in minutes based on distance and route traffic index.
   * Conakry urban corridors average approx 22 km/h due to congestion and passenger boarding.
   */
  static estimateTravelMinutes(distanceKm, averageSpeedKmh = 22) {
    if (!distanceKm || distanceKm <= 0) return 0;
    const hours = distanceKm / averageSpeedKmh;
    return Math.max(5, Math.round(hours * 60));
  }

  /**
   * Converts a transport line into standard GeoJSON Feature format for MapLibre GL.
   */
  static toGeoJsonFeature(line) {
    return {
      type: 'Feature',
      id: line.id,
      properties: {
        id: line.id,
        code: line.code,
        name: line.name,
        colorHex: line.colorHex,
        originName: line.originName,
        destinationName: line.destinationName,
        distanceKm: line.distanceKm,
        estimatedMinutes: line.estimatedMinutes,
        isActive: line.isActive,
      },
      geometry: {
        type: 'LineString',
        coordinates: line.pathCoordinates || [],
      },
    };
  }

  /**
   * Converts stops into GeoJSON Point features.
   */
  static stopsToGeoJson(stops) {
    return {
      type: 'FeatureCollection',
      features: stops.map((s) => ({
        type: 'Feature',
        id: s.id,
        properties: {
          id: s.id,
          code: s.code,
          name: s.name,
          communeName: s.commune?.name || null,
          isSheltered: s.isSheltered,
        },
        geometry: {
          type: 'Point',
          coordinates: [s.longitude, s.latitude], // GeoJSON order: [lng, lat]
        },
      })),
    };
  }
}

export default GisCalculationService;
