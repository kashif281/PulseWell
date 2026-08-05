import { Injectable, Logger } from '@nestjs/common';

export interface CommuteResult {
  distanceKm: number;
  durationMin: number;
}

@Injectable()
export class CommuteService {
  private readonly logger = new Logger(CommuteService.name);

  async calculateCommute(
    homeLat: number,
    homeLng: number,
    officeLat: number,
    officeLng: number,
  ): Promise<CommuteResult | null> {
    try {
      const coords = `${homeLng},${homeLat};${officeLng},${officeLat}`;
      const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`;

      const res = await fetch(url);
      if (!res.ok) return this.haversineFallback(homeLat, homeLng, officeLat, officeLng);

      const data = (await res.json()) as {
        routes?: Array<{ distance: number; duration: number }>;
      };

      const route = data.routes?.[0];
      if (!route) return this.haversineFallback(homeLat, homeLng, officeLat, officeLng);

      return {
        distanceKm: Math.round((route.distance / 1000) * 10) / 10,
        durationMin: Math.round(route.duration / 60),
      };
    } catch (err) {
      this.logger.warn(`OSRM commute failed: ${err}`);
      return this.haversineFallback(homeLat, homeLng, officeLat, officeLng);
    }
  }

  private haversineFallback(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): CommuteResult {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const distanceKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
    const durationMin = Math.round((distanceKm / 40) * 60);
    return { distanceKm, durationMin };
  }
}
