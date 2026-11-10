import { Link, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { EquipmentLocationControl } from '@/components/equipment-location-control';
import { EquipmentMap } from '@/components/equipment-map';
import { EquipmentRadiusSelector, equipmentSearchRadii } from '@/components/equipment-radius-selector';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getEquipment, searchNearbyEquipment, type Coordinates, type Equipment, type NearbyEquipment } from '@/lib/api';
import {
  categoryByLabel,
  equipmentCategoryLabels,
  getEquipmentCategoryLabel,
  type EquipmentCategoryLabel,
} from '@/lib/equipment';
import { getApiErrorMessage } from '@/lib/api';

type EquipmentDiscoveryResult = Equipment & { distanceKm?: number };

export default function EquipmentDiscoveryScreen() {
  const params = useLocalSearchParams<{ search?: string }>();
  const [selectedCategory, setSelectedCategory] = useState<EquipmentCategoryLabel>('All');
  const [searchText, setSearchText] = useState(
    typeof params.search === 'string' ? params.search : '',
  );
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [equipment, setEquipment] = useState<EquipmentDiscoveryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadEquipment = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const filters = {
        search: searchText,
        category: categoryByLabel[selectedCategory],
      };
      const results = location
        ? await searchNearbyEquipment({
            ...filters,
            latitude: location.latitude,
            longitude: location.longitude,
            radiusKm,
          })
        : await getEquipment(filters);
      if (requestId.current === currentRequestId) setEquipment(results);
    } catch (loadError) {
      if (requestId.current === currentRequestId) setError(getApiErrorMessage(loadError));
    } finally {
      if (requestId.current === currentRequestId) setLoading(false);
    }
  }, [location, radiusKm, searchText, selectedCategory]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadEquipment();
    }, 250);
    return () => {
      clearTimeout(timer);
      requestId.current += 1;
    };
  }, [loadEquipment]);

  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.pageTitle}>
          Equipment discovery
        </ThemedText>

        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search equipment"
          style={styles.searchInput}
          placeholderTextColor="#7d8575"
          returnKeyType="search"
        />

        <EquipmentLocationControl coordinates={location} onChange={setLocation} />

        {location ? (
          <>
            <EquipmentRadiusSelector value={radiusKm} onChange={setRadiusKm} />
            <EquipmentMap
              center={location}
              radiusKm={radiusKm}
              equipment={equipment.filter(
                (item): item is NearbyEquipment => item.distanceKm !== undefined,
              )}
            />
          </>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {equipmentCategoryLabels.map((category) => {
            const active = selectedCategory === category;
            return (
              <Pressable
                key={category}
                onPress={() => setSelectedCategory(category)}
                style={[styles.chip, active && styles.chipActive]}>
                <ThemedText style={styles.chipLabel} themeColor={active ? 'text' : 'textSecondary'}>
                  {category}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        <ThemedView style={styles.resultsRow}>
          <ThemedText type="smallBold">
            {loading ? 'Loading listings…' : `${equipment.length} listings`}
          </ThemedText>
          <Link href="/dashboard" asChild>
            <Pressable style={styles.secondaryButton}>
              <ThemedText type="smallBold">Owner dashboard</ThemedText>
            </Pressable>
          </Link>
        </ThemedView>

        {error ? (
          <ThemedView style={styles.messageCard}>
            <ThemedText type="smallBold">Could not load equipment</ThemedText>
            <ThemedText themeColor="textSecondary">{error}</ThemedText>
            <Pressable onPress={() => void loadEquipment()} style={styles.retryButton}>
              <ThemedText type="smallBold" style={styles.retryText}>Try again</ThemedText>
            </Pressable>
          </ThemedView>
        ) : null}

        {!loading && !error && equipment.length === 0 ? (
          <ThemedView style={styles.messageCard}>
            <ThemedText type="smallBold">
              {location ? `No equipment within ${radiusKm} km` : 'No equipment found'}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {location
                ? radiusKm < 500
                  ? 'Expand your search radius to find more equipment nearby.'
                  : 'Try another search area or clear filters to find equipment.'
                : 'Try another search or category. Owners can add equipment from their dashboard.'}
            </ThemedText>
            {location ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {equipmentSearchRadii.filter((radius) => radius > radiusKm).map((radius) => (
                  <Pressable
                    key={radius}
                    accessibilityRole="button"
                    onPress={() => setRadiusKm(radius)}
                    style={styles.expandButton}>
                    <ThemedText type="smallBold" style={styles.expandLabel}>Expand to {radius} km</ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </ThemedView>
        ) : null}

        {equipment.map((item) => (
          <Link key={item.id} href={{ pathname: '/equipment/[id]', params: { id: item.id } }} asChild>
            <Pressable style={styles.card}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.image} />
              ) : (
                <View style={[styles.image, styles.imagePlaceholder]}>
                  <ThemedText type="subtitle" style={styles.placeholderIcon}>Ag</ThemedText>
                </View>
              )}
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <ThemedText type="subtitle" style={styles.nameText}>
                    {item.name}
                  </ThemedText>
                  <ThemedText type="smallBold" style={styles.priceText}>
                    R{Number(item.pricePerDay).toFixed(0)}/day
                  </ThemedText>
                </View>

                <View style={styles.metaRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {getEquipmentCategoryLabel(item.category)}
                  </ThemedText>
                  {item.distanceKm !== undefined ? (
                    <ThemedText type="smallBold" style={styles.distanceText}>
                      {item.distanceKm.toFixed(1)} km away
                    </ThemedText>
                  ) : null}
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.location}
                  </ThemedText>
                </View>
                <ThemedText style={styles.description} themeColor="textSecondary">
                  {item.description}
                </ThemedText>
                <ThemedText type="smallBold">
                  {item.availability.replace('_', ' ')} · Listed by {item.owner.name}
                </ThemedText>
              </View>
            </Pressable>
          </Link>
        ))}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f1',
  },
  container: {
    padding: 20,
    gap: 18,
    paddingBottom: 100,
  },
  pageTitle: {
    fontSize: 34,
    lineHeight: 42,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dfe8db',
    fontSize: 16,
    color: '#162114',
  },
  chipRow: {
    paddingBottom: 6,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
    borderRadius: 999,
    backgroundColor: '#edf2ea',
    borderWidth: 1,
    borderColor: '#dfe8db',
  },
  chipActive: {
    backgroundColor: '#1f5d3f',
    borderColor: '#1f5d3f',
  },
  chipLabel: {
    fontWeight: '700',
  },
  resultsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#e5f0e9',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e4eadf',
  },
  image: {
    width: '100%',
    height: 180,
  },
  imagePlaceholder: {
    backgroundColor: '#dfeecf',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    color: '#173f2d',
  },
  cardBody: {
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  nameText: {
    flex: 1,
    fontSize: 22,
    lineHeight: 28,
  },
  priceText: {
    color: '#1f5d3f',
    fontSize: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  description: {
    lineHeight: 20,
  },
  messageCard: {
    padding: 16,
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 16,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#e5f0e9',
    borderRadius: 10,
  },
  retryText: {
    color: '#173f2d',
  },
  expandButton: {
    marginRight: 8,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: '#e5f0e9',
  },
  expandLabel: {
    color: '#173f2d',
  },
  distanceText: {
    color: '#1f5d3f',
  },
});
