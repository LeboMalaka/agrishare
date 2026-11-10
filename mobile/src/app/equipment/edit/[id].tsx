import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { EquipmentForm, type EquipmentFormValues, type SelectedEquipmentImage } from '@/components/equipment-form';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';
import {
  getApiErrorMessage,
  getEquipmentById,
  updateEquipment,
  uploadEquipmentImage,
  type Equipment,
} from '@/lib/api';

export default function EditEquipmentScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const equipmentId = Array.isArray(id) ? id[0] : id;
  const { user, loading: authLoading } = useAuth();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!equipmentId) return;
    void getEquipmentById(equipmentId)
      .then((item) => {
        if (active) setEquipment(item);
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

  const submit = async (
    values: EquipmentFormValues,
    images: SelectedEquipmentImage[],
    retainedImageUrls: string[],
  ) => {
    if (!equipmentId) return;
    setSubmitting(true);
    setError(null);
    try {
      const uploadedUrls = await Promise.all(
        images.map((image) => uploadEquipmentImage(image.uri, image.fileName, image.mimeType, image.file)),
      );
      await updateEquipment(equipmentId, {
        ...values,
        imageUrls: [...retainedImageUrls, ...uploadedUrls],
      });
      router.replace({ pathname: '/equipment/[id]', params: { id: equipmentId } });
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSubmitting(false);
    }
  };

  if (!equipmentId) {
    return <View className="flex-1 items-center justify-center bg-[#f4f7f1]"><ThemedText>Equipment ID is missing.</ThemedText></View>;
  }
  if (authLoading || loading) {
    return <View className="flex-1 items-center justify-center bg-[#f4f7f1]"><ThemedText>Loading equipment…</ThemedText></View>;
  }
  if (!user || user.role !== 'EQUIPMENT_OWNER') {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-[#f4f7f1] p-6">
        <ThemedText type="subtitle">Equipment owner account required</ThemedText>
        <Link href="/auth" asChild>
          <Pressable className="rounded-xl bg-[#173f2d] px-5 py-3">
            <ThemedText type="smallBold" className="text-white">Sign in</ThemedText>
          </Pressable>
        </Link>
      </View>
    );
  }
  if (!equipment || equipment.owner.id !== user.id) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-[#f4f7f1] p-6">
        <ThemedText type="subtitle">Unable to edit this listing</ThemedText>
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
    <EquipmentForm
      initialEquipment={equipment}
      submitting={submitting}
      error={error}
      submitLabel="Save changes"
      onSubmit={(values, images, retained) => void submit(values, images, retained)}
    />
  );
}
