import { Link, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';
import {
  getApiErrorMessage,
  getBookings,
  getOwnerEquipment,
  cancelBooking,
  updateBookingStatus,
  type Booking,
  type Equipment,
} from '@/lib/api';
import { formatDateOnly, isDateTodayOrFuture } from '@/lib/dates';

export default function DashboardScreen() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || user.role === 'OPERATOR') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const results = await getBookings();
      setBookings(results);
      if (user.role === 'EQUIPMENT_OWNER') {
        setEquipment(await getOwnerEquipment());
      }
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || user.role === 'OPERATOR') return;
    let active = true;

    const load = async () => {
      try {
        const results = await getBookings();
        const ownerEquipment = user.role === 'EQUIPMENT_OWNER' ? await getOwnerEquipment() : [];
        if (active) {
          setBookings(results);
          setEquipment(ownerEquipment);
          setError(null);
        }
      } catch (loadError) {
        if (active) setError(getApiErrorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [user]);

  const decide = async (bookingId: string, status: 'CONFIRMED' | 'REJECTED') => {
    setUpdatingId(bookingId);
    setError(null);
    try {
      await updateBookingStatus(bookingId, status);
      setBookings(await getBookings());
    } catch (updateError) {
      setError(getApiErrorMessage(updateError));
    } finally {
      setUpdatingId(null);
    }
  };

  const cancel = async (bookingId: string) => {
    setUpdatingId(bookingId);
    setError(null);
    try {
      await cancelBooking(bookingId);
      setBookings(await getBookings());
    } catch (cancelError) {
      setError(getApiErrorMessage(cancelError));
    } finally {
      setUpdatingId(null);
    }
  };

  if (authLoading) {
    return <ThemedView style={styles.centered}><ThemedText>Loading account…</ThemedText></ThemedView>;
  }

  if (!user) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">Sign in to view your dashboard</ThemedText>
        <ThemedText themeColor="textSecondary">Your bookings and equipment are linked to your account.</ThemedText>
        <Link href="/auth" asChild>
          <Pressable style={styles.primaryButton}>
            <ThemedText type="smallBold" style={styles.buttonText}>Sign in or create account</ThemedText>
          </Pressable>
        </Link>
      </ThemedView>
    );
  }

  if (user.role === 'OPERATOR') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        <ThemedView style={styles.headerCard}>
          <ThemedText type="title" style={styles.title}>Operator account</ThemedText>
          <ThemedText themeColor="textSecondary">
            Signed in as {user.name}. Operator profiles, certification review, and service requests are not configured yet.
          </ThemedText>
        </ThemedView>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => void signOut().then(() => router.replace('/auth'))}>
          <ThemedText type="smallBold">Sign out</ThemedText>
        </Pressable>
      </ScrollView>
    );
  }

  const isOwner = user.role === 'EQUIPMENT_OWNER';
  const pendingCount = bookings.filter((booking) => booking.status === 'PENDING').length;
  const confirmedCount = bookings.filter((booking) => booking.status === 'CONFIRMED').length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <ThemedView style={styles.headerCard}>
        <ThemedText type="title" style={styles.title}>
          {isOwner ? 'Owner dashboard' : 'Farmer dashboard'}
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Welcome, {user.name} · {isOwner ? 'Equipment owner' : 'Farmer'}
        </ThemedText>
        <Pressable
          style={styles.signOutButton}
          onPress={() => void signOut().then(() => router.replace('/auth'))}>
          <ThemedText type="smallBold">Sign out</ThemedText>
        </Pressable>
      </ThemedView>

      <View style={styles.statsRow}>
        <ThemedView style={styles.statCard}>
          <ThemedText type="small" themeColor="textSecondary">Bookings</ThemedText>
          <ThemedText type="subtitle">{bookings.length}</ThemedText>
        </ThemedView>
        <ThemedView style={styles.statCard}>
          <ThemedText type="small" themeColor="textSecondary">
            {isOwner ? 'Pending requests' : 'Pending'}
          </ThemedText>
          <ThemedText type="subtitle">{pendingCount}</ThemedText>
        </ThemedView>
        <ThemedView style={styles.statCard}>
          <ThemedText type="small" themeColor="textSecondary">Confirmed</ThemedText>
          <ThemedText type="subtitle">{confirmedCount}</ThemedText>
        </ThemedView>
      </View>

      {error ? (
        <ThemedView style={styles.errorCard}>
          <ThemedText type="smallBold" style={styles.errorText}>{error}</ThemedText>
          <Pressable onPress={() => void refresh()}>
            <ThemedText type="smallBold" style={styles.retryText}>Try again</ThemedText>
          </Pressable>
        </ThemedView>
      ) : null}

      {isOwner ? (
        <ThemedView style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">My equipment</ThemedText>
            <Link href="/equipment/new" asChild>
              <Pressable style={styles.smallAction}>
                <ThemedText type="smallBold" style={styles.smallActionText}>Add equipment</ThemedText>
              </Pressable>
            </Link>
          </View>
          {equipment.map((item) => (
            <View key={item.id} style={styles.equipmentRow}>
              <ThemedText type="smallBold">{item.name}</ThemedText>
              <ThemedText themeColor="textSecondary">
                {item.location} · R{Number(item.pricePerDay).toFixed(0)}/day
              </ThemedText>
            </View>
          ))}
          {!loading && equipment.length === 0 ? (
            <ThemedText themeColor="textSecondary">You have not listed equipment yet.</ThemedText>
          ) : null}
        </ThemedView>
      ) : null}

      <ThemedView style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle">{isOwner ? 'Booking requests' : 'My bookings'}</ThemedText>
          <Pressable onPress={() => void refresh()}>
            <ThemedText type="smallBold" style={styles.retryText}>Refresh</ThemedText>
          </Pressable>
        </View>
        {loading ? <ThemedText themeColor="textSecondary">Loading bookings…</ThemedText> : null}
        {!loading && bookings.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            {isOwner ? 'No booking requests yet.' : 'You have not requested any equipment yet.'}
          </ThemedText>
        ) : null}
        {bookings.map((booking) => (
          <View key={booking.id} style={styles.bookingCard}>
            <ThemedText type="smallBold">{booking.equipment.name}</ThemedText>
            <ThemedText themeColor="textSecondary">
              {isOwner ? `Farmer: ${booking.farmer.name}` : `Owner: ${booking.owner.name}`}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Date: {formatDateOnly(booking.requestedDate)}
            </ThemedText>
            {booking.notes ? <ThemedText themeColor="textSecondary">Notes: {booking.notes}</ThemedText> : null}
            <ThemedText type="smallBold" style={statusStyle(booking.status)}>
              {booking.status}
            </ThemedText>
            {isOwner && booking.status === 'PENDING' ? (
              <View style={styles.actionRow}>
                <Pressable
                  disabled={updatingId === booking.id}
                  style={styles.approveButton}
                  onPress={() => void decide(booking.id, 'CONFIRMED')}>
                  <ThemedText type="smallBold" style={styles.buttonText}>
                    {updatingId === booking.id ? 'Saving…' : 'Approve'}
                  </ThemedText>
                </Pressable>
                <Pressable
                  disabled={updatingId === booking.id}
                  style={styles.rejectButton}
                  onPress={() => void decide(booking.id, 'REJECTED')}>
                  <ThemedText type="smallBold" style={styles.buttonText}>Reject</ThemedText>
                </Pressable>
              </View>
            ) : null}
            {!isOwner &&
            (booking.status === 'PENDING' || booking.status === 'CONFIRMED') &&
            isDateTodayOrFuture(booking.requestedDate) ? (
              <Pressable
                disabled={updatingId === booking.id}
                style={styles.cancelButton}
                onPress={() => void cancel(booking.id)}>
                <ThemedText type="smallBold" style={styles.cancelText}>
                  {updatingId === booking.id ? 'Cancelling…' : 'Cancel booking'}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ThemedView>

      <Link href="/equipment" asChild>
        <Pressable style={styles.primaryButton}>
          <ThemedText type="smallBold" style={styles.buttonText}>
            {isOwner ? 'Browse equipment' : 'Find equipment'}
          </ThemedText>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

function statusStyle(status: Booking['status']) {
  if (status === 'CONFIRMED') return styles.statusConfirmed;
  if (status === 'REJECTED' || status === 'CANCELLED') return styles.statusRejected;
  return styles.statusPending;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f1',
  },
  container: {
    padding: 18,
    gap: 18,
    paddingBottom: 110,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f4f7f1',
    padding: 24,
    gap: 16,
  },
  headerCard: {
    backgroundColor: '#dfeecf',
    borderRadius: 22,
    padding: 18,
    gap: 8,
  },
  title: {
    fontSize: 34,
    lineHeight: 42,
  },
  signOutButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#e5ebdf',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5ebdf',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  smallAction: {
    backgroundColor: '#edf6ee',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  smallActionText: {
    color: '#173f2d',
  },
  equipmentRow: {
    padding: 12,
    borderRadius: 12,
    gap: 4,
    backgroundColor: '#f7f9f6',
  },
  bookingCard: {
    backgroundColor: '#f7f9f6',
    padding: 12,
    borderRadius: 12,
    gap: 5,
    borderWidth: 1,
    borderColor: '#e5ebdf',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  approveButton: {
    backgroundColor: '#173f2d',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#7d2c2c',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
  },
  cancelButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff2f0',
    marginTop: 6,
  },
  cancelText: {
    color: '#7d2c2c',
  },
  primaryButton: {
    backgroundColor: '#173f2d',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  secondaryButton: {
    backgroundColor: '#edf6ee',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  buttonText: {
    color: '#ffffff',
  },
  statusConfirmed: {
    color: '#173f2d',
  },
  statusPending: {
    color: '#7e5d1f',
  },
  statusRejected: {
    color: '#7d2c2c',
  },
  errorCard: {
    padding: 14,
    backgroundColor: '#fff2f0',
    borderRadius: 12,
    gap: 8,
  },
  errorText: {
    color: '#9b2c2c',
  },
  retryText: {
    color: '#1f5d3f',
  },
});
