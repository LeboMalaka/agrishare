import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';

import { DashboardCard, DashboardError, DashboardPage } from '@/components/dashboard-ui';
import { ThemedText } from '@/components/themed-text';
import {
  getApiErrorMessage,
  getOperatorDocumentDownloadUrl,
  getOperatorProfile,
  saveOperatorProfile,
  uploadOperatorDocument,
  type OperatorDocumentInput,
  type OperatorDocumentType,
  type OperatorProfile,
} from '@/lib/api';

const documentTypes: { value: OperatorDocumentType; label: string }[] = [
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'LICENSE', label: 'License' },
  { value: 'IDENTITY', label: 'Identity' },
  { value: 'OTHER', label: 'Other' },
];

export default function OperatorAccountScreen() {
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [documentType, setDocumentType] = useState<OperatorDocumentType>('CERTIFICATE');
  const [selectedDocuments, setSelectedDocuments] = useState<OperatorDocumentInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const current = await getOperatorProfile();
      setProfile(current);
      setBio(current.bio ?? '');
      setExperience(String(current.experienceYears));
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void getOperatorProfile()
      .then((current) => {
        if (active) {
          setProfile(current);
          setBio(current.bio ?? '');
          setExperience(String(current.experienceYears));
        }
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

  const chooseDocuments = async () => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const files = result.assets.map((asset) => {
        const mimeType = asset.mimeType ?? 'application/octet-stream';
        return {
          uri: asset.uri,
          fileName: asset.name,
          mimeType,
          type: documentType,
          ...(asset.file ? { file: asset.file } : {}),
        };
      });
      const unsupported = files.find((file) =>
        !['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimeType),
      );
      if (unsupported) {
        setError(`${unsupported.fileName} is not a supported file. Choose a PDF, JPG, or PNG.`);
        return;
      }
      if (selectedDocuments.length + files.length > 10) {
        setError('You can submit at most 10 documents at a time.');
        return;
      }
      if (files.some((file) => !file.fileName.trim() || file.fileName.length > 200)) {
        setError('Each file name must be between 1 and 200 characters.');
        return;
      }
      setSelectedDocuments((current) => [...current, ...files]);
    } catch (pickError) {
      setError(getApiErrorMessage(pickError));
    }
  };

  const saveProfile = async () => {
    const years = Number(experience);
    if (!Number.isInteger(years) || years < 0 || years > 60) {
      setError('Enter a whole number of experience years from 0 to 60.');
      return;
    }
    if (bio.trim().length > 2000) {
      setError('Your profile description must be 2000 characters or fewer.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const uploadedDocuments = [];
      for (const document of selectedDocuments) {
        const publicId = await uploadOperatorDocument(document);
        uploadedDocuments.push({
          publicId,
          originalName: document.fileName,
          type: document.type,
        });
      }
      const updated = await saveOperatorProfile({
        bio: bio.trim(),
        experienceYears: years,
        documents: uploadedDocuments,
      });
      setProfile(updated);
      setSelectedDocuments([]);
      setMessage(uploadedDocuments.length > 0
        ? 'Profile and private documents submitted for verification.'
        : 'Profile details saved.');
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const openDocument = async (id: string) => {
    setOpeningId(id);
    setError(null);
    try {
      const download = await getOperatorDocumentDownloadUrl(id);
      await Linking.openURL(download.url);
    } catch (openError) {
      setError(getApiErrorMessage(openError));
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <DashboardPage
      eyebrow="Certified operator"
      title="Your profile"
      subtitle="Keep your operator details current and submit private documents for certification review.">
      {error ? <DashboardError message={error} onRetry={() => void refresh()} /> : null}

      <DashboardCard title="Profile details">
        <ThemedText themeColor="textSecondary">
          Describe your operating experience and submit a certificate, license, or identity document. Documents are stored as private Cloudinary assets.
        </ThemedText>
        <TextInput
          value={bio}
          onChangeText={setBio}
          editable={!loading && !saving}
          multiline
          maxLength={2000}
          accessibilityLabel="Operator profile description"
          placeholder="Describe the equipment you operate and your relevant experience"
          className="min-h-28 rounded-xl border border-[#dce7db] bg-[#f8faf7] px-4 py-3 text-base text-[#162114]"
        />
        <View className="gap-3 md:flex-row">
          <TextInput
            value={experience}
            onChangeText={setExperience}
            keyboardType="number-pad"
            editable={!loading && !saving}
            accessibilityLabel="Years of operator experience"
            placeholder="Years of experience"
            className="min-h-12 flex-1 rounded-xl border border-[#dce7db] bg-[#f8faf7] px-4 py-3 text-base text-[#162114]"
          />
          <Pressable
            onPress={() => void saveProfile()}
            disabled={loading || saving || !profile}
            className={`items-center justify-center rounded-xl bg-[#173f2d] px-5 py-3 ${
              loading || saving || !profile ? 'opacity-60' : ''
            }`}>
            <ThemedText type="smallBold" className="text-white">
              {saving ? 'Saving…' : 'Save profile'}
            </ThemedText>
          </Pressable>
        </View>
        <View className="gap-2">
          <ThemedText type="smallBold">Document type</ThemedText>
          <View className="flex-row flex-wrap gap-2">
            {documentTypes.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected: documentType === option.value }}
                onPress={() => setDocumentType(option.value)}
                className={`rounded-full border px-3 py-2 ${
                  documentType === option.value
                    ? 'border-[#173f2d] bg-[#173f2d]'
                    : 'border-[#dce7db] bg-white'
                }`}>
                <ThemedText
                  type="smallBold"
                  className={documentType === option.value ? 'text-white' : 'text-[#173f2d]'}>
                  {option.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => void chooseDocuments()}
            disabled={loading || saving || selectedDocuments.length >= 10}
            className="items-center rounded-xl border border-[#dce7db] bg-[#f7f9f6] px-4 py-3">
            <ThemedText type="smallBold" className="text-[#173f2d]">
              Choose PDF or image documents ({selectedDocuments.length}/10)
            </ThemedText>
          </Pressable>
          {selectedDocuments.map((document, index) => (
            <View key={`${document.fileName}-${index}`} className="flex-row items-center justify-between gap-3 rounded-lg bg-[#f8faf7] p-3">
              <ThemedText type="small" className="flex-1">{document.fileName}</ThemedText>
              <Pressable onPress={() => setSelectedDocuments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                <ThemedText type="smallBold" className="text-[#9b2c2c]">Remove</ThemedText>
              </Pressable>
            </View>
          ))}
          {selectedDocuments.length > 0 ? (
            <Pressable
              onPress={() => void saveProfile()}
              disabled={loading || saving || !profile}
              className={`items-center rounded-xl bg-[#173f2d] px-5 py-3 ${
                loading || saving || !profile ? 'opacity-60' : ''
              }`}>
              <ThemedText type="smallBold" className="text-white">
                {saving ? 'Uploading securely…' : 'Submit documents'}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
        {message ? <ThemedText type="smallBold" className="text-[#1f5d3f]">{message}</ThemedText> : null}
      </DashboardCard>

      <DashboardCard title="Submitted documents">
        {!loading && profile?.documents.length === 0 ? (
          <ThemedText themeColor="textSecondary">No documents submitted yet.</ThemedText>
        ) : null}
        {profile?.documents.map((document) => (
          <View key={document.id} className="flex-row flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5ebdf] bg-[#f8faf7] p-4">
            <View className="min-w-[180px] flex-1 gap-1">
              <ThemedText type="smallBold">{document.originalName}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {document.type.replace('_', ' ')} · {document.status}
              </ThemedText>
              {document.reviewNotes ? (
                <ThemedText type="small" themeColor="textSecondary">{document.reviewNotes}</ThemedText>
              ) : null}
            </View>
            <Pressable
              onPress={() => void openDocument(document.id)}
              disabled={openingId === document.id}
              className="rounded-lg border border-[#dce7db] bg-white px-3 py-2">
              <ThemedText type="smallBold" className="text-[#173f2d]">
                {openingId === document.id ? 'Opening…' : 'View securely'}
              </ThemedText>
            </Pressable>
          </View>
        ))}
      </DashboardCard>
    </DashboardPage>
  );
}
