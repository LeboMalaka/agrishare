import * as ImagePicker from 'expo-image-picker';
import { useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { Equipment, EquipmentAvailability, EquipmentCategory } from '@/lib/api';
import { geocodePlace } from '@/lib/geocoding';
import { categoryByLabel, equipmentCategoryLabels, type EquipmentCategoryLabel } from '@/lib/equipment';

export type SelectedEquipmentImage = {
  uri: string;
  fileName: string;
  mimeType: string;
  file?: Blob;
};

export type EquipmentFormValues = {
  name: string;
  category: EquipmentCategory;
  description: string;
  pricePerDay: number;
  location: string;
  latitude: number | null;
  longitude: number | null;
  specifications: string[];
  availability: EquipmentAvailability;
  imageUrl?: string;
};

export function EquipmentForm({
  initialEquipment,
  submitting,
  error,
  submitLabel,
  onSubmit,
}: {
  initialEquipment?: Equipment;
  submitting: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (
    values: EquipmentFormValues,
    images: SelectedEquipmentImage[],
    retainedImageUrls: string[],
  ) => void;
}) {
  const [name, setName] = useState(initialEquipment?.name ?? '');
  const [category, setCategory] = useState<EquipmentCategoryLabel>(
    initialEquipment ? categoryLabel(initialEquipment.category) : 'Tractors',
  );
  const [description, setDescription] = useState(initialEquipment?.description ?? '');
  const [pricePerDay, setPricePerDay] = useState(
    initialEquipment ? String(initialEquipment.pricePerDay) : '',
  );
  const [location, setLocation] = useState(initialEquipment?.location ?? '');
  const [latitude, setLatitude] = useState(
    initialEquipment?.latitude === null || initialEquipment?.latitude === undefined
      ? ''
      : String(initialEquipment.latitude),
  );
  const [longitude, setLongitude] = useState(
    initialEquipment?.longitude === null || initialEquipment?.longitude === undefined
      ? ''
      : String(initialEquipment.longitude),
  );
  const [specifications, setSpecifications] = useState(initialEquipment?.specifications.join(', ') ?? '');
  const [availability, setAvailability] = useState<EquipmentAvailability>(
    initialEquipment?.availability ?? 'AVAILABLE',
  );
  const [retainedImageUrls, setRetainedImageUrls] = useState(() => {
    const gallery = initialEquipment?.images?.map((image) => image.url) ?? [];
    return gallery;
  });
  const [legacyImageUrl, setLegacyImageUrl] = useState(
    initialEquipment && (initialEquipment.images?.length ?? 0) === 0
      ? initialEquipment.imageUrl ?? undefined
      : undefined,
  );
  const [selectedImages, setSelectedImages] = useState<SelectedEquipmentImage[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [geocodingLocation, setGeocodingLocation] = useState(false);

  const chooseImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onSubmitError('Allow photo library access to choose listing images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, 10 - retainedImageUrls.length - selectedImages.length),
      quality: 0.85,
    });
    if (result.canceled) return;
    const nextImages = result.assets.map((asset) => ({
      uri: asset.uri,
      fileName: asset.fileName ?? `equipment-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
      ...(asset.file ? { file: asset.file } : {}),
    }));
    setSelectedImages((current) => [...current, ...nextImages].slice(0, 10 - retainedImageUrls.length));
  };

  const onSubmitError = (message: string) => setLocalError(message);
  const findEquipmentCoordinates = async () => {
    if (!location.trim()) {
      onSubmitError('Enter an equipment location before looking up its coordinates.');
      return;
    }
    setGeocodingLocation(true);
    setLocalError(null);
    try {
      const coordinates = await geocodePlace(location.trim());
      setLatitude(String(coordinates.latitude));
      setLongitude(String(coordinates.longitude));
    } catch (geocodeError) {
      onSubmitError(
        geocodeError instanceof Error
          ? geocodeError.message
          : 'Could not find that place. Enter coordinates manually.',
      );
    } finally {
      setGeocodingLocation(false);
    }
  };
  const submit = () => {
    setLocalError(null);
    const selectedCategory = categoryByLabel[category];
    const parsedPrice = Number(pricePerDay);
    const hasLatitude = latitude.trim() !== '';
    const hasLongitude = longitude.trim() !== '';
    const parsedLatitude = hasLatitude ? Number(latitude) : null;
    const parsedLongitude = hasLongitude ? Number(longitude) : null;
    if (!selectedCategory) {
      setLocalError('Choose an equipment category.');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setLocalError('Enter a valid daily price.');
      return;
    }
    if (hasLatitude !== hasLongitude) {
      setLocalError('Enter both latitude and longitude, or leave both blank.');
      return;
    }
    if (
      parsedLatitude !== null &&
      (!Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90)
    ) {
      setLocalError('Latitude must be between -90 and 90.');
      return;
    }
    if (
      parsedLongitude !== null &&
      (!Number.isFinite(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180)
    ) {
      setLocalError('Longitude must be between -180 and 180.');
      return;
    }
    onSubmit(
      {
        name: name.trim(),
        category: selectedCategory,
        description: description.trim(),
        pricePerDay: parsedPrice,
        location: location.trim(),
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        specifications: specifications.split(',').map((item) => item.trim()).filter(Boolean),
        availability,
        ...(legacyImageUrl ? { imageUrl: legacyImageUrl } : {}),
      },
      selectedImages,
      retainedImageUrls,
    );
  };

  const errorMessage = localError ?? error;
  const allPhotos = [
    ...retainedImageUrls.map((uri) => ({ uri, source: 'gallery' as const })),
    ...(legacyImageUrl ? [{ uri: legacyImageUrl, source: 'legacy' as const }] : []),
    ...selectedImages.map((image, index) => ({ uri: image.uri, source: 'selected' as const, index })),
  ];

  return (
    <ScrollView className="flex-1 bg-[#f4f7f1]" contentContainerStyle={{ padding: 18, paddingBottom: 100 }}>
      <View className="mx-auto w-full max-w-3xl gap-5 rounded-3xl border border-[#e5ebdf] bg-white p-5 md:p-8">
        <View className="gap-2">
          <ThemedText type="title" className="text-[32px] leading-[40px] text-[#173f2d]">
            {initialEquipment ? 'Edit equipment' : 'Add equipment'}
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Share clear details and photos so farmers can decide whether your equipment suits their needs.
          </ThemedText>
        </View>

        <FormField label="Equipment name">
          <TextInput value={name} onChangeText={setName} maxLength={120} placeholder="e.g. 4WD farm tractor" className={inputClass} />
        </FormField>

        <FormField label="Category">
          <View className="flex-row flex-wrap gap-2">
            {equipmentCategoryLabels.filter((item) => item !== 'All').map((item) => (
              <Pressable
                key={item}
                onPress={() => setCategory(item)}
                className={`rounded-full border px-3 py-2 ${
                  category === item ? 'border-[#173f2d] bg-[#173f2d]' : 'border-[#dce7db] bg-white'
                }`}>
                <ThemedText type="smallBold" className={category === item ? 'text-white' : 'text-[#173f2d]'}>
                  {item}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </FormField>

        <FormField label="Description">
          <TextInput
            value={description}
            onChangeText={setDescription}
            maxLength={2000}
            multiline
            placeholder="Describe the equipment and its intended use."
            className={`${inputClass} min-h-28`}
            style={{ textAlignVertical: 'top' }}
          />
        </FormField>

        <View className="gap-4 md:flex-row">
          <View className="flex-1">
            <FormField label="Daily price (ZAR)">
              <TextInput value={pricePerDay} onChangeText={setPricePerDay} keyboardType="decimal-pad" placeholder="420" className={inputClass} />
            </FormField>
          </View>
          <View className="flex-1">
            <FormField label="Location">
              <TextInput value={location} onChangeText={setLocation} maxLength={200} placeholder="Town, province" className={inputClass} />
              <Pressable
                accessibilityRole="button"
                disabled={geocodingLocation}
                onPress={() => void findEquipmentCoordinates()}
                className={`self-start rounded-xl bg-[#e5f0e9] px-4 py-2.5 ${geocodingLocation ? 'opacity-60' : ''}`}>
                <ThemedText type="smallBold" className="text-[#173f2d]">
                  {geocodingLocation ? 'Finding coordinates…' : 'Look up coordinates'}
                </ThemedText>
              </Pressable>
            </FormField>
          </View>
        </View>

        <FormField label="Coordinates (optional)">
          <View className="flex-row gap-3">
            <TextInput
              value={latitude}
              onChangeText={setLatitude}
              keyboardType="decimal-pad"
              placeholder="Latitude"
              accessibilityLabel="Latitude"
              className={`${inputClass} flex-1`}
            />
            <TextInput
              value={longitude}
              onChangeText={setLongitude}
              keyboardType="decimal-pad"
              placeholder="Longitude"
              accessibilityLabel="Longitude"
              className={`${inputClass} flex-1`}
            />
          </View>
        </FormField>

        <FormField label="Availability">
          <View className="flex-row flex-wrap gap-2">
            {(['AVAILABLE', 'LIMITED', 'BOOKED'] as const).map((value) => (
              <Pressable
                key={value}
                onPress={() => setAvailability(value)}
                className={`rounded-full border px-4 py-2 ${
                  availability === value ? 'border-[#173f2d] bg-[#e6f4e4]' : 'border-[#dce7db]'
                }`}>
                <ThemedText type="smallBold" className="text-[#173f2d]">{value}</ThemedText>
              </Pressable>
            ))}
          </View>
        </FormField>

        <FormField label={`Photos (${allPhotos.length}/10)`}>
          <View className="flex-row flex-wrap gap-3">
            {allPhotos.map((photo, index) => (
              <View key={`${photo.uri}-${index}`} className="relative">
                <Image source={{ uri: photo.uri }} className="h-24 w-24 rounded-xl bg-[#edf6ee]" />
                <Pressable
                  accessibilityLabel="Remove image"
                  onPress={() => {
                    if (photo.source === 'gallery') {
                      setRetainedImageUrls((current) => current.filter((url) => url !== photo.uri));
                    } else if (photo.source === 'selected') {
                      setSelectedImages((current) => current.filter((_, itemIndex) => itemIndex !== photo.index));
                    } else {
                      setLegacyImageUrl(undefined);
                    }
                  }}
                  className="absolute right-1 top-1 rounded-full bg-[#173f2d] px-2 py-1">
                  <ThemedText type="smallBold" className="text-white">×</ThemedText>
                </Pressable>
              </View>
            ))}
          </View>
          <Pressable
            onPress={() => void chooseImages().catch((pickerError: unknown) => {
              onSubmitError(pickerError instanceof Error ? pickerError.message : 'Could not open photo library.');
            })}
            disabled={allPhotos.length >= 10}
            className="self-start rounded-xl border border-[#cfe1bf] bg-[#f7f9f6] px-4 py-3">
            <ThemedText type="smallBold" className="text-[#173f2d]">Choose photos</ThemedText>
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary">Images upload securely to your Cloudinary equipment folder.</ThemedText>
        </FormField>

        <FormField label="Specifications (comma separated, optional)">
          <TextInput value={specifications} onChangeText={setSpecifications} placeholder="110 HP, 4WD, GPS-ready" className={inputClass} />
        </FormField>

        {errorMessage ? <ThemedText type="smallBold" className="text-[#9b2c2c]">{errorMessage}</ThemedText> : null}
        <Pressable
          disabled={submitting}
          onPress={submit}
          className={`items-center rounded-xl bg-[#173f2d] px-5 py-3.5 ${submitting ? 'opacity-60' : ''}`}>
          <ThemedText type="smallBold" className="text-white">
            {submitting ? 'Saving equipment…' : submitLabel}
          </ThemedText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <ThemedText type="smallBold">{label}</ThemedText>
      {children}
    </View>
  );
}

const inputClass = 'min-h-12 rounded-xl border border-[#dce7db] bg-[#f8faf7] px-3 py-3 text-base text-[#162114]';

function categoryLabel(category: EquipmentCategory): EquipmentCategoryLabel {
  return equipmentCategoryLabels.find((label) => categoryByLabel[label] === category)
    ?? 'Other agricultural machinery';
}
