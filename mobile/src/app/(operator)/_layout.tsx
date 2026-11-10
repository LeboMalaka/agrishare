import { Tabs } from 'expo-router';

import { RoleRouteGuard } from '@/components/role-route-guard';
import { useAuth } from '@/context/auth-context';
import { useNotificationCount } from '@/lib/use-notification-count';

export default function OperatorLayout() {
  const { user } = useAuth();
  const unreadCount = useNotificationCount(user?.role === 'OPERATOR', user?.id);
  return (
    <RoleRouteGuard role="OPERATOR">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarIcon: () => null,
          tabBarActiveTintColor: '#173f2d',
          tabBarInactiveTintColor: '#748071',
          tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e5ebdf' },
        }}>
        <Tabs.Screen name="operator/index" options={{ title: 'Overview' }} />
        <Tabs.Screen name="operator/account" options={{ title: 'Account' }} />
        <Tabs.Screen
          name="operator/notifications"
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
