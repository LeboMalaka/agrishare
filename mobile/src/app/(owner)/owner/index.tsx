import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { DashboardCard, DashboardError, DashboardPage, ActionLink, MetricCard } from '@/components/dashboard-ui';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';
import { getApiErrorMessage, getBookings, getOwnerEquipment, type Booking, type Equipment } from '@/lib/api';

export default function OwnerDashboard() {
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ownerEquipment, ownerBookings] = await Promise.all([getOwnerEquipment(), getBookings()]);
      setEquipment(ownerEquipment);
      setBookings(ownerBookings);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      try {
        const [ownerEquipment, ownerBookings] = await Promise.all([getOwnerEquipment(), getBookings()]);
        if (active) {
          setEquipment(ownerEquipment);
          setBookings(ownerBookings);
          setError(null);
        }
      } catch (loadError) {
        if (active) setError(getApiErrorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadDashboard();
    const interval = setInterval(() => {
      void Promise.all([getOwnerEquipment(), getBookings()])
        .then(([ownerEquipment, ownerBookings]) => {
          if (active) {
            setEquipment(ownerEquipment);
            setBookings(ownerBookings);
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

  const pendingCount = bookings.filter((booking) => booking.status === 'PENDING').length;
  const activeListings = equipment.length;

  return (
    <DashboardPage
      eyebrow="Equipment owner workspace"
      title={`Welcome${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
      subtitle="Manage your equipment, review incoming requests, and keep your listings up to date.">
      {error ? <DashboardError message={error} onRetry={() => void refresh()} /> : null}

      <View className="flex-row flex-wrap gap-3">
        <MetricCard
          label="Equipment"
          value={loading ? '—' : equipment.length}
          detail="Total items in your account"
        />
        <MetricCard
          label="Pending requests"
          value={loading ? '—' : pendingCount}
          detail="Bookings awaiting your decision"
        />
        <MetricCard
          label="Confirmed bookings"
          value={loading ? '—' : bookings.filter((booking) => booking.status === 'CONFIRMED').length}
          detail="Approved equipment reservations"
        />
        <MetricCard
          label="Active listings"
          value={loading ? '—' : activeListings}
          detail="Equipment listed in the marketplace"
        />
      </View>

      <DashboardCard title="Quick actions">
        <View className="flex-row flex-wrap gap-3">
          <View className="min-w-[180px] flex-1">
            <ActionLink label="Add equipment" href="/owner/add" primary />
          </View>
          <View className="min-w-[180px] flex-1">
            <ActionLink label="Manage listings" href="/owner/manage" />
          </View>
          <View className="min-w-[180px] flex-1">
            <ActionLink label="Review booking requests" href="/owner/bookings" />
          </View>
        </View>
      </DashboardCard>

      <DashboardCard title="Active listings">
        {loading ? <ThemedText themeColor="textSecondary">Loading your equipment…</ThemedText> : null}
        {!loading && equipment.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            No equipment is listed yet. Add your first item to make it available to farmers.
          </ThemedText>
        ) : null}
        {equipment.slice(0, 4).map((item) => (
          <View key={item.id} className="gap-1 rounded-xl border border-[#e5ebdf] bg-[#f8faf7] p-4">
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <ThemedText type="smallBold">{item.name}</ThemedText>
              <ThemedText type="smallBold" className="text-[#1f5d3f]">
                {item.availability.replace('_', ' ')}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {item.location} · R{Number(item.pricePerDay).toFixed(0)}/day
            </ThemedText>
          </View>
        ))}
        {!loading && equipment.length > 4 ? (
          <ThemedText type="small" themeColor="textSecondary">
            And {equipment.length - 4} more listing{equipment.length - 4 === 1 ? '' : 's'}.
          </ThemedText>
        ) : null}
      </DashboardCard>
    </DashboardPage>
  );
}
