import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getApiErrorMessage, getOwnerProfile, type PublicOwnerProfile } from '@/lib/api';

export default function OwnerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const ownerId = Array.isArray(id) ? id[0] : id;
  const [owner, setOwner] = useState<PublicOwnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!ownerId) return;
    void getOwnerProfile(ownerId)
      .then((profile) => {
        if (active) setOwner(profile);
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
  }, [ownerId]);

  if (!ownerId) return <View className="flex-1 items-center justify-center bg-[#f4f7f1]"><ThemedText>Owner ID is missing.</ThemedText></View>;
  if (loading) return <View className="flex-1 items-center justify-center bg-[#f4f7f1]"><ThemedText>Loading owner…</ThemedText></View>;
  if (!owner) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-[#f4f7f1] p-6">
        <ThemedText type="subtitle">Owner profile unavailable</ThemedText>
        {error ? <ThemedText themeColor="textSecondary">{error}</ThemedText> : null}
        <Link href="/equipment" asChild>
          <Pressable className="rounded-xl bg-[#173f2d] px-5 py-3">
            <ThemedText type="smallBold" className="text-white">Browse equipment</ThemedText>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-[#f4f7f1]" contentContainerStyle={{ padding: 18, paddingBottom: 100 }}>
      <View className="mx-auto w-full max-w-4xl gap-5">
        <View className="flex-row items-center gap-4 rounded-3xl border border-[#cfe1bf] bg-[#dfeecf] p-5 md:p-8">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-white">
            <ThemedText type="subtitle" className="text-[#173f2d]">{owner.name.slice(0, 1).toUpperCase()}</ThemedText>
          </View>
          <View className="flex-1 gap-1">
            <ThemedText type="small" className="uppercase tracking-widest text-[#1f5d3f]">Equipment owner</ThemedText>
            <ThemedText type="title" className="text-[30px] leading-9 text-[#173f2d]">{owner.name}</ThemedText>
            <ThemedText themeColor="textSecondary">{owner.equipment.length} listing{owner.equipment.length === 1 ? '' : 's'}</ThemedText>
          </View>
        </View>
        <View className="gap-4 rounded-2xl border border-[#e5ebdf] bg-white p-5">
          <ThemedText type="subtitle" className="text-[22px] leading-7 text-[#173f2d]">Equipment listings</ThemedText>
          {owner.equipment.length === 0 ? <ThemedText themeColor="textSecondary">No public listings yet.</ThemedText> : null}
          {owner.equipment.map((item) => (
            <Link key={item.id} href={{ pathname: '/equipment/[id]', params: { id: item.id } }} asChild>
              <Pressable className="flex-row gap-3 rounded-xl border border-[#e5ebdf] bg-[#f8faf7] p-3">
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} className="h-20 w-20 rounded-lg bg-[#dfeecf]" />
                ) : (
                  <View className="h-20 w-20 items-center justify-center rounded-lg bg-[#dfeecf]">
                    <ThemedText type="smallBold" className="text-[#173f2d]">Ag</ThemedText>
                  </View>
                )}
                <View className="flex-1 justify-center gap-1">
                  <ThemedText type="smallBold">{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{item.location} · R{Number(item.pricePerDay).toFixed(0)}/day</ThemedText>
                  <ThemedText type="smallBold" className="text-[#1f5d3f]">{item.availability}</ThemedText>
                </View>
              </Pressable>
            </Link>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
