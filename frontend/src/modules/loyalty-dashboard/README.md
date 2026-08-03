# Loyalty dashboard module

**Purpose:** Show the customer's loyalty points, tier, approximate redemption
value and recent activity — reading the **existing** WooCommerce loyalty system.
This module **must not** create a second points balance.

**Required App Connector endpoints (PROVISIONAL):**
- `GET /loyalty/summary` → `{ enabled, points, redemption_value, tier, activity[], terms_url }`
  (final path/fields depend on the installed loyalty plugin).

**Authentication:** Required (customer Bearer token). Gated by `useModuleAuth`.

**WooCommerce / plugin dependency:** The active loyalty plugin (e.g. points &
rewards). The connector reads it read-only and exposes the summary.

**What remains mocked:** The mock adapter returns an EMPTY, unconfigured summary
(`enabled:false, points:null`) — no fabricated balance is ever shown. A
provisional sample payload exists only for parser unit tests.

**Acceptance criteria:**
- Points/tier/value shown come 1:1 from the loyalty system (never computed here).
- Signed-out → unauthorised state; connected-but-empty → clear empty state.
- No second points ledger is created anywhere in the app.
