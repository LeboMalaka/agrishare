import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  ApiError,
  getCurrentUser,
  login as loginRequest,
  register as registerRequest,
  setAccessToken,
  type User,
  type UserRole,
} from '@/lib/api';
import { clearToken, readToken, writeToken } from '@/lib/tokenStorage';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (input: { name: string; email: string; password: string; role: UserRole }) => Promise<User>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const token = await readToken();
        if (token) {
          setAccessToken(token);
          const currentUser = await getCurrentUser();
          if (active) setUser(currentUser);
        }
      } catch (restoreError) {
        if (restoreError instanceof ApiError && restoreError.status === 401) {
          await clearToken();
          setAccessToken(null);
        } else if (active) {
          setError(restoreError instanceof Error ? restoreError.message : 'Unable to restore session.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const saveSession = useCallback(async (session: { user: User; token: string }) => {
    await writeToken(session.token);
    setAccessToken(session.token);
    setUser(session.user);
    setError(null);
    return session.user;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await loginRequest({ email, password });
    return saveSession(session);
  }, [saveSession]);

  const signUp = useCallback(async (input: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }) => {
    const session = await registerRequest(input);
    return saveSession(session);
  }, [saveSession]);

  const signOut = useCallback(async () => {
    await clearToken();
    setAccessToken(null);
    setUser(null);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      signIn,
      signUp,
      signOut,
      clearError: () => setError(null),
    }),
    [user, loading, error, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
