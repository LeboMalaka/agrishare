import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export default function AppTabs() {
  return (
    <View style={styles.tabBar}>
      <ThemedView style={styles.innerContainer}>
        <Link href="/" asChild>
          <Pressable style={styles.tabButton}>
            <ThemedText type="smallBold">Home</ThemedText>
          </Pressable>
        </Link>

        <Link href="/equipment" asChild>
          <Pressable style={styles.tabButton}>
            <ThemedText type="smallBold">Equipment</ThemedText>
          </Pressable>
        </Link>

        <Link href="/dashboard" asChild>
          <Pressable style={styles.tabButton}>
            <ThemedText type="smallBold">Dashboard</ThemedText>
          </Pressable>
        </Link>
        <Link href="/auth" asChild>
          <Pressable style={styles.tabButton}>
            <ThemedText type="smallBold">Account</ThemedText>
          </Pressable>
        </Link>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  innerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5ebdf',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
