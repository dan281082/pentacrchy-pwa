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

## Backlog (prioritised)
- **P0:** Unblock staging WAF → flip `EXPO_PUBLIC_DATA_SOURCE=live` + set connector base URL →
  verify auth/register/approval + orders/tracking against real WooCommerce staging data.
- **P1:** Store API cart + shipping rates; secure website-checkout handoff end-to-end.
- **P2:** iOS release; owner/admin dashboard (separate app/auth).

