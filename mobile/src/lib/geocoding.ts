import * as Location from 'expo-location';
import { Platform } from 'react-native';

import type { Coordinates } from '@/lib/api';
import { geocodeAddress } from '@/lib/google-maps';

export type GeocodedPlace = {
  label: string;
  coordinates: Coordinates;
};

export async function geocodePlaces(address: string): Promise<GeocodedPlace[]> {
  if (Platform.OS === 'web') return geocodeAddress(address);

  const results = await Location.geocodeAsync(address);
  return results.slice(0, 5).map((result, index) => ({
    label: `${address} · ${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}${results.length > 1 ? ` · result ${index + 1}` : ''}`,
    coordinates: {
      latitude: result.latitude,
      longitude: result.longitude,
    },
  }));
}

export async function geocodePlace(address: string): Promise<Coordinates> {
  const [firstResult] = await geocodePlaces(address);
  if (!firstResult) throw new Error('No matching location was found. Try a nearby town or city.');
  return firstResult.coordinates;
}
