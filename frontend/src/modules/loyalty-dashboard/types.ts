// PROVISIONAL types — final shapes depend on the EXISTING WooCommerce loyalty
// plugin exposed via the Apeps App Connector. This module MUST read that single
// source of truth; it never creates a second points system.

export type LoyaltyActivityType = "earned" | "redeemed" | "adjustment";

export interface LoyaltyActivity {
  id: string;
  type: LoyaltyActivityType;
  points: number;
  description: string;
  date: string; // ISO
}

export interface LoyaltyRedemptionValue {
  amountMinor: string; // integer minor units, as provided by the loyalty system
  currency: string;
}

export interface LoyaltySummary {
  enabled: boolean; // whether a loyalty system is connected for this customer
  points: number | null; // null when unknown/not connected — NEVER fabricated
  redemptionValue: LoyaltyRedemptionValue | null;
  tier: string | null;
  activity: LoyaltyActivity[];
  termsUrl: string | null;
}
