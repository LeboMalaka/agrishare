import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

export const equipmentSearchRadii = [5, 10, 20, 50, 100, 200] as const;
export const customRadiusMinKm = 1;
export const customRadiusMaxKm = 500;

export function EquipmentRadiusSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (radiusKm: number) => void;
}) {
  const [customValue, setCustomValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isPreset = equipmentSearchRadii.some((radiusKm) => radiusKm === value);

  const applyCustomRadius = () => {
    const radiusKm = Number(customValue);
    if (!Number.isInteger(radiusKm) || radiusKm < customRadiusMinKm || radiusKm > customRadiusMaxKm) {
      setError(`Enter a whole number from ${customRadiusMinKm} to ${customRadiusMaxKm} km.`);
      return;
    }
    setError(null);
    onChange(radiusKm);
  };

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">Search radius</ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {equipmentSearchRadii.map((radiusKm) => {
          const selected = value === radiusKm;
          return (
            <Pressable
              key={radiusKm}
              accessibilityRole="button"
              accessibilityLabel={`${radiusKm} km search radius`}
              accessibilityState={{ selected }}
              onPress={() => onChange(radiusKm)}
              style={[styles.chip, selected && styles.selectedChip]}>
              <ThemedText type="smallBold" style={selected ? styles.selectedLabel : styles.label}>
                {radiusKm} km
              </ThemedText>
            </Pressable>
          );
        })}
        <View style={[styles.chip, !isPreset && styles.selectedChip]}>
          <ThemedText type="smallBold" style={!isPreset ? styles.selectedLabel : styles.label}>
            {!isPreset ? `${value} km custom` : 'Custom'}
          </ThemedText>
        </View>
      </ScrollView>
      <View style={styles.customRow}>
        <TextInput
          accessibilityLabel="Custom search radius in kilometres"
          value={customValue}
          onChangeText={(text) => {
            setCustomValue(text);
            setError(null);
          }}
          keyboardType="number-pad"
          maxLength={3}
          placeholder={`Custom distance (${customRadiusMinKm}-${customRadiusMaxKm} km)`}
          placeholderTextColor="#7d8575"
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Apply custom search radius"
          onPress={applyCustomRadius}
          style={styles.applyButton}>
          <ThemedText type="smallBold" style={styles.applyText}>Apply</ThemedText>
        </Pressable>
      </View>
      {error ? <ThemedText type="small" style={styles.error}>{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  chip: {
    marginRight: 8,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderColor: '#dfe8db',
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  selectedChip: {
    backgroundColor: '#1f5d3f',
    borderColor: '#1f5d3f',
  },
  label: {
    color: '#173f2d',
  },
  selectedLabel: {
    color: '#ffffff',
  },
  customRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dfe8db',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#162114',
    fontSize: 16,
  },
  applyButton: {
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#e5f0e9',
  },
  applyText: {
    color: '#173f2d',
  },
  error: {
    color: '#9b2c2c',
  },
});
