import { useEffect, useSyncExternalStore } from 'react';

import { getNotifications } from '@/lib/api';

const listeners = new Map<string, Set<(count: number) => void>>();
const counts = new Map<string, number>();

function subscribe(userId: string | undefined, listener: (count: number) => void) {
  if (!userId) return () => {};
  let userListeners = listeners.get(userId);
  if (!userListeners) {
    userListeners = new Set();
    listeners.set(userId, userListeners);
  }
  userListeners.add(listener);
  return () => {
    userListeners?.delete(listener);
    if (userListeners?.size === 0) listeners.delete(userId);
  };
}

export function publishUnreadNotificationCount(userId: string, count: number) {
  counts.set(userId, count);
  for (const listener of listeners.get(userId) ?? []) listener(count);
}

export function useNotificationCount(enabled: boolean, userId?: string) {
  useEffect(() => {
    if (!enabled || !userId) {
      return;
    }

    let active = true;
    const refresh = async () => {
      try {
        const inbox = await getNotifications();
        if (active) publishUnreadNotificationCount(userId, inbox.unreadCount);
      } catch (error) {
        console.warn('Unable to refresh notification badge; it will retry automatically.', error);
      }
    };

    void refresh();
    const interval = setInterval(() => void refresh(), 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [enabled, userId]);

  return useSyncExternalStore(
    (listener) => subscribe(userId, listener),
    () => enabled && userId ? counts.get(userId) ?? 0 : 0,
    () => 0,
  );
}
