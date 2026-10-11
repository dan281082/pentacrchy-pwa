# Apeps — Private Members' Leftover-Vial Storefront (PRD)

## Current product direction (2026-06, repositioned)
A **private, members-only storefront** for an existing Telegram group-buy community.
It is **NOT** a group-buy platform — group buys happen outside the app. After a group
buy, surplus/extra stock is added to WooCommerce and sold here as **individual units
while stock lasts**. WooCommerce remains the single source of truth for products, stock,
prices, customers and orders; normal WC stock management prevents overselling.

**Customer flow:** Register → Telegram username captured → account approval →
Available Vials → Basket → Checkout → Payment → My Orders → Tracking.

**Explicitly excluded (do NOT build):** group-buy management, pledges, deadlines,
minimum-buy quantities, loyalty, affiliates/referrals, coupons, trade accounts.

## User-confirmed decisions (this session)
- Keep ONLY the **Live tracking** ecosystem module (tracking surfaced inside My Orders).
- Unapproved members see a **full "Pending approval" lock screen** (cannot see vials).
- **Telegram username is REQUIRED** at registration.
- **Auto-approve** any member who registers with a valid Telegram username.
- Build against **mock data** for now; wire live once staging WAF unblocks the container IP.

## Original problem statement (history)
Build a production-ready, mobile-first Android shopping app for Apeps connected to the
existing WordPress/WooCommerce store (single source of truth). Genuine native app (Expo).
Secure customer API delivered as a WordPress plugin ("Apeps App Connector") — no FastAPI/Mongo.

## Stack / architecture
- Expo + React Native + TypeScript + Expo Router + TanStack Query + Zustand + Expo SecureStore.
- Catalogue, auth and orders each use a mock↔live facade switched by `EXPO_PUBLIC_DATA_SOURCE`.
- Live backend = public WooCommerce Store API (catalogue/cart) + Apeps App Connector plugin
  (`/wp-json/apeps/v1/*`) for auth/orders/tracking. Staging: `staging2.apeps.co.uk`.

## Implemented — Phase 1 (catalogue, prior sessions)
- Theme, env config, normalised domain model, Store API client + mock provider + facade.
- Splash, 5-tab nav, glass top bar + basket badge, Home, Shop/Category listing, Search,
  Product detail (gallery/zoom/variations/stock), persistent Favourites + Basket.

## Implemented — Members storefront + auth (2026-06, this session)
- **Auth layer** (`src/api/auth/*`, `src/context/auth.tsx`): mock + live providers behind a
  facade; state machine loading→signedOut→pending→ready; tokens in SecureStore; cold-start
  restore + best-effort `/me` revalidation (approval is always server-authoritative).
- **Registration** (`app/(auth)/register.tsx`): required+validated Telegram username
  (`src/utils/telegram.ts`), auto-approve on valid handle, duplicate email/telegram rejected.
- **Login** (`app/(auth)/login.tsx`) + **Pending approval lock screen** (`app/pending.tsx`).
- **Route guards** in `app/index.tsx`, `(tabs)/_layout.tsx`, `(auth)/_layout.tsx`, `pending.tsx`.
- **My Orders** (`app/(tabs)/orders.tsx`) + **order detail with tracking timeline** (`app/order/[id].tsx`)
  via mock/live orders facade (`src/api/orders/*`, `src/hooks/use-orders.ts`).
- **Removals/renames:** coupons removed (basket + store); Shop tab → "Vials"/"Available Vials";
  Home simplified to an "Available now" rail; ecosystem modules trimmed to Live tracking only
  (`src/modules/registry.ts`, `src/config/feature-flags.ts`).
- **Account** shows member profile (name/email/Telegram @handle + Approved badge) + Sign out.
- **WP plugin** (`backend/apeps-app-connector/includes/auth.php`): Telegram capture + validation,
  `_apeps_approved`/`_apeps_telegram_username` user meta, auto-approve on register, `approved` +
  `telegramUsername` in login/register/`/me` responses, and an admin approve/revoke control
  (Users list column + user-profile toggle). Repackaged `backend/apeps-app-connector.zip`.
- Verified by the testing agent (iteration 2): all 8 flows pass on mock data, no functional bugs.

## Mock test accounts (auto-seeded)
- Approved: `demo@apeps.co.uk` / `Password123` (@demo_member)
- Pending:  `pending@apeps.co.uk` / `Password123` (@pending_member)

## Known limitations / blocked
- Preview runs on MOCK data. Live staging API returns HTTP 202 `sg-captcha` — **SiteGround WAF
  must whitelist the container egress IP** (currently `34.16.56.64`) before live wiring/testing.
- Live checkout/payment uses the secure website-checkout fallback (opens `/checkout`); full
  Store API cart/shipping wiring pending staging access.
- Cosmetic web-only warnings (pointerEvents prop; nested Pressable hydration on ProductRail).

## Live crypto-checkout integration (2026-06, in progress)
Confirmed direction: real **in-app USDT (TRON/TRC20) checkout** via the existing **GLP App
Connector v2.0.0** + **Apeps Crypto Payments Gateway** (gateway id `apeps_crypto`), WooCommerce
authoritative, **no website redirect, no Stripe**, Crypto Test Mode during dev.

Architecture (confirmed A+B):
- **A. Trusted FastAPI proxy** (`backend/glp_proxy.py`, mounted at `/api/glp/*`, port 8001): holds
  `GLP_APP_SHARED_SECRET` server-side (never in the app), forwards to `{GLP_BASE_URL}/wp-json/glp/v1/*`
  with the secret + the customer's opaque `X-GLP-Customer-Token`. Routes: auth/register, auth/session,
  me, me/addresses, account/shipping-address, categories, catalogue, products/{id}, basket/validate,
  shipping/quote, orders (GET/POST), orders/{id}, crypto/networks, crypto-invoice, crypto-recheck,
  crypto-network, cancel, health. `GLP_BASE_URL` in `backend/.env`; secret injected via server secrets.
- **B. GLP connector extended** (`backend/_glp_ref/glp-app-connector/glp-app-connector.php`, repackaged
  `backend/glp-app-connector.zip`): added `POST /glp/v1/register` — required+validated Telegram username
  (`_glp_telegram_username`), creates WC customer, `_glp_app_approved=yes` + `glp_customer` role (auto-
  approve), returns `{customer, token}` like `/session`; `telegram_username` added to `glp_public_customer`.
- Stock re-validation already enforced server-side in the GLP connector (`glp_validate_items` → 409
  `basket_invalid` immediately before `wc_create_order`).

Invoice/order contract (from connector source): `POST /orders` {items[{product_id,qty,variation_id}],
payment_method:'crypto', network, shipping_address, shipping_method(rate id), client_ref}; invoice via
`GET /orders/{id}/crypto-invoice` (`invoice.to_public_array()` + `payment_uri` for QR + `network_label`);
statuses awaiting_payment→payment_detected→confirming→complete, plus expired/partially_paid/underpaid/
overpaid/failed/cancelled; `complete` → gateway `payment_complete()` → WooCommerce Processing.

### LIVE storefront integration — COMPLETE + E2E VERIFIED (2026-10-11)
- App switched to `EXPO_PUBLIC_DATA_SOURCE=glp`; all data via the FastAPI proxy `/api/glp/*` →
  GLP connector on **ap3p-fitness.com** (secret server-side; Crypto Test Mode ON).
- Frontend GLP layer: `src/api/glp/{client,auth,catalogue,orders,checkout}.ts`; facades
  (auth/catalogue/orders) switch on `glp`; auth context syncs the bearer token into `glpClient`.
- New in-app checkout (no website redirect): `app/checkout.tsx` (address + live shipping quote +
  order summary + place order) and `app/checkout/invoice/[id].tsx` (USDT/TRON invoice — amount,
  copyable address, QR via react-native-qrcode-svg, countdown, confirmations, recheck, live polling →
  'Payment received'). Basket CTA now routes to /checkout. Coupons removed.
- Server-side stock re-validation enforced by the connector (409 basket_invalid) before order creation.
- Testing agent (iteration 5): full journey PASS — register→auto-approve→real vials→variable product
  →basket→£6 shipping→**order #259 placed**→crypto invoice→Test Mode auto-complete→'Payment received'→
  Orders. No backend 5xx. Note: in Test Mode the invoice jumps straight to `complete`, so the pre-payment
  QR/countdown UI flashes briefly before the paid screen (expected; shows fully in live/non-test mode).
- Minor web-only: nested Pressable (FavouriteButton inside rail card) hydration warning — cosmetic, web
  preview only, not on native.
- Housekeeping: test customers + orders (#253/#257/#259) created on ap3p-fitness.com during verification.

### (earlier) Connectivity — RESOLVED (2026-10-10)
- Backend host is **`https://ap3p-fitness.com`** (hosts `glp/v1` + crypto routes), NOT staging2.apeps.co.uk
  (staging2 only runs legacy apeps/v1+apeps/v2). `GLP_BASE_URL` updated accordingly.
- SiteGround AntiBot 202/sg-captcha fixed by using a non-browser server UA **`AP3P-Storefront-API/1.0`**
  for all proxy→WordPress requests (`backend/glp_proxy.py`).
- `GLP_APP_SHARED_SECRET` aligned to ap3p-fitness.com's wp-config value (server-side only).
- Verified by testing agent: `GET /api/glp/health` → 200 `upstream_reachable:true`; bad-creds
  `/auth/session` → proxied 401; `/crypto/networks` (no token) → proxied 401. Secret never leaked.
- OUTSTANDING: `/glp/v1/register` (my addition) not yet installed on ap3p-fitness.com (404) — user to
  install `backend/glp-app-connector.zip`. Full end-to-end test deferred per user until then.

### (superseded) earlier blocked notes
- **Server secret:** proxy returns `proxy_unconfigured` until `GLP_APP_SHARED_SECRET` is set in backend
  server env (user to add; must match staging `wp-config.php`).
- **WAF:** `staging2.apeps.co.uk` still returns **HTTP 202 sg-captcha** for egress IP `34.16.56.64`
  (confirmed 2026-10-10T08:58Z on `/wp-json/glp/v1/version`). SiteGround must stop challenging this IP.
- **Frontend rewire (next):** add a GLP data/auth provider hitting `/api/glp/*` (switch via
  `EXPO_PUBLIC_DATA_SOURCE=glp`), keep current mock as default so preview stays functional; build the
  in-app crypto checkout (address → shipping → place order → USDT invoice screen w/ amount+address+QR +
  status polling → success → My Orders). Then run the full live staging e2e test.



## Update — Pentarchy fulfilment redesign (Oct 2026)
- Branding: all visible UI now "Pentarchy" (internal ids/gateway names unchanged).
- AST tracking work stopped. Customers supply their own postage label/QR.
- Connector v2.1.0 (glp-app-connector.zip; backup glp-app-connector-2.0.0-backup.zip): new includes/fulfilment.php
  - role glp_fulfilment + cap glp_fulfil_orders (also on administrator); fulfilment-only users blocked from wp-admin
  - /me returns `fulfilment` bool
  - £0 "Customer-supplied postage label" shipping rate for app orders only (filter glp_shipping_rates)
  - customer: GET/POST /orders/{id}/label (owner-only, Processing & not dispatched, PDF/JPG/PNG ≤5MB, magic-byte validated; QR = image only)
  - staff: GET /fulfilment/orders, GET /fulfilment/orders/{id}, GET .../label, POST .../ready, POST .../dispatch (→ WC Completed, label locked)
  - private storage outside web root (fallback uploads/glp-labels with deny-all), never Media Library
  - WC order-screen metabox: view/download + Mark dispatched (cap-checked, nonce)
- App: Provide Shipping Label section on order detail; staff Fulfilment tab (hidden unless user.fulfilment) + /fulfilment/[id]; checkout shows postage info instead of shipping price.
- STATUS: v2.1.0 INSTALLED live. Full E2E verified (iteration_7): customer upload/replace/lock, staff ready/dispatch, isolation, validation. Proxy adds _nc cache-buster on authenticated GETs (SiteGround cache). Updated zip (adds no-cache headers on all glp/v1 responses) awaiting optional re-upload. Test order 263 now dispatched.
