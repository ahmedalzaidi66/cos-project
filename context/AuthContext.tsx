import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  createdAt: string;
};

type AuthContextType = {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ) => Promise<{ success: boolean; needsVerification?: boolean; error?: string }>;
  resendVerificationEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  /** Phone OTP — request a code (does not change email login) */
  requestOtp: (phone: string) => Promise<{ success: boolean; error?: string; cooldownSeconds?: number }>;
  /** Phone OTP — verify the code and sign the user in */
  verifyOtp: (phone: string, code: string) => Promise<{ success: boolean; error?: string; attemptsLeft?: number }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function buildProfile(supabaseUser: any): UserProfile {
  const meta = supabaseUser.user_metadata ?? {};
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    firstName: meta.first_name ?? '',
    lastName: meta.last_name ?? '',
    emailVerified: !!supabaseUser.email_confirmed_at,
    createdAt: supabaseUser.created_at ?? '',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUser(buildProfile(data.session.user));
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (session?.user) {
          setUser(buildProfile(session.user));
        } else {
          setUser(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return { success: false, error: error.message };
    if (data.user) setUser(buildProfile(data.user));
    return { success: true };
  }, []);

  const register = useCallback(async (
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; needsVerification?: boolean; error?: string }> => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
      },
    });
    if (error) return { success: false, error: error.message };
    // If Supabase email confirmation is enabled, session will be null.
    // Do not log the user in — they must verify their email first.
    if (data.session?.user) {
      setUser(buildProfile(data.session.user));
      return { success: true };
    }
    return { success: true, needsVerification: true };
  }, []);

  const resendVerificationEmail = useCallback(async (
    email: string
  ): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  // ── Phone OTP helpers ────────────────────────────────────────────────────────
  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

  const requestOtp = useCallback(async (
    phone: string
  ): Promise<{ success: boolean; error?: string; cooldownSeconds?: number }> => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ phone, purpose: 'login' }),
      });
      const json = await res.json();
      if (!json.success) return { success: false, error: json.error, cooldownSeconds: json.cooldownSeconds };
      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, [SUPABASE_URL, SUPABASE_ANON_KEY]);

  const verifyOtp = useCallback(async (
    phone: string,
    code: string
  ): Promise<{ success: boolean; error?: string; attemptsLeft?: number }> => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ phone, code, purpose: 'login' }),
      });
      const json = await res.json();
      if (!json.success) return { success: false, error: json.error, attemptsLeft: json.attemptsLeft };

      // Set the Supabase session from the tokens returned by the edge function
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: json.session.access_token,
        refresh_token: json.session.refresh_token,
      });
      if (sessionError) return { success: false, error: sessionError.message };

      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, [SUPABASE_URL, SUPABASE_ANON_KEY]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, resendVerificationEmail, logout, isAuthenticated: !!user, requestOtp, verifyOtp }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
