import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { EquipmentForm, type EquipmentFormValues, type SelectedEquipmentImage } from '@/components/equipment-form';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';
import { createEquipment, getApiErrorMessage, uploadEquipmentImage } from '@/lib/api';

export default function NewEquipmentScreen() {
  const { user, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (
    values: EquipmentFormValues,
    images: SelectedEquipmentImage[],
  ) => {
    setSubmitting(true);
    setError(null);
    try {
      const imageUrls = await Promise.all(
        images.map((image) => uploadEquipmentImage(image.uri, image.fileName, image.mimeType, image.file)),
      );
      await createEquipment({ ...values, imageUrls });
      router.replace('/owner');
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <View className="flex-1 items-center justify-center bg-[#f4f7f1]"><ThemedText>Loading account…</ThemedText></View>;
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
  return (
    <EquipmentForm
      submitting={submitting}
      error={error}
      submitLabel="Publish listing"
      onSubmit={(values, images) => void submit(values, images)}
    />
  );
}
