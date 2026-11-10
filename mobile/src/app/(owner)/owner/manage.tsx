import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getApiErrorMessage, getOwnerEquipment, deleteEquipment, type Equipment } from '@/lib/api';

export default function ManageEquipmentScreen() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEquipment(await getOwnerEquipment());
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void getOwnerEquipment()
      .then((items) => {
        if (active) setEquipment(items);
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
  }, []);

  const removeListing = (item: Equipment) => {
    Alert.alert(
      'Delete equipment listing?',
      `${item.name} will be removed. Listings with booking history cannot be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDeletingId(item.id);
            setError(null);
            void deleteEquipment(item.id)
              .then(() => setEquipment((current) => current.filter((entry) => entry.id !== item.id)))
              .catch((deleteError: unknown) => setError(getApiErrorMessage(deleteError)))
              .finally(() => setDeletingId(null));
          },
        },
      ],
    );
  };

  return (
    <ScrollView className="flex-1 bg-[#f4f7f1]" contentContainerStyle={{ padding: 18, paddingBottom: 100 }}>
      <View className="mx-auto w-full max-w-4xl gap-5">
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="gap-1">
            <ThemedText type="title" className="text-[32px] leading-[40px] text-[#173f2d]">My equipment</ThemedText>
            <ThemedText themeColor="textSecondary">Edit listing details or remove equipment from the marketplace.</ThemedText>
          </View>
          <Link href="/owner/add" asChild>
            <Pressable className="rounded-xl bg-[#173f2d] px-4 py-3">
              <ThemedText type="smallBold" className="text-white">Add equipment</ThemedText>
            </Pressable>
          </Link>
        </View>
        {error ? (
          <View className="gap-3 rounded-xl border border-[#f1c7c1] bg-[#fff2f0] p-4">
            <ThemedText type="smallBold" className="text-[#9b2c2c]">{error}</ThemedText>
            <Pressable onPress={() => void refresh()}>
              <ThemedText type="smallBold" className="text-[#1f5d3f]">Refresh list</ThemedText>
            </Pressable>
          </View>
        ) : null}
        {loading ? <ThemedText themeColor="textSecondary">Loading listings…</ThemedText> : null}
        {!loading && equipment.length === 0 ? (
          <View className="gap-2 rounded-2xl border border-[#e5ebdf] bg-white p-5">
            <ThemedText type="smallBold">No equipment listings yet</ThemedText>
            <ThemedText themeColor="textSecondary">Add your first item to make it available to farmers.</ThemedText>
          </View>
        ) : null}
        {equipment.map((item) => (
          <View key={item.id} className="gap-3 rounded-2xl border border-[#e5ebdf] bg-white p-4 md:flex-row md:items-center">
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} className="h-24 w-full rounded-xl bg-[#dfeecf] md:w-32" />
            ) : (
              <View className="h-24 w-full items-center justify-center rounded-xl bg-[#dfeecf] md:w-32">
                <ThemedText type="smallBold" className="text-[#173f2d]">AgriShare</ThemedText>
              </View>
            )}
            <View className="flex-1 gap-1">
              <ThemedText type="smallBold">{item.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.location} · R{Number(item.pricePerDay).toFixed(0)}/day
              </ThemedText>
              <ThemedText type="smallBold" className="text-[#1f5d3f]">
                {item.availability} · {item.images?.length ?? (item.imageUrl ? 1 : 0)} photo(s)
              </ThemedText>
            </View>
            <View className="flex-row flex-wrap gap-2">
              <Link href={{ pathname: '/equipment/edit/[id]', params: { id: item.id } }} asChild>
                <Pressable className="rounded-lg border border-[#dce7db] px-3 py-2">
                  <ThemedText type="smallBold" className="text-[#173f2d]">Edit</ThemedText>
                </Pressable>
              </Link>
              <Link href={{ pathname: '/equipment/[id]', params: { id: item.id } }} asChild>
                <Pressable className="rounded-lg border border-[#dce7db] px-3 py-2">
                  <ThemedText type="smallBold" className="text-[#173f2d]">View</ThemedText>
                </Pressable>
              </Link>
              <Pressable
                onPress={() => removeListing(item)}
                disabled={deletingId === item.id}
                className="rounded-lg bg-[#fff2f0] px-3 py-2">
                <ThemedText type="smallBold" className="text-[#9b2c2c]">
                  {deletingId === item.id ? 'Deleting…' : 'Delete'}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
