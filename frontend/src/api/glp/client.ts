// GLP storefront client — the ONLY place the app talks to the trusted FastAPI
// proxy ({backendUrl}/api/glp/*). The proxy injects the GLP shared secret
// server-side; the app only sends the customer's opaque session token.
//
// Handles the intermittent SiteGround sg-captcha (surfaced by the proxy as
// 503 upstream_blocked) with a short retry so a transient challenge doesn't
// break a user action.

import { env } from "@/src/config/env";

let authToken: string | null = null;

export const glpClient = {
  setToken(token: string | null) {
    authToken = token;
  },
  getToken() {
    return authToken;
  },
};

export class GlpError extends Error {
  code: string;
  status: number;
  data: any;
  constructor(code: string, message: string, status = 0, data: any = null) {
    super(message);
    this.name = "GlpError";
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

const base = () => `${env.backendUrl.replace(/\/$/, "")}/api/glp`;

interface Opts {
  method?: string;
  body?: any;
  auth?: boolean;
  retries?: number;
}

export async function glpFetch<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const { method = "GET", body, auth = true, retries = 2 } = opts;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && authToken) headers["Authorization"] = `Bearer ${authToken}`;

  let lastErr: GlpError | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${base()}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      lastErr = new GlpError("offline", "Network request failed. Please try again.");
      await delay(800);
      continue;
    }

    let json: any = null;
    const text = await res.text();
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }

    // Transient store bot-protection challenge surfaced by the proxy.
    if (res.status === 503 && json?.error === "upstream_blocked") {
      lastErr = new GlpError("blocked", "The store is busy. Please try again.", 503, json);
      await delay(1000 * (attempt + 1));
      continue;
    }

    if (!res.ok) {
      const code = String(json?.error ?? json?.code ?? "error");
      const message =
        typeof json?.message === "string" && json.message
          ? json.message
          : "Something went wrong. Please try again.";
      throw new GlpError(code, message, res.status, json);
    }
    return json as T;
  }
  throw lastErr ?? new GlpError("error", "Request failed.");
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
