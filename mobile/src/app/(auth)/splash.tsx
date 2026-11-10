import { Link, router } from 'expo-router';
import { useEffect } from 'react';
import { ImageBackground, Pressable, View, useWindowDimensions } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';

function dashboardRoute(role: 'FARMER' | 'EQUIPMENT_OWNER' | 'OPERATOR') {
  if (role === 'FARMER') return '/farmer';
  if (role === 'EQUIPMENT_OWNER') return '/owner';
  return '/operator';
}

export default function SplashScreen() {
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 900;
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) router.replace(dashboardRoute(user.role));
  }, [loading, user]);

  return (
    <ImageBackground
      source={require('../../../assets/images/agrishare-login-background.jpeg')}
      resizeMode="cover"
      imageStyle={{ width: '100%', height: '100%' }}
      className="flex-1">
      <View className={`flex-1 justify-center p-5 md:p-10 ${isWideScreen ? 'items-end' : 'items-center'}`}>
        <View className="absolute inset-0 bg-[#10251a]/20" />
        <View
          className="w-full gap-4 rounded-3xl border border-white/70 p-6 md:gap-5 md:p-8"
          style={{
            maxWidth: 480,
            backgroundColor: 'rgba(230,242,219,0.94)',
            shadowColor: '#10251a',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.22,
            shadowRadius: 28,
            elevation: 10,
          }}>
        <ThemedText type="smallBold" className="uppercase tracking-widest text-[#1f5d3f]">
          AgriShare
        </ThemedText>
        <ThemedText type="title" className="text-[38px] leading-[46px] text-[#173f2d]">
          Grow together.
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Share farm equipment, manage bookings, and connect with trusted operators.
        </ThemedText>
        {!loading && !user ? (
          <View className="flex-row flex-wrap gap-3">
            <Link href="/auth" asChild>
              <Pressable className="rounded-xl bg-[#173f2d] px-5 py-3">
                <ThemedText type="smallBold" className="text-white">Sign in</ThemedText>
              </Pressable>
            </Link>
            <Link href={{ pathname: '/auth', params: { mode: 'register' } }} asChild>
              <Pressable className="rounded-xl border border-[#a9c49b] bg-white px-5 py-3">
                <ThemedText type="smallBold" className="text-[#173f2d]">Create account</ThemedText>
              </Pressable>
            </Link>
          </View>
        ) : null}
        {loading ? <ThemedText themeColor="textSecondary">Restoring your account…</ThemedText> : null}
        </View>
      </View>
    </ImageBackground>
  );
}
