import { Tabs } from 'expo-router';

import { RoleRouteGuard } from '@/components/role-route-guard';
import { useAuth } from '@/context/auth-context';
import { useNotificationCount } from '@/lib/use-notification-count';

export default function OwnerLayout() {
  const { user } = useAuth();
  const unreadCount = useNotificationCount(user?.role === 'EQUIPMENT_OWNER', user?.id);
  return (
    <RoleRouteGuard role="EQUIPMENT_OWNER">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarIcon: () => null,
          tabBarActiveTintColor: '#173f2d',
          tabBarInactiveTintColor: '#748071',
          tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e5ebdf' },
        }}>
        <Tabs.Screen name="owner/index" options={{ title: 'Overview' }} />
        <Tabs.Screen name="owner/manage" options={{ title: 'Listings' }} />
        <Tabs.Screen name="owner/bookings" options={{ title: 'Bookings' }} />
        <Tabs.Screen name="owner/add" options={{ title: 'Add equipment' }} />
        <Tabs.Screen
          name="owner/notifications"
          options={{
            title: 'Alerts',
            tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
            tabBarBadgeStyle: { backgroundColor: '#b42318' },
          }}
        />
      </Tabs>
    </RoleRouteGuard>
  );
}
