# Refill Club module

**Purpose:** Let customers opt in to **reminders** to reorder products they buy
regularly, and manage those reminder preferences. This is REMINDER-ONLY.

**Explicitly NOT built:** recurring charges, automatic ordering, subscription
billing, or any medical/dosage reminders. Wording is commerce-only:
"You previously ordered this product. Reorder is available."

**Required App Connector endpoints (PROVISIONAL):**
- `GET|POST /refill/preferences` → `{ enabled, reminderConsent, defaultIntervalDays }`
- `GET /refill/items` → saved refill reminders (no billing data).

**Authentication:** Required. Preferences are consent-gated and OFF by default.

**WooCommerce / plugin dependency:** Customer meta stored via the connector.
Actual reorder still goes through the normal basket + checkout (current prices,
current stock) — Refill Club never charges or orders on the customer's behalf.

**What remains mocked:** Preferences return disabled defaults; plans return `[]`.
No fabricated subscriptions are shown.

**Acceptance criteria:**
- Disabled by default; requires explicit consent to enable.
- No recurring charge, auto-order, or medical/dosage wording anywhere.
- Reorders always require normal checkout with current prices/stock.
