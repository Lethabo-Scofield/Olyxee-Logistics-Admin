import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "staff";
  businessId: string;
}

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (args: {
    email: string;
    password: string;
    fullName: string;
    businessName: string;
  }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/+$/, "")}/api`.replace(
  /\/{2,}/g,
  "/",
);

async function postJson<T>(
  path: string,
  body?: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      credentials: "include",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const ct = res.headers.get("content-type") ?? "";
    const isJson = ct.includes("application/json");
    const payload = isJson ? await res.json().catch(() => null) : null;
    if (!res.ok) {
      const err =
        (payload && typeof payload === "object" && "error" in payload
          ? String((payload as { error: unknown }).error)
          : null) ?? `Request failed (${res.status})`;
      return { ok: false, error: err, status: res.status };
    }
    return { ok: true, data: (payload ?? {}) as T };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
      status: 0,
    };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = (await res.json()) as { user: AuthUser };
        setUser(data.user);
        setStatus("authenticated");
        return;
      }
    } catch {
      // fall through
    }
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signIn: async (email, password) => {
        const result = await postJson<{ user: AuthUser }>("/auth/login", {
          email,
          password,
        });
        if (!result.ok) return { error: result.error };
        setUser(result.data.user);
        setStatus("authenticated");
        return { error: null };
      },
      signUp: async ({ email, password, fullName, businessName }) => {
        const result = await postJson<{ user: AuthUser }>("/auth/signup", {
          email,
          password,
          fullName,
          businessName,
        });
        if (!result.ok) return { error: result.error };
        setUser(result.data.user);
        setStatus("authenticated");
        return { error: null };
      },
      signOut: async () => {
        await postJson("/auth/logout");
        setUser(null);
        setStatus("unauthenticated");
      },
    }),
    [status, user],
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
