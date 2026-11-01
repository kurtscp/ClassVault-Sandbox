import type { Session } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getProfile,
  getSession,
  onAuthStateChange,
  signIn as authSignIn,
  signOut as authSignOut,
  signUp as authSignUp,
} from '../services/auth';
import type {
  AuthContextValue,
  AuthProfile,
  AuthStatus,
  SignInParams,
  SignUpParams,
} from '../types/auth';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);

  // Load existing session on mount and subscribe to auth state changes
  useEffect(() => {
    let isMounted = true;

    getSession()
      .then((initialSession) => {
        if (!isMounted) return;
        setSession(initialSession);
        setIsSessionLoaded(true);
      })
      .catch(() => {
        if (!isMounted) return;
        setSession(null);
        setIsSessionLoaded(true);
      });

    // DT-5: Only set session state in callback to avoid deadlocks
    const {
      data: { subscription },
    } = onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setIsSessionLoaded(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id;

  // Keyed on user.id: fetch profile with up to 3 retries (500 ms delay)
  // to allow the database trigger handle_new_user() time to complete after sign-up
  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      setProfile(null);
      setIsProfileLoaded(true);
      return;
    }

    setIsProfileLoaded(false);

    const fetchProfileWithRetry = async () => {
      const maxRetries = 3;
      const delayMs = 500;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (!isMounted) return;

        try {
          const profileData = await getProfile(userId);
          if (!isMounted) return;
          setProfile(profileData);
          setIsProfileLoaded(true);
          return;
        } catch {
          if (!isMounted) return;
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else {
            setProfile(null);
            setIsProfileLoaded(true);
          }
        }
      }
    };

    fetchProfileWithRetry();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleSignIn = useCallback(async (params: SignInParams) => {
    return authSignIn(params);
  }, []);

  const handleSignUp = useCallback(async (params: SignUpParams) => {
    return authSignUp(params);
  }, []);

  const handleSignOut = useCallback(async () => {
    await authSignOut();
    setSession(null);
    setProfile(null);
    setIsProfileLoaded(true);
  }, []);

  const status: AuthStatus = useMemo(() => {
    if (!isSessionLoaded) {
      return 'loading';
    }
    if (!session) {
      return 'signedOut';
    }
    if (!isProfileLoaded) {
      return 'loading';
    }
    return 'signedIn';
  }, [isSessionLoaded, session, isProfileLoaded]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      status,
      signIn: handleSignIn,
      signUp: handleSignUp,
      signOut: handleSignOut,
    }),
    [session, profile, status, handleSignIn, handleSignUp, handleSignOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

