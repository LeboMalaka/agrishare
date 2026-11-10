import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';

import { DashboardCard, DashboardError, DashboardPage, MetricCard } from '@/components/dashboard-ui';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';
import { getApiErrorMessage, getBookings, type Booking } from '@/lib/api';

export default function FarmerDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [search, setSearch] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBookings(await getBookings());
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadBookings = async () => {
      try {
        const results = await getBookings();
        if (active) {
          setBookings(results);
          setError(null);
        }
      } catch (loadError) {
        if (active) setError(getApiErrorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadBookings();
    const interval = setInterval(() => {
      void getBookings()
        .then((results) => {
          if (active) {
            setBookings(results);
            setError(null);
          }
        })
        .catch((loadError: unknown) => {
          if (active) setError(getApiErrorMessage(loadError));
        });
    }, 15_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const activeBookings = bookings.filter((booking) => booking.status === 'CONFIRMED').length;
  const searchEquipment = () => {
    const term = search.trim() || location.trim();
    router.push(term ? { pathname: '/equipment', params: { search: term } } : '/equipment');
  };

  return (
    <DashboardPage
      eyebrow="Farmer workspace"
      title={`Welcome${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
      subtitle="Find the right equipment for your next season and keep track of your bookings.">
      <View className="flex-row flex-wrap gap-3">
        <MetricCard
          label="Active bookings"
          value={loading ? '—' : activeBookings}
          detail="Confirmed equipment bookings"
        />
        <MetricCard
          label="Awaiting approval"
          value={loading ? '—' : bookings.filter((booking) => booking.status === 'PENDING').length}
          detail="Requests with owners"
        />
      </View>

      <DashboardCard title="Find equipment">
        <View className="gap-3 md:flex-row">
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={searchEquipment}
            returnKeyType="search"
            placeholder="Search tractors, drones, storage…"
            accessibilityLabel="Search equipment"
            className="min-h-12 flex-1 rounded-xl border border-[#dce7db] bg-[#f8faf7] px-4 py-3 text-base text-[#162114]"
          />
          <Pressable
            onPress={searchEquipment}
            className="items-center justify-center rounded-xl bg-[#173f2d] px-5 py-3"
            accessibilityRole="button">
            <ThemedText type="smallBold" className="text-white">Search</ThemedText>
          </Pressable>
        </View>
        <View className="gap-1 rounded-xl bg-[#f7f9f6] p-4">
          <ThemedText type="smallBold" className="text-[#173f2d]">Current search location</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {location.trim() || 'Location not set'}
          </ThemedText>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Add a town or farming area"
            accessibilityLabel="Current search location"
            className="rounded-lg border border-[#e5ebdf] bg-white px-3 py-2 text-base text-[#162114]"
          />
        </View>
      </DashboardCard>

      {error ? <DashboardError message={error} onRetry={() => void refresh()} /> : null}

      <DashboardCard title="Booking summary">
        {loading ? (
          <ThemedText themeColor="textSecondary">Loading your bookings…</ThemedText>
        ) : (
          <View className="flex-row flex-wrap gap-3">
            <View className="min-w-[150px] flex-1 gap-1 rounded-xl bg-[#f7f9f6] p-4">
              <ThemedText type="smallBold">Confirmed</ThemedText>
              <ThemedText themeColor="textSecondary">{activeBookings} active booking{activeBookings === 1 ? '' : 's'}</ThemedText>
            </View>
            <View className="min-w-[150px] flex-1 gap-1 rounded-xl bg-[#f7f9f6] p-4">
              <ThemedText type="smallBold">Requests</ThemedText>
              <ThemedText themeColor="textSecondary">
                {bookings.filter((booking) => booking.status === 'PENDING').length} awaiting owner approval
              </ThemedText>
            </View>
          </View>
        )}
      </DashboardCard>

      <DashboardCard title="Notifications">
        <View className="flex-row items-center justify-between gap-4">
          <View className="flex-1 gap-1">
            <ThemedText type="smallBold">Booking updates</ThemedText>
            <ThemedText themeColor="textSecondary">
              {notificationsEnabled ? 'Notifications are on for booking activity.' : 'Notifications are paused.'}
            </ThemedText>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            accessibilityLabel="Toggle booking notifications"
            trackColor={{ false: '#c9d1c5', true: '#8eb48b' }}
            thumbColor={notificationsEnabled ? '#173f2d' : '#f4f7f1'}
          />
        </View>
      </DashboardCard>
    </DashboardPage>
  );
}
