import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WeatherConditionType } from '@prisma/client';

export interface WeatherSnapshot {
  temperatureC: number;
  feelsLikeC?: number;
  humidity?: number;
  windSpeedKmh: number;
  description: string;
  main: string;
  icon?: string;
  rain1hMm?: number;
  hasGovernmentAdvisory: boolean;
  conditions: WeatherConditionType[];
  fetchedAt?: string;
  raw?: unknown;
}

@Injectable()
export class WeatherApiService {
  private readonly logger = new Logger(WeatherApiService.name);

  constructor(private config: ConfigService) {}

  async fetchWeather(lat: number, lng: number): Promise<WeatherSnapshot | null> {
    const apiKey = this.config.get<string>('OPENWEATHER_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENWEATHER_API_KEY not set — weather checks skipped');
      return null;
    }

    try {
      const url = new URL('https://api.openweathermap.org/data/2.5/weather');
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lng));
      url.searchParams.set('appid', apiKey);
      url.searchParams.set('units', 'metric');

      const res = await fetch(url.toString());
      if (!res.ok) {
        this.logger.warn(`OpenWeather API error: ${res.status}`);
        return null;
      }

      const data = (await res.json()) as {
        main: { temp: number; feels_like: number; humidity: number };
        wind: { speed: number };
        weather: Array<{ main: string; description: string; id: number; icon: string }>;
        rain?: { '1h'?: number };
      };

      const w = data.weather[0];
      const description = (w?.description ?? '').toLowerCase();
      const main = w?.main ?? '';
      const rain1h = data.rain?.['1h'] ?? 0;
      const windSpeedKmh = Math.round(data.wind.speed * 3.6);
      const temperatureC = Math.round(data.main.temp * 10) / 10;

      const conditions: WeatherConditionType[] = [];

      if (main === 'Thunderstorm' || (w?.id >= 200 && w?.id < 300)) {
        conditions.push(WeatherConditionType.THUNDERSTORM);
      }
      if (main === 'Rain' && rain1h >= 5) {
        conditions.push(WeatherConditionType.HEAVY_RAIN);
      } else if (main === 'Rain' && rain1h > 0) {
        conditions.push(WeatherConditionType.HEAVY_RAIN);
      }
      if (main === 'Snow') conditions.push(WeatherConditionType.SNOW);
      if (description.includes('flood')) conditions.push(WeatherConditionType.FLOOD_WARNING);
      if (description.includes('dust') || description.includes('sand')) {
        conditions.push(WeatherConditionType.DUST_STORM);
      }
      if (windSpeedKmh >= 60) conditions.push(WeatherConditionType.HIGH_WIND);
      if (temperatureC >= 42) conditions.push(WeatherConditionType.HEAT_WAVE);
      if (temperatureC <= 2) conditions.push(WeatherConditionType.EXTREME_COLD);

      const hasGovernmentAdvisory =
        description.includes('advisory') ||
        description.includes('warning') ||
        description.includes('alert');

      if (hasGovernmentAdvisory) {
        conditions.push(WeatherConditionType.GOVERNMENT_ADVISORY);
      }

      return {
        temperatureC,
        feelsLikeC: Math.round(data.main.feels_like * 10) / 10,
        humidity: data.main.humidity,
        windSpeedKmh,
        description: w?.description ?? '',
        main,
        icon: w?.icon,
        rain1hMm: rain1h,
        hasGovernmentAdvisory,
        conditions: [...new Set(conditions)],
        fetchedAt: new Date().toISOString(),
        raw: data,
      };
    } catch (err) {
      this.logger.warn(`Weather fetch failed: ${err}`);
      return null;
    }
  }
}
