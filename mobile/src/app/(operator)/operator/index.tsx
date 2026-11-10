import { useCallback, useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { DashboardCard, DashboardError, DashboardPage, MetricCard } from '@/components/dashboard-ui';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';
import {
  getApiErrorMessage,
  getOperatorProfile,
  saveOperatorProfile,
  type OperatorProfile,
} from '@/lib/api';

function certificationLabel(status: OperatorProfile['certificationStatus']) {
  if (status === 'CERTIFIED') return 'Verified';
  if (status === 'REJECTED') return 'Rejected';
  return 'Pending';
}

function documentStatusClass(status: OperatorProfile['documents'][number]['status']) {
  if (status === 'APPROVED') return 'text-[#1f5d3f]';
  if (status === 'REJECTED') return 'text-[#9b2c2c]';
  return 'text-[#7e5d1f]';
}

export default function OperatorDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [experience, setExperience] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const operatorProfile = await getOperatorProfile();
      setProfile(operatorProfile);
      setExperience(String(operatorProfile.experienceYears));
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const operatorProfile = await getOperatorProfile();
        if (active) {
          setProfile(operatorProfile);
          setExperience(String(operatorProfile.experienceYears));
          setError(null);
        }
      } catch (loadError) {
        if (active) setError(getApiErrorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const saveExperience = async () => {
    const years = Number(experience);
    if (!Number.isInteger(years) || years < 0 || years > 60) {
      setError('Enter a whole number of experience years from 0 to 60.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updatedProfile = await saveOperatorProfile({
        bio: profile?.bio ?? '',
        experienceYears: years,
        documents: [],
      });
      setProfile(updatedProfile);
      setExperience(String(updatedProfile.experienceYears));
      setMessage('Experience details saved.');
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const certification = profile ? certificationLabel(profile.certificationStatus) : 'Pending';
  return (
    <DashboardPage
      eyebrow="Certified operator workspace"
      title={`Welcome${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
      subtitle="Keep your operator profile current and follow the progress of your verification.">
      {error ? <DashboardError message={error} onRetry={() => void refresh()} /> : null}

      <View className="flex-row flex-wrap gap-3">
        <MetricCard
          label="Verification"
          value={loading ? '—' : certification}
          detail="Operator certification review"
        />
        <MetricCard
          label="Experience"
          value={loading || !profile ? '—' : `${profile.experienceYears} yrs`}
          detail="Your professional experience"
        />
        <MetricCard
          label="Documents"
          value={loading || !profile ? '—' : profile.documents.length}
          detail="Files on your operator profile"
        />
      </View>

      {profile ? (
        <DashboardCard title="Verification status">
          <View className="flex-row flex-wrap items-center gap-3">
            <View className={`rounded-full px-4 py-2 ${
              certification === 'Verified'
                ? 'bg-[#e6f4e4]'
                : certification === 'Rejected'
                  ? 'bg-[#fff2f0]'
                  : 'bg-[#fff5dc]'
            }`}>
              <ThemedText type="smallBold" className={
                certification === 'Verified'
                  ? 'text-[#1f5d3f]'
                  : certification === 'Rejected'
                    ? 'text-[#9b2c2c]'
                    : 'text-[#7e5d1f]'
              }>
                {certification}
              </ThemedText>
            </View>
            <ThemedText className="flex-1" themeColor="textSecondary">
              {profile.certificationStatus === 'CERTIFIED'
                ? 'Your operator profile has been verified.'
                : profile.certificationStatus === 'REJECTED'
                  ? 'Your verification was rejected. Check your document review notes.'
                  : 'Your profile is waiting for a certification review.'}
            </ThemedText>
          </View>
        </DashboardCard>
      ) : null}

      <DashboardCard title="Experience manager">
        <ThemedText themeColor="textSecondary">
          Update the number of years you have worked as an equipment operator.
        </ThemedText>
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
            onPress={() => void saveExperience()}
            disabled={loading || saving || !profile}
            className={`items-center justify-center rounded-xl bg-[#173f2d] px-5 py-3 ${
              loading || saving || !profile ? 'opacity-60' : ''
            }`}>
            <ThemedText type="smallBold" className="text-white">
              {saving ? 'Saving…' : 'Save experience'}
            </ThemedText>
          </Pressable>
        </View>
        {message ? <ThemedText type="smallBold" className="text-[#1f5d3f]">{message}</ThemedText> : null}
      </DashboardCard>

      <DashboardCard title="Document status">
        {!loading && profile?.documents.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            No documents have been submitted to your profile yet.
          </ThemedText>
        ) : null}
        {profile?.documents.map((document) => (
          <View key={document.id} className="gap-1 rounded-xl border border-[#e5ebdf] bg-[#f8faf7] p-4">
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <ThemedText type="smallBold">{document.originalName}</ThemedText>
              <ThemedText type="smallBold" className={documentStatusClass(document.status)}>
                {document.status}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {document.type.replace('_', ' ')}
            </ThemedText>
            {document.reviewNotes ? (
              <ThemedText type="small" themeColor="textSecondary">{document.reviewNotes}</ThemedText>
            ) : null}
          </View>
        ))}
      </DashboardCard>
    </DashboardPage>
  );
}
