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

## Update — Customer email investigation (connector v2.1.4 live)
- Root cause: NOT the connector/trigger. WooCommerce fires "Processing order" automatically on payment_complete (pending→processing) and "Completed order" on dispatch; verified via staff-only diagnostics (GET /api/glp/fulfilment/debug/emails?order=ID).
- Delivery failed because WP used PHP mail() with From = dan281082@googlemail.com (Gmail DMARC rejects). User set WooCommerce From address to support@ap3p-fitness.com (confirmed live, order #275). From name / Site Title still "My WordPress" (user to change to "Pentarchy Vial").
- v2.1.1+ includes email safety net (sends standard WC email once if WC did not). v2.1.2+ diagnostics (event ring buffer, transport, settings snapshot).
- Optional: WP Mail SMTP with support@ap3p-fitness.com for authenticated sending.

## Update — PWA release (no native apps)
- Hosting: SiteGround subdomain app.ap3p-fitness.com (static Expo web export) + PHP proxy pwa/api/glp.php (loads WP via wp-load.php, dispatches glp/v1 internally with GLP_APP_SHARED_SECRET; allow-listed routes; replaces FastAPI in prod).
- Files: frontend/public/{index.html, manifest.webmanifest, sw.js, icons/*}; frontend/pwa/{.htaccess, api/glp.php}; scripts/build-pwa.sh → /app/pwa-release/pentarchy-vial-pwa.zip
- SW caches shell/static only; never /api, non-GET or cross-origin.
- InstallHint on Home (web only; iOS instructions / Android prompt).
- Names: manifest name "Pentarchy Vial", short "Pentarchy"; in-app wordmark PENTARCHY.
- Crypto stays Test Mode until final production E2E. WP Mail SMTP not installed (email verified via order #276).
- STATUS: release zip built; awaiting user to create subdomain + upload; then E2E on https://app.ap3p-fitness.com.
- PWA LIVE at https://app.ap3p-fitness.com (SiteGround, A record → 35.214.14.95; earlier doubled subdomain app.ap3p-fitness.com.ap3p-fitness.com fixed by user). PHP proxy verified: loads WP, health 200 (connector 2.1.4), auth/catalogue/orders/labels OK, 401/403/404 guards OK (iteration_8).
- Staff login test@test.com now rejected (password changed on WP) — staff check skipped by user.
- Checkout now shows enabled crypto networks from /crypto/networks (TRON default, Ethereum available). Boot screen inline in index.html; old GLP SW kill-switch (public/service-worker.js) + unregister foreign SWs; manifest.json/glp-icon.png overridden with Pentarchy.
- Stray preview order #280 (r30 £23, Processing) placed accidentally by testing agent — user to cancel in WooCommerce to restore stock.
- Proposed next: Web Push stock alerts (VAPID, connector v2.2.0) — awaiting user approval.
- v2.2.0 connector: includes/push.php + vendor (minishlink/web-push 9) — Web Push stock alerts (new_vial / back_in_stock prefs per member; VAPID keys generated server-side in option glp_push_vapid; subs in user meta _glp_push_subs; triggers: publish/private-flag-tick (deferred 60s, once per product, baseline for existing), outofstock→available only during product-side saves; Action Scheduler sending; 404/410 cleanup; POST /push/{status,subscribe,prefs,unsubscribe,test}).
- App: Account → Stock alerts (StockAlerts.tsx, utils/web-push.ts); sw.js push + notificationclick → /product/{id}.

## Update — v2.3.0 staff operations (connector source now persisted at /app/backend/connector-src/glp-app-connector)
- includes/manage.php: caps glp_manage_catalogue / glp_manage_members; role "Pentarchy Store Manager" (glp_store_manager: fulfil+catalogue+members, no wp-admin); /me adds manage/members flags.
- Routes: GET/POST /manage/products, GET/POST /manage/products/{id}, POST /manage/products/{id}/duplicate (WC duplicate → draft), GET /manage/audit, GET /manage/members, POST /manage/members/{id} {approved}.
- Audit trail: option glp_staff_audit (last 1000) + product meta _glp_audit (last 100).
- Sales: total_sales meta + 30-day sum from processing/completed orders.
- Notify members: ONLY via staff save tick box (automatic push triggers removed from push.php).
- ERC20 only: /crypto/networks filtered to ethereum; POST /orders & /crypto-network reject non-ethereum.
- PWA renamed "Pentarchy" (manifest/title). Staff UI: (tabs)/products.tsx, app/manage/product/[id].tsx, app/manage/members.tsx, app/manage/audit.tsx.
- STATUS: built, NOT yet installed/tested live.

## Update — v2.4.0: COA + final Pentarchy polish (2026-06)
- COA (Certificate of Analysis), optional per product: connector `includes/coa.php`. Staff can upload a PDF/JPG/PNG (≤5 MB, kept in a private folder outside the web root, never in the media library) or enter an https URL through manage/products save (coa_file/coa_name/coa_url/coa_remove). `coa` is returned in the catalogue/product payloads (customer-safe). Members fetch it via GET /glp/v1/products/{id}/coa (approved member + members-only + published; staff can fetch any status). Proxy routes were added in glp.php and glp_proxy.py.
- Customer product page: CoaSection is shown only when a COA exists. The "Ask a question" link was removed.
- Staff editor: COA card (upload / link / remove), photos resized on the device (expo-image-manipulator, 1600px, JPEG 80%), and confirm dialogs before unpublish, stock set to zero, COA removal and member suspension. Every save refreshes all queries; the product detail uses staleTime 0.
- New staff-created products default to members-only with catalog visibility hidden. wp_robots adds noindex to members-only product pages.
- Customer WooCommerce emails get Reply-To thepentarchy@proton.me; the sender is unchanged.
- Branding: "Vial(s)" was removed from app text (Shop tab, "Available now", etc.); the push title is now "New product available". The Account screen shows a Contact email row; the Data source badge was removed.
- Deliverables: backend/glp-app-connector.zip (v2.4.0), deliverables/glp-app-connector-2.4.0.zip, /app/pwa-release/pentarchy-pwa.zip.
- Known: the WooCommerce category named "Vials" on WP still appears in the app. Rename it in WP admin.
- Tested: iteration_10 (customer flows pass; COA hidden correctly while v2.3.0 is live).
