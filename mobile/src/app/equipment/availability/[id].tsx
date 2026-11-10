import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { EquipmentAvailabilityCalendar } from '@/components/equipment-availability-calendar';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';
import { getApiErrorMessage, getEquipmentById, type Equipment } from '@/lib/api';

export default function EquipmentAvailabilityScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const equipmentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user, loading: authLoading } = useAuth();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!equipmentId) return;
    void getEquipmentById(equipmentId)
      .then((result) => {
        if (active) setEquipment(result);
      })
      .catch((loadError: unknown) => {
        if (active) setError(getApiErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [equipmentId]);

  if (authLoading || loading) {
    return <View className="flex-1 items-center justify-center bg-[#f4f7f1]"><ThemedText>Loading availability…</ThemedText></View>;
  }
  if (!equipment || !user || user.role !== 'EQUIPMENT_OWNER' || equipment.owner.id !== user.id) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-[#f4f7f1] p-6">
        <ThemedText type="subtitle">Unable to manage availability</ThemedText>
        <ThemedText themeColor="textSecondary">{error ?? 'This listing is not owned by your account.'}</ThemedText>
        <Link href="/owner/manage" asChild>
          <Pressable className="rounded-xl bg-[#173f2d] px-5 py-3">
            <ThemedText type="smallBold" className="text-white">Back to listings</ThemedText>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-[#f4f7f1]" contentContainerStyle={{ padding: 18, paddingBottom: 100 }}>
      <View className="mx-auto w-full max-w-3xl gap-5">
        <View className="gap-2">
          <ThemedText type="title" className="text-[32px] leading-[40px] text-[#173f2d]">Manage availability</ThemedText>
          <ThemedText type="subtitle" className="text-[#173f2d]">{equipment.name}</ThemedText>
          <ThemedText themeColor="textSecondary">
            Select one or more future dates, then mark them available or unavailable. Confirmed bookings cannot be changed.
          </ThemedText>
        </View>
        <EquipmentAvailabilityCalendar equipmentId={equipment.id} mode="manage" />
      </View>
    </ScrollView>
  );
}
