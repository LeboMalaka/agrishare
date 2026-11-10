import { Link } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';
import {
  cancelBooking,
  getApiErrorMessage,
  getMyBookings,
  getOwnerBookingRequests,
  updateBookingStatus,
  type Booking,
} from '@/lib/api';
import { formatDateOnly, getLocalDateString, isDateTodayOrFuture } from '@/lib/dates';

type BookingTab = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

const tabs: { key: BookingTab; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export function BookingManagementScreen() {
  const { user } = useAuth();
  const isOwner = user?.role === 'EQUIPMENT_OWNER';
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<BookingTab>('PENDING');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || (user.role !== 'FARMER' && user.role !== 'EQUIPMENT_OWNER')) return;
    setLoading(true);
    setError(null);
    try {
      setBookings(isOwner ? await getOwnerBookingRequests() : await getMyBookings());
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [isOwner, user]);

  useEffect(() => {
    let active = true;
    const loadBookings = async () => {
      if (!user || (user.role !== 'FARMER' && user.role !== 'EQUIPMENT_OWNER')) {
        setLoading(false);
        return;
      }
      try {
        const results = isOwner ? await getOwnerBookingRequests() : await getMyBookings();
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
      if (!user || (user.role !== 'FARMER' && user.role !== 'EQUIPMENT_OWNER')) return;
      void (isOwner ? getOwnerBookingRequests() : getMyBookings())
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
  }, [isOwner, user]);

  const visibleBookings = useMemo(() => bookings.filter((booking) => {
    if (activeTab === 'PENDING') return booking.status === 'PENDING';
    if (activeTab === 'CONFIRMED') {
      return booking.status === 'CONFIRMED' && isDateTodayOrFuture(booking.requestedDate);
    }
    if (activeTab === 'COMPLETED') {
      return booking.status === 'CONFIRMED' && booking.requestedDate.slice(0, 10) < getLocalDateString();
    }
    return booking.status === 'CANCELLED' || booking.status === 'REJECTED';
  }), [activeTab, bookings]);

  const updateBooking = async (
    bookingId: string,
    action: 'approve' | 'reject' | 'cancel',
  ) => {
    setUpdatingId(bookingId);
    setError(null);
    try {
      if (action === 'cancel') await cancelBooking(bookingId);
      else await updateBookingStatus(bookingId, action === 'approve' ? 'CONFIRMED' : 'REJECTED');
      await refresh();
    } catch (updateError) {
      setError(getApiErrorMessage(updateError));
    } finally {
      setUpdatingId(null);
    }
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <ThemedText type="subtitle">Sign in to manage bookings</ThemedText>
        <Link href="/auth" asChild>
          <Pressable style={styles.primaryButton}>
            <ThemedText type="smallBold" style={styles.primaryText}>Sign in</ThemedText>
          </Pressable>
        </Link>
      </View>
    );
  }

  const title = isOwner ? 'Booking requests' : 'My bookings';
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>{title}</ThemedText>
        <ThemedText themeColor="textSecondary">
          {isOwner
            ? 'Review incoming requests and keep track of your equipment bookings.'
            : 'Track requests and upcoming equipment reservations.'}
        </ThemedText>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {tabs.map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tab, selected && styles.selectedTab]}>
              <ThemedText type="smallBold" style={selected ? styles.selectedTabText : styles.tabText}>
                {tab.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? (
        <View style={styles.errorCard}>
          <ThemedText type="smallBold" style={styles.errorText}>{error}</ThemedText>
          <Pressable onPress={() => void refresh()}>
            <ThemedText type="smallBold" style={styles.linkText}>Try again</ThemedText>
          </Pressable>
        </View>
      ) : null}
      {loading ? <ThemedText themeColor="textSecondary">Loading bookings…</ThemedText> : null}
      {!loading && visibleBookings.length === 0 ? (
        <View style={styles.emptyCard}>
          <ThemedText type="smallBold">No {activeTab.toLowerCase()} bookings</ThemedText>
          <ThemedText themeColor="textSecondary">
            {isOwner ? 'New farmer requests will appear here.' : 'Your equipment booking activity will appear here.'}
          </ThemedText>
        </View>
      ) : null}

      {visibleBookings.map((booking) => (
        <View key={booking.id} style={styles.bookingCard}>
          <View style={styles.bookingHeading}>
            <View style={styles.bookingTitleGroup}>
              <ThemedText type="smallBold" style={styles.equipmentName}>{booking.equipment.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {isOwner ? `Farmer: ${booking.farmer.name}` : `Owner: ${booking.owner.name}`}
              </ThemedText>
            </View>
            <View style={[styles.statusPill, booking.status === 'PENDING' ? styles.pendingPill :
              booking.status === 'CONFIRMED' ? styles.confirmedPill :
                booking.status === 'REJECTED' ? styles.rejectedPill : styles.cancelledPill]}>
              <ThemedText type="smallBold">{booking.status}</ThemedText>
            </View>
          </View>
          <ThemedText themeColor="textSecondary">Date: {formatDateOnly(booking.requestedDate)}</ThemedText>
          {booking.notes ? <ThemedText themeColor="textSecondary">Notes: {booking.notes}</ThemedText> : null}

          {isOwner && booking.status === 'PENDING' ? (
            <View style={styles.actions}>
              <Pressable
                disabled={updatingId === booking.id}
                onPress={() => void updateBooking(booking.id, 'approve')}
                style={[styles.primaryButton, updatingId === booking.id && styles.disabled]}>
                <ThemedText type="smallBold" style={styles.primaryText}>
                  {updatingId === booking.id ? 'Saving…' : 'Approve'}
                </ThemedText>
              </Pressable>
              <Pressable
                disabled={updatingId === booking.id}
                onPress={() => void updateBooking(booking.id, 'reject')}
                style={[styles.rejectButton, updatingId === booking.id && styles.disabled]}>
                <ThemedText type="smallBold" style={styles.rejectText}>Reject</ThemedText>
              </Pressable>
            </View>
          ) : null}
          {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') &&
          isDateTodayOrFuture(booking.requestedDate) ? (
            <Pressable
              disabled={updatingId === booking.id}
              onPress={() => void updateBooking(booking.id, 'cancel')}
              style={[styles.cancelButton, updatingId === booking.id && styles.disabled]}>
              <ThemedText type="smallBold" style={styles.cancelText}>
                {updatingId === booking.id ? 'Cancelling…' : isOwner ? 'Cancel booking' : 'Cancel request'}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f1',
  },
  container: {
    padding: 18,
    paddingBottom: 110,
    gap: 14,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: '#f4f7f1',
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
  },
  tabs: {
    gap: 8,
  },
  tab: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dfe8db',
    backgroundColor: '#ffffff',
  },
  selectedTab: {
    backgroundColor: '#173f2d',
    borderColor: '#173f2d',
  },
  tabText: {
    color: '#173f2d',
  },
  selectedTabText: {
    color: '#ffffff',
  },
  errorCard: {
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#fff2f0',
  },
  errorText: {
    color: '#9b2c2c',
  },
  linkText: {
    color: '#1f5d3f',
  },
  emptyCard: {
    gap: 8,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  bookingCard: {
    gap: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5ebdf',
    backgroundColor: '#ffffff',
  },
  bookingHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  bookingTitleGroup: {
    flex: 1,
    gap: 4,
  },
  equipmentName: {
    color: '#173f2d',
  },
  statusPill: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  pendingPill: {
    backgroundColor: '#fff5dc',
  },
  confirmedPill: {
    backgroundColor: '#e6f4e4',
  },
  rejectedPill: {
    backgroundColor: '#fff2f0',
  },
  cancelledPill: {
    backgroundColor: '#e7e9e5',
  },
  actions: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 4,
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 11,
    backgroundColor: '#173f2d',
  },
  primaryText: {
    color: '#ffffff',
  },
  rejectButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 11,
    backgroundColor: '#fff2f0',
  },
  rejectText: {
    color: '#9b2c2c',
  },
  cancelButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff2f0',
  },
  cancelText: {
    color: '#9b2c2c',
  },
  disabled: {
    opacity: 0.6,
  },
});
