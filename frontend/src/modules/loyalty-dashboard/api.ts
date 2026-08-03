import { z } from "zod";

import { getJson } from "@/src/api/client";
import { env } from "@/src/config/env";
import { appApiUrl } from "@/src/modules/shared/api-helpers";

import type { LoyaltySummary } from "./types";

// PROVISIONAL endpoint — the final path/fields depend on the existing
// WooCommerce loyalty plugin surfaced by the Apeps App Connector.
export const LOYALTY_ENDPOINTS = {
  summary: "/loyalty/summary", // PROVISIONAL
} as const;

const activitySchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  type: z.enum(["earned", "redeemed", "adjustment"]).catch("adjustment"),
  points: z.number(),
  description: z.string().default(""),
  date: z.string(),
});

// Provisional wire schema (snake_case as WordPress typically returns).
export const loyaltySummarySchema = z.object({
  enabled: z.boolean().default(false),
  points: z.number().nullable().default(null),
  redemption_value: z
    .object({ amount_minor: z.string(), currency: z.string() })
    .nullable()
    .default(null),
  tier: z.string().nullable().default(null),
  activity: z.array(activitySchema).default([]),
  terms_url: z.string().nullable().default(null),
});

export function parseLoyaltySummary(raw: unknown): LoyaltySummary {
  const d = loyaltySummarySchema.parse(raw);
  return {
    enabled: d.enabled,
    points: d.points,
    redemptionValue: d.redemption_value
      ? { amountMinor: d.redemption_value.amount_minor, currency: d.redemption_value.currency }
      : null,
    tier: d.tier,
    activity: d.activity.map((a) => ({
      id: a.id,
      type: a.type,
      points: a.points,
      description: a.description,
      date: a.date,
    })),
    termsUrl: d.terms_url,
  };
}

// Safe empty summary — the app NEVER fabricates a points balance.
const EMPTY: LoyaltySummary = {
  enabled: false,
  points: null,
  redemptionValue: null,
  tier: null,
  activity: [],
  termsUrl: null,
};

const mockAdapter = {
  async getSummary(): Promise<LoyaltySummary> {
    return EMPTY;
  },
};

const liveAdapter = {
  async getSummary(): Promise<LoyaltySummary> {
    const { data } = await getJson<unknown>(appApiUrl(LOYALTY_ENDPOINTS.summary));
    return parseLoyaltySummary(data);
  },
};

export const loyaltyApi = env.dataSource === "live" ? liveAdapter : mockAdapter;

// PROVISIONAL sample payload — used ONLY by unit tests, never rendered in the UI.
export const __PROVISIONAL_LOYALTY_RAW = {
  enabled: true,
  points: 1200,
  redemption_value: { amount_minor: "1200", currency: "GBP" },
  tier: "Silver",
  activity: [
    { id: 1, type: "earned", points: 200, description: "Order #1001", date: "2026-05-01T10:00:00Z" },
    { id: 2, type: "redeemed", points: -500, description: "Voucher", date: "2026-05-10T10:00:00Z" },
  ],
  terms_url: "https://apeps.co.uk/loyalty-terms",
};
