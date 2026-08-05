import { Injectable, Logger } from '@nestjs/common';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  displayName?: string;
}

interface NominatimAddress {
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  state?: string;
  country?: string;
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  async geocodeAddress(address: string, city?: string, country?: string): Promise<GeocodeResult | null> {
    const query = [address, city, country].filter(Boolean).join(', ');
    if (!query.trim()) return null;

    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '1');
      const countryLower = country?.toLowerCase() ?? '';
      if (countryLower.includes('pakistan') || countryLower === 'pk') {
        url.searchParams.set('countrycodes', 'pk');
      }

      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'Nura-Wellness-Platform/1.0' },
      });
      if (!res.ok) return null;

      const data = (await res.json()) as Array<{
        lat: string;
        lon: string;
        display_name?: string;
        address?: NominatimAddress;
      }>;

      const hit = data[0];
      if (!hit) return null;

      return {
        latitude: parseFloat(hit.lat),
        longitude: parseFloat(hit.lon),
        city: hit.address?.city ?? hit.address?.town ?? hit.address?.suburb,
        country: hit.address?.country,
        displayName: hit.display_name,
      };
    } catch (err) {
      this.logger.warn(`Geocoding failed for "${query}": ${err}`);
      return null;
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult | null> {
    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.searchParams.set('lat', latitude.toString());
      url.searchParams.set('lon', longitude.toString());
      url.searchParams.set('format', 'json');
      url.searchParams.set('addressdetails', '1');

      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'Nura-Wellness-Platform/1.0' },
      });
      if (!res.ok) return null;

      const hit = (await res.json()) as {
        lat?: string;
        lon?: string;
        display_name?: string;
        address?: NominatimAddress;
      };

      if (!hit.lat || !hit.lon) return null;

      const addr = hit.address;
      const street = [addr?.road, addr?.suburb ?? addr?.neighbourhood].filter(Boolean).join(', ');
      const city = addr?.city ?? addr?.town ?? addr?.suburb;

      return {
        latitude: parseFloat(hit.lat),
        longitude: parseFloat(hit.lon),
        city,
        country: addr?.country,
        displayName: street || hit.display_name,
      };
    } catch (err) {
      this.logger.warn(`Reverse geocoding failed for ${latitude},${longitude}: ${err}`);
      return null;
    }
  }
}
