# Apeps Supplies — Mobile App (Milestone 1: Catalogue Journey)

A genuine native Android app (Expo + React Native, iOS-ready) for the Apeps
Supplies WooCommerce store. **WooCommerce/WordPress remain the single source of
truth** — the app never creates a second product, customer or order database.

---

## 1. Architecture

```
Expo React Native app  (this repo, /app/frontend)
        │
        ├── Public WooCommerce Store API  (read-only catalogue: products, categories, prices, stock)
        │        {store}/wp-json/wc/store/v1
        │
        └── Secure Apeps App Connector  (WordPress plugin, /app/deliverables — Phase 2)
                 {store}/wp-json/apeps/v1   (auth, orders, favourites, devices, version, config)
```

- **Frontend:** Expo Router (file-based, iOS-ready), TanStack Query (server
  state), Zustand + persisted storage (basket / favourites / history),
  React Hook Form + Zod (available for Phase-2 forms), Expo SecureStore (via the
  shared `@/src/utils/storage` secure namespace, reserved for Phase-2 tokens).
- **Catalogue facade** (`src/api/catalogue.ts`) switches between a **mock**
  provider and the **live** WooCommerce Store API provider via one env var —
  no UI changes. WooCommerce prices/VAT/stock are shown verbatim; the app
  never recalculates them.

### Folder structure (frontend)
```
app/
  index.tsx                 Splash / bootstrap (network, config, restore basket & favourites)
  (tabs)/_layout.tsx        Bottom tabs: Home · Shop · Search · Orders · Account
  (tabs)/{index,shop,search,orders,account}.tsx
  product/[id].tsx          Product detail (gallery, variations, sticky add-to-basket)
  category/[id].tsx         Category listing
  favourites.tsx            Favourites
  basket.tsx                Basket (coupon, subtotal estimate, sticky checkout CTA)
src/
  theme/                    CENTRAL theme (brand colour, spacing, radius, type) — change once
  config/env.ts             All EXPO_PUBLIC_* config + Store API URL builder
  types/catalogue.ts        Normalised domain model consumed by the UI
  api/                      client.ts · store-api.ts (live) · mock/ · catalogue.ts (facade) · errors.ts
  hooks/                    use-catalogue (TanStack Query) · use-debounce
  store/                    basket-store · favourites-store · history-store (+ persist adapter)
  components/ui/            Screen · Button · Chip · PriceDisplay · StockBadge · QuantityStepper ·
                            Skeleton · EmptyState · ErrorState · SectionHeader · TopBar
  components/product/       ProductCard/Row · ProductRail · CategoryCard · FavouriteButton ·
                            ProductListing · SortSheet
  context/network.tsx       Connectivity + persistent offline banner
  providers/app-providers.tsx
```

---

## 2. Environment configuration

Copy `frontend/.env.example` → adjust. **Only PUBLIC values ever live in the app.**

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_DATA_SOURCE` | `mock` (preview/dev/offline) or `live` (real Store API on device) |
| `EXPO_PUBLIC_STORE_API_BASE_URL` | `https://apeps.co.uk` (Store API at `/wp-json/wc/store/v1`) |
| `EXPO_PUBLIC_WEBSITE_URL` / `_SUPPORT_URL` / `_WHATSAPP_URL` | Deep links + support |
| `EXPO_PUBLIC_API_BASE_URL` | Apeps App Connector base (Phase 2) |
| `EXPO_PUBLIC_CURRENT_VERSION` / `_MINIMUM_SUPPORTED_VERSION` | Update gate |

**Never** put WooCommerce consumer secrets, WP admin credentials or Firebase
**server** credentials in `.env` — they belong only in the WordPress plugin.

---

## 3. Running locally

```bash
cd frontend
yarn install
# Preview default = mock data (works offline, no store access needed)
yarn start
# To serve the real Apeps catalogue on a device:
#   set EXPO_PUBLIC_DATA_SOURCE=live in .env, then reload
```

Scan the Expo Go QR code (Android) or run a dev build.

---

## 4. What is real vs mock (Milestone 1)

| Area | Status |
|---|---|
| Catalogue data (products, categories, prices, sale price, VAT label, stock, attributes, variations) | **Live-ready** via WooCommerce Store API. Preview runs on **MOCK** data by default (see §6). |
| Favourites | Real, **local** persistence (merges to account in Phase 2). |
| Basket | Real, **local** persistence. Subtotal is an estimate from WC unit prices; VAT/shipping/total are shown as "calculated at checkout" — never faked. |
| Recently viewed / recent searches | Real, local. |
| Checkout, coupons validation, shipping rates, orders, tracking, loyalty, auth, push | **Not connected** in Milestone 1 (Phase 2 via the App Connector). Screens are honest about this. |

---

## 5. WordPress plugin — Apeps App Connector (`/app/deliverables/apeps-app-connector`)

Install by copying the folder to `wp-content/plugins/` and activating.

Add to `wp-config.php`:
```php
define('APEPS_APP_JWT_SECRET', '<64+ random characters>');
```

Endpoints (namespace `apeps/v1`):
- **Public:** `GET /version`, `GET /config`, `POST /device/register`
- **Auth:** `POST /auth/{login,register,refresh,logout,forgot}`
- **Customer (Bearer token, ownership-scoped):** `GET /me`, `GET /orders`,
  `GET /orders/{id}`, `GET|POST /favourites`

Security implemented: short-lived HMAC access tokens, rotating **revocable**
refresh tokens (hashed in user meta), rate limiting (transients), input
sanitisation, generic auth errors (no account enumeration), ownership checks on
orders, session invalidation on password change, write-only Firebase server key,
`manage_options`-gated admin settings. **Validate on staging before production.**

---

## 6. Compatibility risks identified (must inspect before Phase 2)

1. **SiteGround bot protection (sgcaptcha) is ACTIVE on `apeps.co.uk`.** It
   challenges datacenter/server IPs and returns an HTML challenge instead of
   JSON. Real mobile devices on normal networks usually pass, but this must be
   verified on-device, and the Store/App API paths (`/wp-json/wc/store/*`,
   `/wp-json/apeps/*`) may need to be excluded from the challenge. The app
   already detects the challenge page and shows a friendly retry state.
2. **CORS:** the web/preview target is blocked (browsers enforce CORS); native
   React Native fetch is not — so the app works on-device. Keep testing on device.
3. **Plugins to audit before checkout/auth phase:** WooCommerce version & Store
   API availability; active theme; **payment gateways** (which support headless
   Store API checkout vs require website fallback); **shipping** plugin/zones
   (Standard tracked, Special Delivery by 1pm); **loyalty points** plugin (which
   controls the balance); **order/shipment tracking** plugin (meta key used);
   login/security plugins (2FA, reCAPTCHA that could block app auth); caching /
   firewall (Store API cacheability) and the SiteGround WAF rules.

---

## 7. Android build (Milestone 1)

- Debug/Release builds and signing are handled via the Emergent **Publish**
  flow (top-right), which manages the EAS build + signing identity securely.
  Do **not** commit signing keys/passwords to the repo.
- `app.json` sets `android.package = com.emergent.apepsapppreview.h4wo9t` and
  `scheme = apeps` (for future deep links). Keep the package/bundle id stable
  across builds.

---

## 8. Next steps (Phase 2)

Staging WooCommerce → install App Connector → wire auth (SecureStore tokens) →
Store API cart/coupons/shipping → checkout (Store API where supported, secure
website fallback otherwise) → orders/tracking/reorder → loyalty (read-only) →
FCM push (transactional + consented marketing) → app-update gate → APK download
page on the website.
