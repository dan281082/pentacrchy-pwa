// PROVISIONAL types. Refill Club scaffolds REMINDER PREFERENCES and future
// renewal-management only. It NEVER creates recurring charges, automatic
// ordering, or medical/dosage reminders. Wording is commerce-only, e.g.
// "You previously ordered this product. Reorder is available."

export interface RefillItem {
  productId: number;
  variationId: number | null;
  name: string;
  intervalDays: number; // customer-chosen reminder cadence
}

// A saved refill REMINDER (not a subscription/billing agreement).
export interface RefillPlan {
  id: string;
  item: RefillItem;
  nextReminderDate: string | null; // reminder only — no charge is ever taken
  active: boolean;
}

export interface RefillPreferences {
  enabled: boolean; // master switch, OFF by default
  reminderConsent: boolean; // explicit consent, OFF by default
  defaultIntervalDays: number;
}
