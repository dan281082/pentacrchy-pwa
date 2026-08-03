# Apeps Supplies — Phase 2 Integration Plan & Access Checklist

**Status:** PLAN ONLY. No production changes. All writes stay on **staging** until you approve.
**Backend policy:** The WordPress **Apeps App Connector** plugin is the ONLY server layer.
No FastAPI / no second backend / no MongoDB. Reuse the app's existing shared fetch client,
module registry, feature flags and module primitives.

Grounded in verified WooCommerce Store API + headless-auth guidance (Store API Cart-Token flow,
custom-plugin Bearer tokens, secure website-checkout handoff).

---

## A. Priority order (as instructed)
1. Staging environment → 2. Connector install → 3. Customer auth → 4. Real cart/token →
5. Coupons & shipping → 6. Secure website-checkout fallback → 7. Orders & tracking →
8. Loyalty → 9. Notifications → 10. Refill preferences.

**First end-to-end slice to prove:** login → session restore → real basket → coupon validation →
shipping rates → secure website-checkout fallback → order appears in customer order history.
Only after that is proven do we connect live tracking + loyalty.

---

## B. Exact WordPress plugin files to install
Copy to `wp-content/plugins/apeps-app-connector/` on **staging**, then activate:
- `apeps-app-connector.php` (already delivered — routes, tokens, rate limiting, admin settings)
- `includes/admin-settings.php` (already delivered — capability-gated settings)

Phase-2 additions to build inside the plugin (staging first):
- `includes/auth.php` — `/auth/login|register|refresh|logout|forgot` hardening (see §K).
- `includes/cart-claim.php` — `POST /auth/cart/claim` (associate Store API Cart-Token with the logged-in customer via WooCommerce session APIs — no raw SQL on `woocommerce_sessions`).
- `includes/checkout-session.php` — `POST /checkout-sessions` one-time handoff code (60–120s) for the website-checkout fallback.
- `includes/orders.php` — `/me/orders`, `/me/orders/{id}` (ownership-scoped, allow-listed fields).
- `includes/tracking.php` — read shipment-tracking meta (allow-list carrier/number/url only).
- `includes/loyalty.php` — read-only adapter over the existing loyalty plugin.
- `includes/notifications.php` + `includes/wc-hooks.php` — device registry, preferences, transactional hooks (async).

Add to staging `wp-config.php` (secret NEVER in the app):
```php
define('APEPS_APP_JWT_SECRET', '<64+ random chars>');
```

---

## C. Required access checklist (what I need from you)
| # | Item | Why |
|---|------|-----|
| 1 | **Staging site URL** (`https://staging.apeps.co.uk` or similar) with HTTPS + pretty permalinks | All Phase-2 wiring targets staging |
| 2 | **WP admin (staging)** or a developer who can install/activate the plugin & set `APEPS_APP_JWT_SECRET` | Plugin install + config |
| 3 | Confirmation the staging DB is a **copy/independent** of production | No production writes |
| 4 | **Test customer accounts** on staging (email/password) | Auth + orders testing |
| 5 | **Test payment gateway** credentials (sandbox) enabled on staging | Checkout testing |
| 6 | List of active **payment / shipping / loyalty / tracking / security / caching** plugins + versions | Compatibility audit (§E–I) |
| 7 | Ability to add **SiteGround WAF exclusions** + CORS header on staging | Reachability (§J) |
| 8 | Approved **WhatsApp / support / policy URLs** | Connector `/config` |
| 9 | (Later) Firebase project + **google-services.json**; server key entered in plugin admin | Notifications |
| 10 | Written **go/no-go** before any production cutover | Governance |

---

## D. Required WooCommerce settings (staging)
- Store API reachable: `GET {staging}/wp-json/wc/store/v1/products` and `/cart` return JSON.
- Guest checkout: confirm whether enabled (drives checkout screens).
- Tax: prices incl./excl. VAT setting confirmed (app displays WC values verbatim).
- Shipping zones/methods configured for UK (Standard tracked, Special Delivery by 1pm).
- Coupons enabled with representative test coupons (expired, min/max spend, individual-use, product-excluded, sale-excluded, usage-limited).
- Do **NOT** create a `/wc/v3` REST key for the app (privileged; not a login mechanism).

---

## E. Payment plugins to inspect
- Identify each active gateway + version. For each, decide: **headless Store API checkout supported?**
  - If YES → use `POST /wc/store/v1/checkout` with Cart-Token + `expected_total` (409 on mismatch).
  - If NO → **secure website-checkout fallback** (§ fallback). Do not fake gateway support; do not handle card data in the app.
- Common UK gateways to check: Stripe, PayPal, Opayo/Elavon, WorldPay, Braintree, Klarna, Apple/Google Pay wrappers.

## F. Shipping plugins to inspect
- Core WooCommerce Shipping Zones vs a table-rate / Royal Mail plugin. Confirm rate `rate_id`s are stable and returned by `/cart` `shipping_rates`. The app must never hard-code prices.

## G. Loyalty plugin to inspect
- Identify the ONE plugin controlling points (e.g. "Points and Rewards", "YITH", "myCred"). The Connector reads it **read-only** and maps to the loyalty module's provisional contract. **No second points ledger.**

## H. Tracking plugin to inspect
- Identify the shipment-tracking source (e.g. "Advanced Shipment Tracking", native Royal Mail) and the exact **order meta keys** used (carrier / number / url). Tracking module reads those; never invents events/dates.

## I. Security / caching plugins to inspect
- 2FA / login-security / reCAPTCHA plugins that could block programmatic `/auth/login`.
- Caching/firewall (SiteGround SG Optimizer, WAF) — ensure `/wp-json/*` is **not cached** for authenticated/cart requests.

---

## J. SiteGround WAF exclusions + CORS
**WAF (bot protection / sgcaptcha):** exclude these paths from the JS/IP challenge so native clients get JSON, not an HTML challenge:
- `/wp-json/wc/store/v1/*` (catalogue + cart)
- `/wp-json/apeps/v1/*` (connector)
Keep the challenge on `/wp-login.php`, `/wp-admin/*`, xmlrpc.

**CORS:** Native RN fetch is **not** subject to CORS (device works today). CORS only matters for the **web preview**. If web parity is needed, have the connector send `Access-Control-Allow-Origin` for the specific preview origin(s) on `/wp-json/apeps/v1/*` (allow-list, not `*`), plus `Access-Control-Allow-Headers: Authorization, Content-Type, Cart-Token, Nonce` and expose `Cart-Token, Nonce` via `Access-Control-Expose-Headers`. Do not enable permissive CORS in production.

---

## K. Authentication token strategy (verified)
- **Access token:** signed JWT, 5–15 min, claims `iss/aud/sub(WP user id)/iat/exp/jti` + scopes.
- **Refresh token:** 32+ random bytes, opaque, **one-time use**, 30–90 days; store only a **SHA-256 hash** server-side; **rotate** on every refresh; **reuse detection** revokes the whole token family.
- **Storage:** Expo **SecureStore** on device (never AsyncStorage for tokens). Web fallback = HttpOnly cookie session (not JS-readable) if web parity is required.
- **Revocation:** logout / device-remove / password-reset / suspicious reuse invalidate sessions.
- **Cart linking:** guest gets a Store API `Cart-Token`; after login call `POST /auth/cart/claim` (Cart-Token in body, never URL) to merge the session with the WP customer; app replaces its token and re-reads `/cart`.
- Reuse the app's existing shared fetch client; add a token-refresh interceptor + a Cart-Token capture/resend layer (persist the `Cart-Token` response header, resend on every cart/checkout request).

---

## L. Real basket / cart-token flow
- `GET /cart` → capture `Cart-Token` header → persist (SecureStore) → resend on all cart ops.
- Endpoints: `add-item`, `update-item`, `remove-item`, `apply-coupon`, `update-customer`, `select-shipping-rate`. **Serialize** mutations (queue) to avoid lost writes; on `409` adopt the server cart and retry only when safe.
- Migrate the current local Zustand basket to a "pending → synced" model: keep offline resilience, but WooCommerce becomes authoritative for prices/VAT/discounts/shipping/total on reconnect (before checkout, revalidate).

## M. Secure website-checkout fallback (default until a gateway is proven headless)
1. App → `POST /checkout-sessions` (Bearer + Cart-Token + random `state` + allow-listed return URI).
2. Plugin stores a **one-time code hash** (≤120s), returns `{url, state}`. No tokens in URLs.
3. `WebBrowser.openAuthSessionAsync(url, 'apeps://checkout-return')`.
4. WP handoff consumes the code, rebuilds the website cart server-side, sets the WC cookie, redirects to `/checkout`.
5. Existing gateway completes payment. App returns via deep link; validate `state`.
6. Treat redirect as "flow returned," **not** proof of payment → refresh order state from WooCommerce.

## N. Orders & tracking
- `/me/orders`, `/me/orders/{id}` ownership-scoped by verified `sub` claim (User A can never read User B). Allow-list fields; never return admin notes / payment tokens.
- Tracking: read allow-listed meta (carrier/number/url) + WC status timeline. Estimated delivery only if courier provides it.

---

## O. Rollback plan
- **Plugin:** versioned zip; keep previous version; deactivate → reactivate previous on failure. All new options namespaced `apeps_app_*` (removable). No theme edits, no core WC data migrations.
- **App:** feature flags gate every Phase-2 capability (default OFF). Flip a flag off to instantly revert to Phase-1 behaviour (catalogue + local basket). Preview uses `EXPO_PUBLIC_FLAGS`; production omits them.
- **Config:** `EXPO_PUBLIC_DATA_SOURCE` stays `mock`/`live` switchable; `EXPO_PUBLIC_API_BASE_URL` empty = connector features cleanly disabled.
- **Secrets:** `APEPS_APP_JWT_SECRET` rotation revokes all sessions (documented emergency lever).
- **Git/checkpoints:** use platform rollback to any prior checkpoint if needed.

## P. Test-order strategy (staging only)
- Sandbox gateway; test cards only. Run the full matrix: valid coupon, expired/min/max/individual-use/excluded coupons, shipping selection, address change, VAT recompute, `expected_total` mismatch (409), payment success/failure/cancel, browser dismissal, delayed webhook.
- Verify the placed order appears in `/me/orders` for that test customer and nowhere else.
- Idempotent hook consumers keyed by order id + event/status.

## Q. Data that must NEVER touch production during testing
- No live orders, no live payments, no live stock changes on production.
- No real customer PII in test fixtures; use staging test accounts only.
- No real push notifications (FCM in test mode / staging tokens only).
- No production coupons consumed; no production loyalty balances mutated.
- Secrets (JWT secret, gateway sandbox keys, Firebase server key) live server-side only — never in the app bundle, logs, URLs, or analytics.

---

## R. Module status policy (unchanged)
- Beta modules visible in **preview only** (`EXPO_PUBLIC_FLAGS`); **production flags stay disabled**.
- A module is presented as **live only after** its real Connector endpoint is working and tested on staging.
- Customer app and Owner/Admin systems remain **separate** (admin realm never surfaced here).

## S. Definition of done — first slice
Login → session restore (SecureStore) → real cart via Store API (persisted Cart-Token) →
coupon validated by WooCommerce → shipping rates from WooCommerce → secure website-checkout
fallback completes on staging → order visible in that customer's `/me/orders`. No production writes.
