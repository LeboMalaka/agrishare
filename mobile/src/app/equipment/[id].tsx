import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';
import { getApiErrorMessage, getEquipmentById, type Equipment } from '@/lib/api';
import { getEquipmentCategoryLabel } from '@/lib/equipment';

export default function EquipmentDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const equipmentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user } = useAuth();
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

  if (!equipmentId) {
    return <ThemedView className="flex-1 items-center justify-center bg-[#f4f7f1]"><ThemedText>Equipment ID is missing.</ThemedText></ThemedView>;
  }
  if (loading) {
    return <ThemedView className="flex-1 items-center justify-center bg-[#f4f7f1]"><ThemedText>Loading equipment…</ThemedText></ThemedView>;
  }
  if (!equipment) {
    return (
      <ThemedView className="flex-1 items-center justify-center gap-4 bg-[#f4f7f1] p-6">
        <ThemedText type="subtitle">{error ? 'Unable to load equipment' : 'Equipment not found'}</ThemedText>
        {error ? <ThemedText themeColor="textSecondary">{error}</ThemedText> : null}
        <Link href="/equipment" asChild>
          <Pressable className="rounded-xl bg-[#173f2d] px-5 py-3">
            <ThemedText type="smallBold" className="text-white">Back to equipment</ThemedText>
          </Pressable>
        </Link>
      </ThemedView>
    );
  }

  const photos = equipment.images?.map((image) => image.url) ?? [];
  if (photos.length === 0 && equipment.imageUrl) photos.push(equipment.imageUrl);
  const isOwner = user?.role === 'EQUIPMENT_OWNER' && user.id === equipment.owner.id;
  return (
    <ScrollView className="flex-1 bg-[#f4f7f1]" contentContainerStyle={{ padding: 18, paddingBottom: 100 }}>
      <View className="mx-auto w-full max-w-5xl gap-5">
        {photos.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} className="overflow-hidden rounded-3xl">
            {photos.map((url, index) => (
              <Image
                key={`${url}-${index}`}
                source={{ uri: url }}
                accessibilityLabel={`${equipment.name}, photo ${index + 1}`}
                className="h-64 w-[calc(100vw-36px)] max-w-5xl bg-[#dfeecf] md:h-[420px]"
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        ) : (
          <View className="h-64 items-center justify-center rounded-3xl bg-[#dfeecf] md:h-[420px]">
            <ThemedText type="subtitle" className="text-[#173f2d]">AgriShare</ThemedText>
            <ThemedText themeColor="textSecondary">No photos added yet</ThemedText>
          </View>
        )}

        <View className="gap-5 rounded-3xl border border-[#e5ebdf] bg-white p-5 md:p-8">
          <View className="gap-3 md:flex-row md:items-start md:justify-between">
            <View className="flex-1 gap-2">
              <ThemedText type="smallBold" className="uppercase tracking-wider text-[#1f5d3f]">
                {getEquipmentCategoryLabel(equipment.category)}
              </ThemedText>
              <ThemedText type="title" className="text-[32px] leading-[40px] text-[#173f2d]">
                {equipment.name}
              </ThemedText>
              <ThemedText themeColor="textSecondary">{equipment.location}</ThemedText>
            </View>
            <View className={`self-start rounded-full px-4 py-2 ${
              equipment.availability === 'AVAILABLE'
                ? 'bg-[#e6f4e4]'
                : equipment.availability === 'LIMITED'
                  ? 'bg-[#fff5dc]'
                  : 'bg-[#fff2f0]'
            }`}>
              <ThemedText type="smallBold" className={
                equipment.availability === 'AVAILABLE'
                  ? 'text-[#1f5d3f]'
                  : equipment.availability === 'LIMITED'
                    ? 'text-[#7e5d1f]'
                    : 'text-[#9b2c2c]'
              }>
                {equipment.availability.replace('_', ' ')}
              </ThemedText>
            </View>
          </View>

          <ThemedText className="leading-6" themeColor="textSecondary">{equipment.description}</ThemedText>

          <View className="flex-row flex-wrap gap-3">
            <InfoTile label="Daily rate" value={`R${Number(equipment.pricePerDay).toFixed(2)}`} />
            <InfoTile label="Availability" value={equipment.availability.replace('_', ' ')} />
            {equipment.latitude !== null && equipment.longitude !== null ? (
              <InfoTile label="Coordinates" value={`${equipment.latitude}, ${equipment.longitude}`} />
            ) : null}
          </View>

          <Link href={{ pathname: '/owners/[id]', params: { id: equipment.owner.id } }} asChild>
            <Pressable className="flex-row items-center gap-3 rounded-2xl bg-[#f7f9f6] p-4">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-[#dfeecf]">
                <ThemedText type="smallBold" className="text-[#173f2d]">
                  {equipment.owner.name.slice(0, 1).toUpperCase()}
                </ThemedText>
              </View>
              <View className="flex-1">
                <ThemedText type="small" themeColor="textSecondary">Listed by</ThemedText>
                <ThemedText type="smallBold" className="text-[#173f2d]">{equipment.owner.name}</ThemedText>
              </View>
              <ThemedText type="smallBold" className="text-[#1f5d3f]">View profile</ThemedText>
            </Pressable>
          </Link>

          {equipment.specifications.length > 0 ? (
            <View className="gap-3">
              <ThemedText type="subtitle" className="text-[22px] leading-7 text-[#173f2d]">Specifications</ThemedText>
              <View className="flex-row flex-wrap gap-2">
                {equipment.specifications.map((spec) => (
                  <View key={spec} className="rounded-full bg-[#f2f6ef] px-3 py-2">
                    <ThemedText type="small">{spec}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View className="flex-row flex-wrap gap-3">
            {isOwner ? (
              <>
                <View className="min-w-[180px] flex-1">
                  <Link href={{ pathname: '/equipment/edit/[id]', params: { id: equipment.id } }} asChild>
                    <Pressable className="items-center rounded-xl border border-[#dce7db] bg-[#f7f9f6] px-4 py-3">
                      <ThemedText type="smallBold" className="text-[#173f2d]">Edit listing</ThemedText>
                    </Pressable>
                  </Link>
                </View>
                <View className="min-w-[180px] flex-1">
                  <Link href={{ pathname: '/equipment/availability/[id]', params: { id: equipment.id } }} asChild>
                    <Pressable className="items-center rounded-xl border border-[#dce7db] bg-[#f7f9f6] px-4 py-3">
                      <ThemedText type="smallBold" className="text-[#173f2d]">Manage availability</ThemedText>
                    </Pressable>
                  </Link>
                </View>
              </>
            ) : equipment.availability !== 'BOOKED' ? (
              <View className="min-w-[180px] flex-1">
                <Link href={{ pathname: '/booking/[id]', params: { id: equipment.id } }} asChild>
                  <Pressable className="items-center rounded-xl bg-[#173f2d] px-4 py-3">
                    <ThemedText type="smallBold" className="text-white">Request booking</ThemedText>
                  </Pressable>
                </Link>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[140px] flex-1 gap-1 rounded-xl border border-[#e5ebdf] bg-[#f8faf7] p-4">
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="smallBold" className="text-[#173f2d]">{value}</ThemedText>
    </View>
  );
}
