import { z } from "zod";

import { getJson } from "@/src/api/client";
import { env } from "@/src/config/env";
import { appApiUrl } from "@/src/modules/shared/api-helpers";

import type { RefillPlan, RefillPreferences } from "./types";

// PROVISIONAL endpoints — reminder preferences + saved refill items. No billing.
export const REFILL_ENDPOINTS = {
  preferences: "/refill/preferences", // PROVISIONAL
  plans: "/refill/items", // PROVISIONAL
} as const;

// Consent-gated, OFF by default.
export const DEFAULT_REFILL_PREFERENCES: RefillPreferences = {
  enabled: false,
  reminderConsent: false,
  defaultIntervalDays: 30,
};

export const refillPreferencesSchema = z.object({
  enabled: z.boolean(),
  reminderConsent: z.boolean(),
  defaultIntervalDays: z.number().int().positive(),
});

export function parseRefillPreferences(raw: unknown): RefillPreferences {
  return { ...DEFAULT_REFILL_PREFERENCES, ...refillPreferencesSchema.partial().parse(raw ?? {}) };
}

const planSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  product_id: z.number(),
  variation_id: z.number().nullable().default(null),
  name: z.string().default(""),
  interval_days: z.number().int().positive(),
  next_reminder_date: z.string().nullable().default(null),
  active: z.boolean().default(true),
});

export function parseRefillPlans(raw: unknown): RefillPlan[] {
  return z.array(planSchema).parse(raw).map((p) => ({
    id: p.id,
    item: { productId: p.product_id, variationId: p.variation_id, name: p.name, intervalDays: p.interval_days },
    nextReminderDate: p.next_reminder_date,
    active: p.active,
  }));
}

interface RefillAdapter {
  getPreferences(): Promise<RefillPreferences>;
  updatePreferences(prefs: RefillPreferences): Promise<RefillPreferences>;
  getPlans(): Promise<RefillPlan[]>;
}

const mockAdapter: RefillAdapter = {
  async getPreferences() {
    return { ...DEFAULT_REFILL_PREFERENCES };
  },
  async updatePreferences(prefs) {
    return prefs;
  },
  async getPlans() {
    return []; // no fabricated subscriptions
  },
};

const liveAdapter: RefillAdapter = {
  async getPreferences() {
    const { data } = await getJson<unknown>(appApiUrl(REFILL_ENDPOINTS.preferences));
    return parseRefillPreferences(data);
  },
  async updatePreferences(prefs) {
    return prefs; // PROVISIONAL write — Phase 2
  },
  async getPlans() {
    const { data } = await getJson<unknown>(appApiUrl(REFILL_ENDPOINTS.plans));
    return parseRefillPlans(data);
  },
};

export const refillApi = env.dataSource === "live" ? liveAdapter : mockAdapter;

// PROVISIONAL sample — unit tests only.
export const __PROVISIONAL_REFILL_PLANS_RAW = [
  { id: 1, product_id: 101, variation_id: null, name: "Daily Multivitamin", interval_days: 30, next_reminder_date: "2026-06-01", active: true },
];
