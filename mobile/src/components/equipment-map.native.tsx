import { AppleMaps, GoogleMaps } from 'expo-maps';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { EquipmentMapProps } from '@/components/equipment-map.types';

export function EquipmentMap({ center, radiusKm, equipment }: EquipmentMapProps) {
  const appleEquipmentMarkers = equipment.flatMap((item) => {
    if (item.latitude === null || item.longitude === null) return [];
    return [{
      id: item.id,
      coordinates: {
        latitude: item.latitude,
        longitude: item.longitude,
      },
      title: `${item.name} · ${item.distanceKm.toFixed(1)} km away`,
      tintColor: '#c27b24',
    }];
  });
  const googleEquipmentMarkers = equipment.flatMap((item) => {
    if (item.latitude === null || item.longitude === null) return [];
    return [{
      id: item.id,
      coordinates: {
        latitude: item.latitude,
        longitude: item.longitude,
      },
      title: item.name,
      snippet: `${item.distanceKm.toFixed(1)} km away · ${item.location}`,
    }];
  });
  const appleMarkers = [
    {
      id: 'search-location',
      coordinates: center,
      title: 'Your search location',
      tintColor: '#1f5d3f',
    },
    ...appleEquipmentMarkers,
  ];
  const googleMarkers = [
    {
      id: 'search-location',
      coordinates: center,
      title: 'Your search location',
      snippet: `Searching within ${radiusKm} km`,
    },
    ...googleEquipmentMarkers,
  ];
  const appleCircles = [{
    center,
    radius: radiusKm * 1000,
    color: 'rgba(31, 93, 63, 0.12)',
    lineColor: '#1f5d3f',
    lineWidth: 2,
  }];
  const googleCircles = [{
    center,
    radius: radiusKm * 1000,
    color: 'rgba(31, 93, 63, 0.12)',
    lineColor: '#1f5d3f',
    lineWidth: 2,
  }];

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.container}>
        <AppleMaps.View
          style={styles.map}
          cameraPosition={{ coordinates: center, zoom: 9 }}
          markers={appleMarkers}
          circles={appleCircles}
        />
      </View>
    );
  }

  if (!process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY) {
    return (
      <View style={[styles.container, styles.fallback]}>
        <ThemedText type="smallBold">Add a Google Maps Android key to show the map</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Configure EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY in mobile/.env, then rebuild the development app.
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            const first = equipment[0];
            const destination = first?.latitude != null && first.longitude != null
              ? `${first.latitude},${first.longitude}`
              : `${center.latitude},${center.longitude}`;
            void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${destination}`);
          }}>
          <ThemedText type="smallBold" style={styles.link}>Open Google Maps</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GoogleMaps.View
        style={styles.map}
        cameraPosition={{ coordinates: center, zoom: 9 }}
        markers={googleMarkers}
        circles={googleCircles}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 320,
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dfe8db',
    backgroundColor: '#ffffff',
  },
  map: {
    flex: 1,
  },
  fallback: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
  },
  link: {
    color: '#1f5d3f',
    textDecorationLine: 'underline',
  },
});
