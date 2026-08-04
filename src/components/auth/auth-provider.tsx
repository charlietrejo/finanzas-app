"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase/browser";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: { message: string } | null }>;
  resetPassword: (email: string) => Promise<{ error: { message: string } | null }>;
  resendConfirmation: (email: string) => Promise<{ error: { message: string } | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const pendingSignInRef = useRef<{
    resolve: (() => void) | null;
    reject: ((error: unknown) => void) | null;
  } | null>(null);

  useEffect(() => {
    const client = supabase;

    if (!client) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    let active = true;

    const initialize = async () => {
      const {
        data: { session: currentSession },
      } = await client.auth.getSession();

      if (!active) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    };

    void initialize();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);

      // If there's a pending signIn promise, resolve it when session is available
      if (pendingSignInRef.current && currentSession) {
        pendingSignInRef.current.resolve?.();
        pendingSignInRef.current = null;
      }
    });

    return () => {
      active = false;
      // If component unmounts while waiting for a signIn, reject the pending promise
      if (pendingSignInRef.current) {
        pendingSignInRef.current.reject?.(new Error("AuthProvider unmounted"));
        pendingSignInRef.current = null;
      }
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { error: { message: "La configuración de Supabase no está disponible." } };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: { message: error.message } };

    // If signIn succeeded, check if session is already available
    const {
      data: { session: maybeSession },
    } = await supabase.auth.getSession();

    if (maybeSession) {
      // session already available — update state and return
      setSession(maybeSession);
      setUser(maybeSession.user ?? null);
      return { error: null };
    }

    // Otherwise, wait for onAuthStateChange to notify us about the new session.
    return await new Promise<{ error: { message: string } | null }>((resolve) => {
      pendingSignInRef.current = {
        resolve: () => resolve({ error: null }),
        reject: (err: unknown) => resolve({ error: { message: (err as Error)?.message ?? String(err ?? "") } }),
      };
    });
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    if (!supabase) {
      return { error: { message: "La configuración de Supabase no está disponible." } };
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: fullName ? { full_name: fullName } : undefined,
      },
    });

    return { error: error ? { message: error.message } : null };
  };

  const resetPassword = async (email: string) => {
    if (!supabase) {
      return { error: { message: "La configuración de Supabase no está disponible." } };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    return { error: error ? { message: error.message } : null };
  };

  const resendConfirmation = async (email: string) => {
    if (!supabase) {
      return { error: { message: "La configuración de Supabase no está disponible." } };
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    return { error: error ? { message: error.message } : null };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      signIn,
      signUp,
      resetPassword,
      resendConfirmation,
      signOut,
    }),
    [loading, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }

  return context;
}
