import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getBiometricCapability, promptBiometricUnlock } from '@/lib/biometrics';
import { fetchCurrentUser, loginWithPassword, logoutRemote } from '@/lib/auth';
import { registerPushTokenIfPossible } from '@/lib/push';
import {
  clearAccessToken,
  clearBiometricSessionFlag,
  getAccessToken,
  getBiometricEnabled,
  getNotificationReason,
  getNotificationStatus,
  hasBiometricSessionFlag,
  markBiometricSessionFlag,
  setBiometricEnabled as persistBiometricEnabled,
  type NotificationStatus,
} from '@/lib/storage';
import type { MobileUser } from '@/lib/types';

type AuthContextValue = {
  isLoading: boolean;
  isSignedIn: boolean;
  /** Token present but tabs blocked until Face ID / biometrics (or password). */
  needsUnlock: boolean;
  user: MobileUser | null;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  notificationStatus: NotificationStatus;
  notificationReason: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  unlockWithBiometrics: () => Promise<boolean>;
  /** Clears local session so the user can re-enter email/password. */
  fallBackToPasswordLogin: () => Promise<void>;
  refreshNotificationStatus: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function resolveDefaultBiometricEnabled(
  hardwareAvailable: boolean,
): Promise<boolean> {
  const stored = await getBiometricEnabled();
  if (stored !== null) return stored;
  return hardwareAvailable;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<MobileUser | null>(null);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [notificationStatus, setNotificationStatusState] =
    useState<NotificationStatus>('unknown');
  const [notificationReason, setNotificationReasonState] = useState<string | null>(
    null,
  );

  const finishAuthenticatedSession = useCallback(async (nextUser: MobileUser) => {
    setUser(nextUser);
    setNeedsUnlock(false);
    const status = await registerPushTokenIfPossible();
    setNotificationStatusState(status);
    setNotificationReasonState(await getNotificationReason());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restore(): Promise<void> {
      try {
        const capability = await getBiometricCapability();
        if (cancelled) return;
        setBiometricAvailable(capability.available);

        const enabled = await resolveDefaultBiometricEnabled(capability.available);
        if (cancelled) return;
        setBiometricEnabledState(enabled);

        const storedNotif = await getNotificationStatus();
        const storedReason = await getNotificationReason();
        if (!cancelled) {
          setNotificationStatusState(storedNotif);
          setNotificationReasonState(storedReason);
        }

        const token = await getAccessToken();
        if (!token) return;

        const sessionFlag = await hasBiometricSessionFlag();
        const shouldGate = enabled && capability.available && sessionFlag;

        if (shouldGate) {
          if (!cancelled) setNeedsUnlock(true);
          return;
        }

        const me = await fetchCurrentUser();
        if (cancelled) return;
        await finishAuthenticatedSession(me);
      } catch (err) {
        console.warn('Session restore failed', err);
        await clearAccessToken();
        await clearBiometricSessionFlag();
        if (!cancelled) {
          setUser(null);
          setNeedsUnlock(false);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [finishAuthenticatedSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await loginWithPassword(email, password);
      const capability = await getBiometricCapability();
      setBiometricAvailable(capability.available);
      const enabled = await resolveDefaultBiometricEnabled(capability.available);
      setBiometricEnabledState(enabled);
      await persistBiometricEnabled(enabled);
      if (enabled && capability.available) {
        await markBiometricSessionFlag();
      } else {
        await clearBiometricSessionFlag();
      }
      await finishAuthenticatedSession(result.user);
    },
    [finishAuthenticatedSession],
  );

  const signOut = useCallback(async () => {
    await logoutRemote();
    await clearBiometricSessionFlag();
    setUser(null);
    setNeedsUnlock(false);
  }, []);

  const setBiometricEnabled = useCallback(
    async (enabled: boolean) => {
      await persistBiometricEnabled(enabled);
      setBiometricEnabledState(enabled);
      if (enabled && biometricAvailable && user) {
        await markBiometricSessionFlag();
      } else if (!enabled) {
        await clearBiometricSessionFlag();
      }
    },
    [biometricAvailable, user],
  );

  const unlockWithBiometrics = useCallback(async (): Promise<boolean> => {
    const outcome = await promptBiometricUnlock();
    if (outcome !== 'success') return false;
    try {
      const me = await fetchCurrentUser();
      await finishAuthenticatedSession(me);
      return true;
    } catch (err) {
      console.warn('Biometric unlock failed', err);
      await clearAccessToken();
      await clearBiometricSessionFlag();
      setUser(null);
      setNeedsUnlock(false);
      return false;
    }
  }, [finishAuthenticatedSession]);

  const fallBackToPasswordLogin = useCallback(async () => {
    await clearAccessToken();
    await clearBiometricSessionFlag();
    setUser(null);
    setNeedsUnlock(false);
  }, []);

  const refreshNotificationStatus = useCallback(async () => {
    const status = await registerPushTokenIfPossible();
    setNotificationStatusState(status);
    setNotificationReasonState(await getNotificationReason());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isSignedIn: user !== null,
      needsUnlock,
      user,
      biometricAvailable,
      biometricEnabled,
      notificationStatus,
      notificationReason,
      signIn,
      signOut,
      setBiometricEnabled,
      unlockWithBiometrics,
      fallBackToPasswordLogin,
      refreshNotificationStatus,
    }),
    [
      isLoading,
      user,
      needsUnlock,
      biometricAvailable,
      biometricEnabled,
      notificationStatus,
      notificationReason,
      signIn,
      signOut,
      setBiometricEnabled,
      unlockWithBiometrics,
      fallBackToPasswordLogin,
      refreshNotificationStatus,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
