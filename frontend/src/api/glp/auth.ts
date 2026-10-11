// GLP auth provider — talks to the proxy (/api/glp/auth/*). Opaque session
// token (not JWT). Maps the GLP customer to the app's AppUser.

import type { AppUser, AuthSession, RegisterInput } from "@/src/types/auth";

import { AuthError, type AuthProvider } from "../auth/provider";
import { glpFetch, GlpError } from "./client";

function mapCustomer(c: any): AppUser {
  return {
    id: Number(c?.id ?? 0),
    email: String(c?.email ?? ""),
    firstName: String(c?.first_name ?? c?.firstName ?? ""),
    lastName: String(c?.last_name ?? c?.lastName ?? ""),
    telegramUsername: String(c?.telegram_username ?? c?.telegramUsername ?? ""),
    approved: Boolean(c?.approved),
    fulfilment: Boolean(c?.fulfilment),
  };
}

function mapSession(raw: any): AuthSession {
  return {
    accessToken: String(raw?.token ?? ""),
    refreshToken: "",
    expiresIn: Number(raw?.expiresIn ?? 60 * 60 * 24 * 30),
    customer: mapCustomer(raw?.customer ?? raw),
  };
}

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof GlpError) throw new AuthError(e.code, e.message);
    throw new AuthError("error", "Something went wrong. Please try again.");
  }
}

export const glpAuthProvider: AuthProvider = {
  async login(email, password) {
    return run(async () => {
      const raw = await glpFetch<any>("/auth/session", {
        method: "POST",
        auth: false,
        body: { username: email.trim(), password },
      });
      if (!raw?.token) throw new AuthError("invalid", "Email or password is incorrect.");
      return mapSession(raw);
    });
  },

  async register(input: RegisterInput) {
    return run(async () => {
      const raw = await glpFetch<any>("/auth/register", {
        method: "POST",
        auth: false,
        body: {
          email: input.email.trim(),
          password: input.password,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          telegramUsername: input.telegramUsername.trim(),
        },
      });
      if (!raw?.token) throw new AuthError("cannot_register", "Could not create your account.");
      return mapSession(raw);
    });
  },

  async me(accessToken) {
    // Token is applied globally via glpClient.setToken by the auth context.
    void accessToken;
    const raw = await glpFetch<any>("/me");
    return mapCustomer(raw?.customer ?? raw);
  },

  async logout() {
    // GLP tokens are stateless on the client side; nothing to revoke here.
  },

  async forgot(email) {
    await glpFetch<any>("/auth/request-password-reset", {
      method: "POST",
      auth: false,
      body: { email },
    }).catch(() => {});
  },
};
