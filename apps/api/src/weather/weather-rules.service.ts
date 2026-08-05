import { Injectable } from '@nestjs/common';
import { WeatherConditionType, WeatherSettings } from '@prisma/client';
import { WeatherSnapshot } from './weather-api.service';

export interface EligibilityResult {
  eligible: boolean;
  reason: string;
  triggeredConditions: WeatherConditionType[];
}

@Injectable()
export class WeatherRulesService {
  evaluate(
    settings: WeatherSettings,
    snapshot: WeatherSnapshot,
    distanceKm: number | null,
  ): EligibilityResult {
    const triggered: WeatherConditionType[] = [];
    const reasons: string[] = [];

    if (settings.govAdvisoryOverride && snapshot.hasGovernmentAdvisory) {
      triggered.push(WeatherConditionType.GOVERNMENT_ADVISORY);
      reasons.push('Government weather advisory in effect');
      return {
        eligible: true,
        reason: reasons.join('; '),
        triggeredConditions: triggered,
      };
    }

    const meetsDistance = distanceKm != null && distanceKm >= settings.minDistanceKm;
    if (!meetsDistance && distanceKm != null) {
      return { eligible: false, reason: 'Commute distance below threshold', triggeredConditions: [] };
    }
    if (distanceKm == null) {
      return { eligible: false, reason: 'Commute distance not calculated', triggeredConditions: [] };
    }

    if (settings.rainEnabled) {
      if (
        snapshot.conditions.includes(WeatherConditionType.HEAVY_RAIN) ||
        snapshot.conditions.includes(WeatherConditionType.THUNDERSTORM)
      ) {
        triggered.push(
          snapshot.conditions.includes(WeatherConditionType.THUNDERSTORM)
            ? WeatherConditionType.THUNDERSTORM
            : WeatherConditionType.HEAVY_RAIN,
        );
        reasons.push('Severe rain or thunderstorm');
      }
    }

    if (snapshot.temperatureC >= settings.heatThresholdC) {
      triggered.push(WeatherConditionType.HEAT_WAVE);
      reasons.push(`Temperature ${snapshot.temperatureC}°C exceeds heat threshold`);
    }

    if (snapshot.temperatureC <= settings.coldThresholdC) {
      triggered.push(WeatherConditionType.EXTREME_COLD);
      reasons.push(`Temperature ${snapshot.temperatureC}°C below cold threshold`);
    }

    if (snapshot.windSpeedKmh >= settings.windThresholdKmh) {
      triggered.push(WeatherConditionType.HIGH_WIND);
      reasons.push(`Wind speed ${snapshot.windSpeedKmh} km/h exceeds threshold`);
    }

    if (settings.floodAlertsEnabled && snapshot.conditions.includes(WeatherConditionType.FLOOD_WARNING)) {
      triggered.push(WeatherConditionType.FLOOD_WARNING);
      reasons.push('Flood warning');
    }

    if (snapshot.conditions.includes(WeatherConditionType.SNOW)) {
      triggered.push(WeatherConditionType.SNOW);
      reasons.push('Snow conditions');
    }

    if (snapshot.conditions.includes(WeatherConditionType.DUST_STORM)) {
      triggered.push(WeatherConditionType.DUST_STORM);
      reasons.push('Dust or sand storm');
    }

    const unique = [...new Set(triggered)];
    return {
      eligible: unique.length > 0,
      reason: unique.length > 0 ? reasons.join('; ') : 'No severe weather conditions',
      triggeredConditions: unique,
    };
  }
}
