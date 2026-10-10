// Live auth provider — talks to the Apeps App Connector WordPress plugin at
// {API_BASE}/wp-json/apeps/v1. HTTPS only. No secrets in the app: only the
// public connector base URL. Tokens are handled by the auth context (SecureStore).

import { env } from "@/src/config/env";
import type { AppUser, AuthSession, RegisterInput } from "@/src/types/auth";

import { AuthError, type AuthProvider } from "./provider";

const TIMEOUT = 15000;

const connectorUrl = (path: string): string =>
  `${env.appApiBaseUrl.replace(/\/$/, "")}/wp-json/apeps/v1${path}`;

async function request<T>(
  path: string,
  { method = "POST", body, token }: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const base = env.appApiBaseUrl.trim();
  if (!base.startsWith("https://")) {
    throw new AuthError("unconfigured", "Sign-in is not available yet.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  let res: Response;
  try {
    res = await fetch(connectorUrl(path), {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    throw new AuthError("offline", "Network request failed. Please try again.");
  }
  clearTimeout(timer);

  const text = await res.text();
  const looksLikeHtml = /^\s*<(?:!doctype|html|head)/i.test(text) || text.includes("sgcaptcha");
  if (looksLikeHtml) {
    throw new AuthError("blocked", "The store is temporarily unreachable.");
  }
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new AuthError("parse", "Unexpected response from the store.");
  }
  if (!res.ok) {
    const message =
      typeof json?.message === "string" && json.message
        ? json.message
        : "Something went wrong. Please try again.";
    throw new AuthError(String(json?.code ?? "error"), message);
  }
  return json as T;
}

function mapUser(raw: any): AppUser {
  const c = raw?.customer ?? raw ?? {};
  return {
    id: Number(c.id ?? 0),
    email: String(c.email ?? ""),
    firstName: String(c.firstName ?? ""),
    lastName: String(c.lastName ?? ""),
    telegramUsername: String(c.telegramUsername ?? ""),
    approved: Boolean(c.approved),
  };
}

function mapSession(raw: any): AuthSession {
  return {
    accessToken: String(raw.accessToken ?? ""),
    refreshToken: String(raw.refreshToken ?? ""),
    expiresIn: Number(raw.expiresIn ?? 0),
    customer: mapUser(raw),
  };
}

export const liveAuthProvider: AuthProvider = {
  async login(email, password) {
    const raw = await request<any>("/auth/login", { body: { email, password } });
    return mapSession(raw);
  },

  async register(input) {
    const raw = await request<any>("/auth/register", {
      body: {
        email: input.email,
        password: input.password,
        firstName: input.firstName,
        lastName: input.lastName,
        telegramUsername: input.telegramUsername,
      },
    });
    return mapSession(raw);
  },

  async me(accessToken) {
    const raw = await request<any>("/me", { method: "GET", token: accessToken });
    return mapUser(raw);
  },

  async logout(sessionValue) {
    await request<any>("/auth/logout", {
      token: sessionValue.accessToken,
      body: { refreshToken: sessionValue.refreshToken },
    }).catch(() => {});
  },

  async forgot(email) {
    await request<any>("/auth/forgot", { body: { email } }).catch(() => {});
  },
};
