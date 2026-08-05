'use client';

import { useCallback, useState } from 'react';

export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentPosition = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        reject(new Error('Geolocation is not supported in this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      });
    });
  }, []);

  const locate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const position = await getCurrentPosition();
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch (err) {
      const message =
        err instanceof GeolocationPositionError
          ? err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Allow location access in your browser.'
            : err.code === err.TIMEOUT
              ? 'Location request timed out. Try again.'
              : 'Could not determine your location.'
          : err instanceof Error
            ? err.message
            : 'Could not determine your location.';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, [getCurrentPosition]);

  return { locate, loading, error };
}
