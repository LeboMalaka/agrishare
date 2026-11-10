import * as Location from 'expo-location';
import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { Coordinates } from '@/lib/api';
import { geocodePlaces, type GeocodedPlace } from '@/lib/geocoding';

export function EquipmentLocationControl({
  coordinates,
  onChange,
}: {
  coordinates: Coordinates | null;
  onChange: (coordinates: Coordinates | null) => void;
}) {
  const [place, setPlace] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [suggestions, setSuggestions] = useState<GeocodedPlace[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<GeocodedPlace | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const getCurrentLocation = async (explicitRetry = false) => {
    setBusy(true);
    setMessage(null);
    try {
      if (permissionDenied && !explicitRetry) {
        setMessage(
          Platform.OS === 'web'
            ? 'Location permission is denied for this site. Change its location permission in browser settings, or search for a town or address below.'
            : 'Location permission was denied. Enable it in app settings, or search for a town or address below.',
        );
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setMessage('Location services are turned off. Enable device location and try again, or search for a town or address.');
        return;
      }

      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.geolocation) {
        setMessage('This browser does not support device location. Search for a town or address instead.');
        return;
      }

      if (Platform.OS !== 'web') {
        let permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted && permission.canAskAgain) {
          permission = await Location.requestForegroundPermissionsAsync();
        }
        if (permission.status !== Location.PermissionStatus.GRANTED) {
          setPermissionDenied(true);
          setMessage(
            permission.canAskAgain
              ? 'Location permission was denied. Search for a town or address below, or explicitly try location permission again.'
              : 'Location permission is blocked. Enable it in app settings, or search for a town or address below.',
          );
          return;
        }
      }

      const coordinates = Platform.OS === 'web'
        ? await new Promise<Coordinates>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (position) => resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              }),
              reject,
              { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
            );
          })
        : await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            mayShowUserSettingsDialog: true,
          }).then((position) => ({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }));
      onChange(coordinates);
      setSelectedLabel('Current device location');
      setSuggestions([]);
      setSelectedSuggestion(null);
      setMessage('Using your current location.');
    } catch (locationError) {
      const errorCode = typeof locationError === 'object' && locationError !== null && 'code' in locationError
        ? locationError.code
        : undefined;
      if (errorCode === 1) setPermissionDenied(true);
      setMessage(
        errorCode === 1
          ? 'Location permission was denied. Search for a town or address below, or change this site’s permission in browser settings.'
          : errorCode === 2
            ? 'Your location is unavailable. Check that location services are enabled, or search for a town or address.'
            : errorCode === 3
              ? 'Getting your location timed out. Try again or search for a town or address.'
              : locationError instanceof Error
                ? locationError.message
                : 'Could not get your location. Search for a town or address instead.',
      );
    } finally {
      setBusy(false);
    }
  };

  const searchPlace = async () => {
    const address = place.trim();
    if (!address) {
      setMessage('Enter a town, city, or address to search.');
      return;
    }
    setBusy(true);
    setMessage(null);
    setSuggestions([]);
    setSelectedSuggestion(null);
    try {
      const results = await geocodePlaces(address);
      if (results.length === 0) {
        setMessage('No matching location was found. Try a town, suburb, or nearby address.');
      } else {
        setSuggestions(results);
        setMessage(`Choose the matching location for ${address}, then confirm it.`);
      }
    } catch (geocodeError) {
      setMessage(
        geocodeError instanceof Error
          ? geocodeError.message
          : 'Could not find that place. Try a nearby town or city.',
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmSuggestion = () => {
    if (!selectedSuggestion) return;
    onChange(selectedSuggestion.coordinates);
    setSelectedLabel(selectedSuggestion.label);
    setMessage(`Searching near ${selectedSuggestion.label}.`);
    setSuggestions([]);
    setSelectedSuggestion(null);
  };

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">Your search location</ThemedText>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void getCurrentLocation()}
          style={[styles.button, busy && styles.disabled]}>
          <ThemedText type="smallBold" style={styles.buttonText}>
            {busy ? 'Finding location…' : 'Use my current location'}
          </ThemedText>
        </Pressable>
        {coordinates ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onChange(null);
              setSelectedLabel(null);
              setSuggestions([]);
              setSelectedSuggestion(null);
              setMessage('Location cleared. Showing all matching listings.');
            }}
            style={styles.clearButton}>
            <ThemedText type="smallBold" style={styles.clearText}>Clear</ThemedText>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.searchRow}>
        <TextInput
          value={place}
          onChangeText={(text) => {
            setPlace(text);
            setSuggestions([]);
            setSelectedSuggestion(null);
            setMessage(null);
          }}
          onSubmitEditing={() => void searchPlace()}
          placeholder="Search a town, suburb, or address"
          placeholderTextColor="#7d8575"
          returnKeyType="search"
          accessibilityLabel="Search location by place name"
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void searchPlace()}
          style={[styles.searchButton, busy && styles.disabled]}>
          <ThemedText type="smallBold" style={styles.buttonText}>Search</ThemedText>
        </Pressable>
      </View>
      {suggestions.map((suggestion, index) => {
        const selected = selectedSuggestion === suggestion;
        return (
          <Pressable
            key={`${suggestion.coordinates.latitude},${suggestion.coordinates.longitude},${index}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => setSelectedSuggestion(suggestion)}
            style={[styles.suggestion, selected && styles.selectedSuggestion]}>
            <ThemedText type="smallBold" style={selected ? styles.selectedSuggestionText : undefined}>
              {suggestion.label}
            </ThemedText>
            <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
              {suggestion.coordinates.latitude.toFixed(4)}, {suggestion.coordinates.longitude.toFixed(4)}
            </ThemedText>
          </Pressable>
        );
      })}
      {selectedSuggestion ? (
        <Pressable accessibilityRole="button" onPress={confirmSuggestion} style={styles.confirmButton}>
          <ThemedText type="smallBold" style={styles.buttonText}>Confirm selected location</ThemedText>
        </Pressable>
      ) : null}
      {coordinates ? (
        <ThemedText type="small" themeColor="textSecondary">
          {selectedLabel ? `${selectedLabel} · ` : ''}{coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}
        </ThemedText>
      ) : null}
      {message ? (
        <View style={styles.message}>
          <ThemedText type="small" themeColor="textSecondary">{message}</ThemedText>
          {permissionDenied ? (
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setPermissionDenied(false);
                  void getCurrentLocation(true);
                }}
                style={styles.clearButton}>
                <ThemedText type="smallBold" style={styles.clearText}>Try location permission again</ThemedText>
              </Pressable>
              {Platform.OS !== 'web' ? (
                <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={styles.clearButton}>
                  <ThemedText type="smallBold" style={styles.clearText}>Open app settings</ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4eadf',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  button: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#e5f0e9',
  },
  buttonText: {
    color: '#173f2d',
  },
  clearButton: {
    padding: 10,
  },
  clearText: {
    color: '#9b2c2c',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#f8faf7',
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dfe8db',
    fontSize: 16,
    color: '#162114',
  },
  searchButton: {
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#e5f0e9',
  },
  suggestion: {
    gap: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dfe8db',
    backgroundColor: '#f8faf7',
  },
  selectedSuggestion: {
    borderColor: '#1f5d3f',
    backgroundColor: '#e5f0e9',
  },
  selectedSuggestionText: {
    color: '#173f2d',
  },
  confirmButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#1f5d3f',
  },
  message: {
    gap: 6,
  },
  disabled: {
    opacity: 0.6,
  },
});
