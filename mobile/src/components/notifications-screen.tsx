import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';
import { getApiErrorMessage, getNotifications, markNotificationRead, type NotificationItem } from '@/lib/api';
import { publishUnreadNotificationCount } from '@/lib/use-notification-count';

export function NotificationsScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const inbox = await getNotifications();
      setNotifications(inbox.notifications);
      setUnreadCount(inbox.unreadCount);
      if (user) publishUnreadNotificationCount(user.id, inbox.unreadCount);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    void getNotifications()
      .then((inbox) => {
        if (active) {
          setNotifications(inbox.notifications);
          setUnreadCount(inbox.unreadCount);
          if (user) publishUnreadNotificationCount(user.id, inbox.unreadCount);
          setError(null);
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
  }, [user]);

  const markRead = async (item: NotificationItem) => {
    if (item.readAt || updatingId) return;
    setUpdatingId(item.id);
    setError(null);
    try {
      const result = await markNotificationRead(item.id);
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === item.id ? result.notification : notification,
        ),
      );
      setUnreadCount(result.unreadCount);
      if (user) publishUnreadNotificationCount(user.id, result.unreadCount);
    } catch (updateError) {
      setError(getApiErrorMessage(updateError));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={styles.eyebrow}>Your updates</ThemedText>
        <ThemedText type="title" style={styles.pageTitle}>Notifications</ThemedText>
        <ThemedText themeColor="textSecondary">
          {unreadCount} unread notification{unreadCount === 1 ? '' : 's'} about bookings and certification.
        </ThemedText>
      </View>
      {error ? (
        <View style={styles.errorCard}>
          <ThemedText type="smallBold" style={styles.errorText}>{error}</ThemedText>
          <Pressable onPress={() => void refresh()}>
            <ThemedText type="smallBold" style={styles.retryText}>Try again</ThemedText>
          </Pressable>
        </View>
      ) : null}
      {loading ? <ThemedText themeColor="textSecondary">Loading notifications…</ThemedText> : null}
      {!loading && notifications.length === 0 ? (
        <View style={styles.emptyCard}>
          <ThemedText type="smallBold">You’re all caught up</ThemedText>
          <ThemedText themeColor="textSecondary">Booking and certification updates will appear here.</ThemedText>
        </View>
      ) : null}
      <View style={styles.list}>
        {notifications.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.readAt ? 'Read' : 'Unread'} notification: ${item.title}`}
            onPress={() => void markRead(item)}
            disabled={Boolean(updatingId)}
            style={[styles.notification, !item.readAt && styles.unreadNotification]}>
            <View style={styles.notificationHeading}>
              <ThemedText type="smallBold" style={styles.title}>{item.title}</ThemedText>
              {!item.readAt ? <View style={styles.unreadDot} /> : null}
            </View>
            <ThemedText themeColor="textSecondary">{item.message}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {new Date(item.createdAt).toLocaleString()}
              {updatingId === item.id ? ' · Marking read…' : ''}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f1',
  },
  container: {
    width: '100%',
    maxWidth: 1024,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 110,
    gap: 16,
  },
  header: {
    gap: 8,
    padding: 20,
    borderRadius: 22,
    backgroundColor: '#dfeecf',
  },
  eyebrow: {
    color: '#1f5d3f',
    textTransform: 'uppercase',
  },
  pageTitle: {
    color: '#173f2d',
  },
  list: {
    gap: 12,
    paddingBottom: 24,
  },
  notification: {
    gap: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5ebdf',
    backgroundColor: '#ffffff',
  },
  unreadNotification: {
    borderColor: '#b8cdb0',
    backgroundColor: '#f7fbf5',
  },
  notificationHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    color: '#173f2d',
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#1f5d3f',
  },
  emptyCard: {
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 18,
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
  retryText: {
    color: '#1f5d3f',
  },
});
