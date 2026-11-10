import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';
import type { UserRole } from '@/lib/api';

type DashboardRoute = '/farmer' | '/owner' | '/operator';

function dashboardForRole(role: UserRole): DashboardRoute {
  if (role === 'FARMER') return '/farmer';
  if (role === 'EQUIPMENT_OWNER') return '/owner';
  return '/operator';
}

export function RoleRouteGuard({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && (!user || user.role !== role)) {
      router.replace(user ? dashboardForRole(user.role) : '/auth');
    }
  }, [loading, role, user]);

  if (loading || !user || user.role !== role) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f4f7f1] p-6">
        <ThemedText>{loading ? 'Loading your account…' : 'Opening your dashboard…'}</ThemedText>
      </View>
    );
  }

  return <>{children}</>;
}
