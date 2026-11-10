import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ImageBackground, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';
import { getApiErrorMessage, type UserRole } from '@/lib/api';

function getDashboardRoute(role: UserRole): '/farmer' | '/owner' | '/operator' {
  if (role === 'FARMER') return '/farmer';
  if (role === 'EQUIPMENT_OWNER') return '/owner';
  return '/operator';
}

const roles: { value: UserRole; label: string }[] = [
  { value: 'FARMER', label: 'Farmer' },
  { value: 'EQUIPMENT_OWNER', label: 'Equipment owner' },
  { value: 'OPERATOR', label: 'Operator' },
];

export default function AuthScreen() {
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 900;
  const params = useLocalSearchParams<{ mode?: string }>();
  const [isRegister, setIsRegister] = useState(params.mode === 'register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('FARMER');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { user, loading, error: restoreError, signIn, signUp, signOut } = useAuth();

  const submit = async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const signedInUser = isRegister
        ? await signUp({ name, email, password, role })
        : await signIn(email, password);
      router.replace(getDashboardRoute(signedInUser.role));
    } catch (error) {
      setSubmitError(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMode = () => {
    setSubmitError(null);
    setIsRegister((current) => !current);
  };

  if (loading) {
    return (
      <ImageBackground
        source={require('../../../assets/images/agrishare-login-background.jpeg')}
        resizeMode="cover"
        imageStyle={{ width: '100%', height: '100%' }}
        className="flex-1">
        <View className="absolute inset-0 bg-[#10251a]/20" />
        <ThemedView className="flex-1 items-center justify-center gap-4 bg-transparent p-6">
          <ThemedText className="text-white">Restoring your account…</ThemedText>
        </ThemedView>
      </ImageBackground>
    );
  }

  if (user) {
    return (
      <ImageBackground
        source={require('../../../assets/images/agrishare-login-background.jpeg')}
        resizeMode="cover"
        imageStyle={{ width: '100%', height: '100%' }}
        className="flex-1">
        <View className="absolute inset-0 bg-[#10251a]/20" />
        <ThemedView className="flex-1 items-center justify-center gap-4 bg-transparent p-6">
          <ThemedText type="subtitle" className="text-center text-[32px] leading-[44px] text-white">
            You’re signed in
          </ThemedText>
          <ThemedText className="text-white">{user.name} · {user.role.replace('_', ' ')}</ThemedText>
          <Link href={getDashboardRoute(user.role)} asChild>
            <Pressable className="items-center rounded-xl bg-[#173f2d] px-5 py-3.5">
              <ThemedText type="smallBold" className="text-white">Open dashboard</ThemedText>
            </Pressable>
          </Link>
          <Pressable
            className="items-center rounded-xl bg-[#edf6ee] px-5 py-3.5"
            onPress={() => void signOut().catch((error: unknown) => setSubmitError(getApiErrorMessage(error)))}>
            <ThemedText type="smallBold">Sign out</ThemedText>
          </Pressable>
          {submitError ? <ThemedText className="text-[#ffdbd6]">{submitError}</ThemedText> : null}
        </ThemedView>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require('../../../assets/images/agrishare-login-background.jpeg')}
      resizeMode="cover"
      imageStyle={{ width: '100%', height: '100%' }}
      className="flex-1">
      <View className="absolute inset-0 bg-[#10251a]/20" />
      <ScrollView
        className="flex-1 bg-transparent"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: isWideScreen ? 'flex-end' : 'center',
          padding: isWideScreen ? 40 : 18,
          paddingBottom: 40,
        }}>
      <ThemedView
        className="w-full gap-3 rounded-[22px] border border-white/70 p-5 md:gap-4 md:p-6"
        style={{
          maxWidth: 430,
          backgroundColor: 'rgba(255,255,255,0.94)',
          shadowColor: '#10251a',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.22,
          shadowRadius: 28,
          elevation: 10,
        }}>
        <ThemedText type="title" className="text-[34px] leading-[42px]">
          {isRegister ? 'Join AgriShare' : 'Welcome back'}
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {isRegister
            ? 'Create an account to find or share farm equipment.'
            : 'Sign in to manage your equipment and bookings.'}
        </ThemedText>
        {restoreError ? (
          <ThemedView className="rounded-xl bg-[#fff2f0] p-3">
            <ThemedText type="smallBold" className="text-[#9b2c2c]">{restoreError}</ThemedText>
          </ThemedView>
        ) : null}

        {isRegister ? (
          <>
            <View className="gap-2">
              <ThemedText type="smallBold">Full name</ThemedText>
              <TextInput
                autoComplete="name"
                value={name}
                onChangeText={setName}
                className="rounded-xl border border-[#dce7db] bg-[#f8faf7] px-3 py-3 text-base text-[#162114]"
                placeholder="Your name"
              />
            </View>
            <View className="gap-2">
              <ThemedText type="smallBold">I am a</ThemedText>
              <View className="gap-2">
                {roles.map((item) => (
                  <Pressable
                    key={item.value}
                    onPress={() => setRole(item.value)}
                    className={`rounded-xl border p-3 ${
                      role === item.value
                        ? 'border-[#173f2d] bg-[#173f2d]'
                        : 'border-[#dce7db]'
                    }`}>
                    <ThemedText
                      type="smallBold"
                      className={role === item.value ? 'text-white' : undefined}>
                      {item.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        ) : null}

        <View className="gap-2">
          <ThemedText type="smallBold">Email</ThemedText>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            className="rounded-xl border border-[#dce7db] bg-[#f8faf7] px-3 py-3 text-base text-[#162114]"
            placeholder="you@example.com"
          />
        </View>

        <View className="gap-2">
          <ThemedText type="smallBold">Password</ThemedText>
          <TextInput
            autoCapitalize="none"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            className="rounded-xl border border-[#dce7db] bg-[#f8faf7] px-3 py-3 text-base text-[#162114]"
            placeholder={isRegister ? '10+ characters (max 72 bytes)' : 'Your password'}
          />
        </View>

        {submitError ? (
          <ThemedView className="rounded-xl bg-[#fff2f0] p-3">
            <ThemedText type="smallBold" className="text-[#9b2c2c]">{submitError}</ThemedText>
          </ThemedView>
        ) : null}

        <Pressable
          disabled={submitting}
          className={`items-center rounded-xl bg-[#173f2d] py-3.5 ${
            submitting ? 'opacity-60' : ''
          }`}
          onPress={() => void submit()}>
          <ThemedText type="smallBold" className="text-white">
            {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </ThemedText>
        </Pressable>

        <Pressable onPress={toggleMode} className="items-center py-2">
          <ThemedText type="smallBold" className="text-[#1f5d3f]">
            {isRegister ? 'Already have an account? Sign in' : 'New to AgriShare? Create account'}
          </ThemedText>
        </Pressable>
        <Link href="/" className="p-1.5 text-center text-[#52624e]">Back to home</Link>
      </ThemedView>
      </ScrollView>
    </ImageBackground>
  );
}
