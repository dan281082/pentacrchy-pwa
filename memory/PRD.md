# Apeps Supplies — Mobile App PRD

## Original problem statement
Build a production-ready, mobile-first Android shopping app for **Apeps Supplies**
connected to the existing WordPress/WooCommerce store (single source of truth).
Genuine native app (not a WebView). Full brief covers catalogue, search, product,
favourites, basket, coupons, shipping, secure checkout (+ website fallback),
auth, orders, reorder, tracking, loyalty, push notifications, app-update system,
a WordPress "Apeps App Connector" plugin, security, accessibility and staged rollout.

## User-confirmed decisions
- **Stack:** Expo + React Native + TypeScript + Expo Router + TanStack Query +
  Zustand + React Hook Form + Zod + Expo SecureStore. iOS-ready architecture.
- **Store:** `https://apeps.co.uk`. Milestone 1 uses **read-only** catalogue via
  the public WooCommerce Store API. No test orders / stock changes / checkout on
  production during Phase 1.
- **Secure customer API:** delivered as a **WordPress plugin** (PHP) — no separate
  FastAPI customer/order backend.
- **Design:** black/charcoal + white + Apeps blue; centralised theme.
- **First slice:** Splash → Home → Shop/Categories → Search → Product → Favourites → Basket.

## Architecture
Expo RN app → (public WooCommerce Store API for catalogue) + (secure Apeps App
Connector WordPress plugin for auth/orders/favourites/devices/version — Phase 2).
Catalogue facade switches mock ↔ live via `EXPO_PUBLIC_DATA_SOURCE`.

## Implemented (2026-06 — Milestone 1)
- Central theme, env config, normalised domain model, Store API live client +
  rich mock provider + switchable facade, typed error handling + friendly messages.
- Splash/bootstrap, 5-tab navigation, sticky glass top bar with live basket badge.
- Home (hero, category rail, Featured/New/Best rails, recently viewed, support).
- Shop + Category listing (sort sheet, grid/list, filter/category chips, infinite
  scroll, pull-to-refresh, skeletons, empty/error states).
- Debounced Search (recent searches, suggestions, no-results).
- Product detail (swipe gallery + zoom, sale/VAT price, stock, variations with
  gated add-to-basket, quantity, description/attributes, related, favourite).
- Persistent Favourites and Basket (Zustand + storage) with coupon capture and
  honest "totals calculated at checkout" copy.
- Orders/Account honest Phase-2 states; offline banner; accessibility (labels,
  44pt targets, contrast, reduced-motion-friendly).
- Deliverables: Apeps App Connector plugin (PHP) + admin settings; `.env.example`;
  handover README with plugin-inspection list & compatibility risks.
- Verified by the testing agent (all catalogue flows pass on mock data).

## Known limitations / uses mock
- Preview serves MOCK catalogue (live store behind SiteGround bot protection +
  browser CORS; live works on real device via `EXPO_PUBLIC_DATA_SOURCE=live`).
- Checkout, coupon validation, shipping rates, auth, orders, tracking, loyalty,
  push are NOT connected yet (Phase 2, need staging + plugin installed).

## Backlog (prioritised)
- **P0 (Phase 2):** staging wiring → App Connector install → auth (SecureStore
  tokens) → Store API cart/coupons/shipping → checkout (Store API + secure
  website fallback) → orders/tracking/reorder.
- **P1:** loyalty (read-only), FCM push (transactional + consented marketing),
  restock alerts, app-update gate, APK download page, deep links.
- **P2:** reorder reminders, biometric unlock, tablet layout, analytics layer,
  iOS release, owner dashboard (separate app/auth).

## Next tasks
1. Provide a staging WooCommerce store + install Apeps App Connector.
2. Confirm payment-gateway headless compatibility (else website fallback).
3. Verify Store API reachability on real device (SiteGround WAF exclusion).
