// ── Auth context ─────────────────────────────────────────────────────────────
// Single source of truth for the signed-in member + the approval gate. The
// state machine is: loading → signedOut | pending | ready. Screens/route guards
// read `status`; the API still enforces approval server-side (lock screen is UX).
//
// Tokens live in SecureStore (never AsyncStorage). On cold start we restore the
// cached session, then re-validate `approved` from the server (best-effort) so a
// stale cached approval can never grant access.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { auth } from "@/src/api/auth";
import { storage } from "@/src/utils/storage";
import type { AppUser, AuthSession, RegisterInput } from "@/src/types/auth";

const SESSION_KEY = "apeps.auth.session.v1";

export type AuthStatus = "loading" | "signedOut" | "pending" | "ready";

interface AuthContextValue {
  status: AuthStatus;
  user: AppUser | null;
  accessToken: string | null;
  register: (input: RegisterInput) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function statusFor(user: AppUser | null): AuthStatus {
  if (!user) return "signedOut";
  return user.approved ? "ready" : "pending";
}

async function persist(session: AuthSession | null): Promise<void> {
  if (session) {
    await storage.secureSet(SESSION_KEY, JSON.stringify(session));
  } else {
    await storage.secureRemove(SESSION_KEY);
  }
}

async function restore(): Promise<AuthSession | null> {
  const raw = await storage.secureGet(SESSION_KEY, "");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AppUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const sessionRef = useRef<AuthSession | null>(null);

  const apply = useCallback((session: AuthSession | null) => {
    sessionRef.current = session;
    const u = session?.customer ?? null;
    setUser(u);
    setAccessToken(session?.accessToken ?? null);
    setStatus(statusFor(u));
  }, []);

  const refreshMe = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      const fresh = await auth.me(session.accessToken);
      const next = { ...session, customer: fresh };
      await persist(next);
      apply(next);
    } catch {
      // Keep the cached session on a transient failure; a 401 path can be added
      // later with refresh-token rotation (handled by the connector).
    }
  }, [apply]);

  // Cold-start restore, then best-effort revalidation of approval state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await restore();
      if (cancelled) return;
      apply(session);
      if (session) {
        try {
          const fresh = await auth.me(session.accessToken);
          if (cancelled) return;
          const next = { ...session, customer: fresh };
          await persist(next);
          apply(next);
        } catch {
          /* offline / transient — keep cached */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const register = useCallback(
    async (input: RegisterInput) => {
      const session = await auth.register(input);
      await persist(session);
      apply(session);
    },
    [apply],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await auth.login(email, password);
      await persist(session);
      apply(session);
    },
    [apply],
  );

  const logout = useCallback(async () => {
    const session = sessionRef.current;
    if (session) await auth.logout(session).catch(() => {});
    await persist(null);
    apply(null);
  }, [apply]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, accessToken, register, login, logout, refreshMe }),
    [status, user, accessToken, register, login, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
