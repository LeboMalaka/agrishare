import { Platform } from 'react-native';

const tokenKey = 'agrishare.accessToken';

export async function readToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(tokenKey);
  }
  const SecureStore = await import('expo-secure-store');
  return SecureStore.getItemAsync(tokenKey);
}

export async function writeToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.localStorage.setItem(tokenKey, token);
    return;
  }
  const SecureStore = await import('expo-secure-store');
  await SecureStore.setItemAsync(tokenKey, token);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.localStorage.removeItem(tokenKey);
    return;
  }
  const SecureStore = await import('expo-secure-store');
  await SecureStore.deleteItemAsync(tokenKey);
}
