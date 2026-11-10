import { Link, router } from 'expo-router';
import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';
import { getApiErrorMessage } from '@/lib/api';

export function DashboardPage({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { signOut } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
      router.replace('/auth');
    } catch (error) {
      setSignOutError(getApiErrorMessage(error));
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <View className="flex-1 bg-[#f4f7f1]">
      <View className="mx-auto w-full max-w-5xl gap-5 p-5 pb-10 md:gap-6 md:p-8">
        <View className="flex-row flex-wrap items-start justify-between gap-4 rounded-3xl border border-[#cfe1bf] bg-[#dfeecf] p-5 md:p-8">
          <View className="min-w-[220px] flex-1 gap-2">
            <ThemedText type="smallBold" className="uppercase tracking-widest text-[#1f5d3f]">
              {eyebrow}
            </ThemedText>
            <ThemedText type="title" className="text-[34px] leading-[42px] text-[#173f2d] md:text-[44px] md:leading-[52px]">
              {title}
            </ThemedText>
            <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out of AgriShare"
            disabled={signingOut}
            onPress={() => void handleSignOut()}
            className={`items-center justify-center rounded-xl border border-[#b8cdb0] bg-white px-4 py-3 ${
              signingOut ? 'opacity-60' : ''
            }`}>
            <ThemedText type="smallBold" className="text-[#173f2d]">
              {signingOut ? 'Signing out…' : 'Sign out'}
            </ThemedText>
          </Pressable>
        </View>
        {signOutError ? (
          <View className="rounded-xl border border-[#f1c7c1] bg-[#fff2f0] p-3">
            <ThemedText type="smallBold" className="text-[#9b2c2c]">{signOutError}</ThemedText>
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}

export function DashboardCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-4 rounded-2xl border border-[#e5ebdf] bg-white p-4 md:p-5">
      <ThemedText type="subtitle" className="text-[22px] leading-7 text-[#173f2d]">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <View className="min-w-[140px] flex-1 gap-1 rounded-2xl border border-[#e5ebdf] bg-white p-4">
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="subtitle" className="text-[30px] leading-9 text-[#173f2d]">
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{detail}</ThemedText>
    </View>
  );
}

export function ActionLink({
  label,
  href,
  primary = false,
}: {
  label: string;
  href: Href;
  primary?: boolean;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        className={`items-center justify-center rounded-xl px-4 py-3 ${
          primary ? 'bg-[#173f2d]' : 'border border-[#dce7db] bg-[#f7f9f6]'
        }`}>
        <ThemedText type="smallBold" className={primary ? 'text-white' : 'text-[#173f2d]'}>
          {label}
        </ThemedText>
      </Pressable>
    </Link>
  );
}

export function DashboardError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View className="gap-2 rounded-xl border border-[#f1c7c1] bg-[#fff2f0] p-4">
      <ThemedText type="smallBold" className="text-[#9b2c2c]">{message}</ThemedText>
      <Pressable onPress={onRetry} accessibilityRole="button">
        <ThemedText type="smallBold" className="text-[#1f5d3f]">Try again</ThemedText>
      </Pressable>
    </View>
  );
}
