import { Tabs } from 'expo-router';

import { RoleRouteGuard } from '@/components/role-route-guard';
import { useAuth } from '@/context/auth-context';
import { useNotificationCount } from '@/lib/use-notification-count';

export default function FarmerLayout() {
  const { user } = useAuth();
  const unreadCount = useNotificationCount(user?.role === 'FARMER', user?.id);
  return (
    <RoleRouteGuard role="FARMER">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarIcon: () => null,
          tabBarActiveTintColor: '#173f2d',
          tabBarInactiveTintColor: '#748071',
          tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e5ebdf' },
        }}>
        <Tabs.Screen name="farmer/index" options={{ title: 'Home' }} />
        <Tabs.Screen name="farmer/search" options={{ title: 'Find equipment' }} />
        <Tabs.Screen name="farmer/bookings" options={{ title: 'Bookings' }} />
        <Tabs.Screen
          name="farmer/notifications"
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
