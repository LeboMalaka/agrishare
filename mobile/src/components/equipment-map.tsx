import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { EquipmentMapProps } from '@/components/equipment-map.types';

export function EquipmentMap(_props: EquipmentMapProps) {
  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        Maps are not available on this platform.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#e5f0e9',
  },
});
