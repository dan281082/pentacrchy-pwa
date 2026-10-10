// Mock auth provider — mirrors the live connector contract exactly so screens
// never change when EXPO_PUBLIC_DATA_SOURCE flips to "live". Accounts persist in
// the general KV store (dev/preview only — NOT secure). Registration with a
// valid Telegram username auto-approves; seeded accounts demonstrate both the
// approved and the "pending approval" lock states.

import { storage } from "@/src/utils/storage";
import { normalizeTelegram } from "@/src/utils/telegram";
import type { AppUser, AuthSession, RegisterInput } from "@/src/types/auth";

import { AuthError, type AuthProvider } from "./provider";

const ACCOUNTS_KEY = "apeps.mock.accounts.v1";
const ACCESS_TTL = 15 * 60;

interface MockAccount {
  id: number;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  telegramUsername: string;
  approved: boolean;
}

const SEED: MockAccount[] = [
  {
    id: 101,
    email: "demo@apeps.co.uk",
    password: "Password123",
    firstName: "Demo",
    lastName: "Member",
    telegramUsername: "demo_member",
    approved: true,
  },
  {
    id: 102,
    email: "pending@apeps.co.uk",
    password: "Password123",
    firstName: "Pending",
    lastName: "Member",
    telegramUsername: "pending_member",
    approved: false,
  },
];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loadAccounts(): Promise<MockAccount[]> {
  const raw = await storage.getItem(ACCOUNTS_KEY, "");
  if (!raw) {
    await storage.setItem(ACCOUNTS_KEY, JSON.stringify(SEED));
    return [...SEED];
  }
  try {
    return JSON.parse(raw) as MockAccount[];
  } catch {
    await storage.setItem(ACCOUNTS_KEY, JSON.stringify(SEED));
    return [...SEED];
  }
}

async function saveAccounts(list: MockAccount[]): Promise<void> {
  await storage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

function toUser(a: MockAccount): AppUser {
  return {
    id: a.id,
    email: a.email,
    firstName: a.firstName,
    lastName: a.lastName,
    telegramUsername: a.telegramUsername,
    approved: a.approved,
  };
}

function session(a: MockAccount): AuthSession {
  return {
    accessToken: `mock:${a.id}`,
    refreshToken: `mockr:${a.id}`,
    expiresIn: ACCESS_TTL,
    customer: toUser(a),
  };
}

function accountIdFromToken(token: string): number | null {
  const m = /^mock:(\d+)$/.exec(token);
  return m ? Number(m[1]) : null;
}

export const mockAuthProvider: AuthProvider = {
  async login(email, password) {
    await delay(500);
    const accounts = await loadAccounts();
    const a = accounts.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!a || a.password !== password) {
      throw new AuthError("invalid", "Email or password is incorrect.");
    }
    return session(a);
  },

  async register(input) {
    await delay(600);
    const email = input.email.trim().toLowerCase();
    const tg = normalizeTelegram(input.telegramUsername);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || input.password.length < 8) {
      throw new AuthError("invalid_input", "Enter a valid email and a password of at least 8 characters.");
    }
    if (!tg.ok) {
      throw new AuthError("telegram_invalid", tg.error ?? "Telegram username is invalid.");
    }
    const accounts = await loadAccounts();
    if (accounts.some((x) => x.email.toLowerCase() === email)) {
      throw new AuthError("cannot_register", "An account with those details already exists.");
    }
    if (accounts.some((x) => x.telegramUsername === tg.value)) {
      throw new AuthError("telegram_taken", "That Telegram username is already registered.");
    }
    const account: MockAccount = {
      id: Date.now(),
      email,
      password: input.password,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      telegramUsername: tg.value,
      // Auto-approve when a valid Telegram username is supplied.
      approved: true,
    };
    accounts.push(account);
    await saveAccounts(accounts);
    return session(account);
  },

  async me(accessToken) {
    await delay(250);
    const id = accountIdFromToken(accessToken);
    const accounts = await loadAccounts();
    const a = accounts.find((x) => x.id === id);
    if (!a) throw new AuthError("invalid_token", "Session expired.");
    return toUser(a);
  },

  async logout() {
    await delay(150);
  },

  async forgot() {
    await delay(300);
  },
};
