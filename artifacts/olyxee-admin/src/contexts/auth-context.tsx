import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { setAuthTokenGetter } from "@workspace/api-client-react";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName?: string,
    businessName?: string,
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  checkEmailExists: (email: string) => Promise<{ exists: boolean; fallback?: boolean; error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    // Wire the API client so every request to the backend carries the
    // current Supabase access token. Reads from the ref so we always
    // forward the freshest token after refreshes.
    setAuthTokenGetter(() => sessionRef.current?.access_token ?? null);
    return () => setAuthTokenGetter(null);
  }, []);

  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured) {
      setStatus("unauthenticated");
      return () => {
        active = false;
      };
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setStatus(data.session ? "authenticated" : "unauthenticated");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setStatus(next ? "authenticated" : "unauthenticated");
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      session,
      isConfigured: isSupabaseConfigured,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        return { error: error?.message ?? null };
      },
      signUp: async (email, password, fullName, businessName) => {
        // The API server reads `full_name` and `business_name` from the
        // Supabase user metadata when provisioning the businesses + users
        // rows on first authenticated request. Both are optional, so only
        // forward what the caller actually supplied.
        const meta: Record<string, string> = {};
        if (fullName) meta.full_name = fullName;
        if (businessName) meta.business_name = businessName;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: Object.keys(meta).length > 0 ? meta : undefined,
            emailRedirectTo:
              typeof window !== "undefined"
                ? `${window.location.origin}${import.meta.env.BASE_URL ?? "/"}login`
                : undefined,
          },
        });
        return {
          error: error?.message ?? null,
          // When email confirmations are enabled in Supabase, sign-up returns
          // a user without an active session.
          needsEmailConfirmation: !error && !data.session,
        };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      checkEmailExists: async (email) => {
        try {
          const base = import.meta.env.BASE_URL ?? "/";
          const resp = await fetch(`${base}api/auth/check-email`.replace(/\/+/g, "/"), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email }),
          });
          if (!resp.ok) {
            // No API backend reachable (e.g. SPA-only deploy on Vercel where
            // /api routes get caught by the SPA fallback and return 405/404).
            // Treat as "can't enumerate" so the UI shows the sign-in form
            // with a hint to switch to "create account" if needed.
            return { exists: false, fallback: true, error: null };
          }
          const ct = resp.headers.get("content-type") ?? "";
          if (!ct.includes("application/json")) {
            return { exists: false, fallback: true, error: null };
          }
          const data = (await resp.json()) as { exists: boolean; fallback?: boolean };
          return { exists: !!data.exists, fallback: data.fallback, error: null };
        } catch {
          // Network error / no backend — same fallback behavior.
          return { exists: false, fallback: true, error: null };
        }
      },
    }),
    [status, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
