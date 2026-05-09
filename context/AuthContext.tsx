import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  createdAt: string;
  /** Set for phone-OTP users; empty string for email-login users */
  phone: string;
  /** True when the user authenticated via phone OTP (synthetic internal email) */
  isPhoneUser: boolean;
  /** From customer_profiles — may differ from auth email for phone users */
  profileEmail: string;
  dateOfBirth: string;
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
  /** Re-fetch the current user's profile (e.g. after saving customer_profiles) */
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PHONE_OTP_EMAIL_SUFFIX = '@otp.lazurde.internal';

function isPhoneOtpEmail(email: string): boolean {
  return email.endsWith(PHONE_OTP_EMAIL_SUFFIX);
}

function buildProfile(supabaseUser: any, cp?: any): UserProfile {
  const meta = supabaseUser.user_metadata ?? {};
  const authEmail = supabaseUser.email ?? '';
  const isPhoneUser = isPhoneOtpEmail(authEmail);

  return {
    id: supabaseUser.id,
    email: isPhoneUser ? '' : authEmail,
    firstName: cp?.first_name ?? meta.first_name ?? '',
    lastName: cp?.last_name ?? meta.last_name ?? '',
    emailVerified: isPhoneUser ? false : !!supabaseUser.email_confirmed_at,
    createdAt: supabaseUser.created_at ?? '',
    phone: cp?.phone ?? meta.phone ?? '',
    isPhoneUser,
    profileEmail: cp?.email ?? '',
    dateOfBirth: cp?.date_of_birth ?? '',
  };
}

async function fetchCustomerProfile(userId: string) {
  const { data } = await supabase
    .from('customer_profiles')
    .select('phone, phone_verified_at, email, date_of_birth, first_name, last_name')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const buildAndSetUser = useCallback(async (supabaseUser: any) => {
    const cp = await fetchCustomerProfile(supabaseUser.id);
    setUser(buildProfile(supabaseUser, cp));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        buildAndSetUser(data.session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (session?.user) {
          await buildAndSetUser(session.user);
        } else {
          setUser(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, [buildAndSetUser]);

  const login = useCallback(async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return { success: false, error: error.message };
    if (data.user) await buildAndSetUser(data.user);
    return { success: true };
  }, [buildAndSetUser]);

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

  const refreshUser = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) await buildAndSetUser(data.user);
  }, [buildAndSetUser]);

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
    <AuthContext.Provider value={{ user, loading, login, register, resendVerificationEmail, logout, isAuthenticated: !!user, requestOtp, verifyOtp, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
