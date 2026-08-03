=== Apeps App Connector ===
Contributors: apepssupplies
Tags: woocommerce, mobile app, rest api, headless, checkout
Requires at least: 6.2
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 1.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Secure, minimal REST API layer for the Apeps Supplies mobile app. WooCommerce and
WordPress remain the single source of truth for products, stock, prices, orders
and customer accounts.

== Description ==

The Apeps App Connector exposes ONLY the endpoints the native Apeps Supplies app
needs, under the `apeps/v1` namespace. It never exposes WooCommerce consumer
secrets or WP admin credentials, and never stores card data.

**Security model**
* Public endpoints (no auth): `GET /version`, `GET /config`, `POST /device/register`,
  and the one-time website-checkout handoff.
* Authenticated endpoints require a short-lived Bearer access token (HMAC-signed
  with `APEPS_APP_JWT_SECRET`, defined in wp-config.php — never in the app).
* Refresh tokens are opaque, rotated on every refresh, stored only as a SHA-256
  hash in user meta, and are revocable (logout / password change).
* Customer endpoints enforce ownership — a customer can only read their own data.
* Rate limiting on auth + write endpoints; generic auth errors prevent account
  enumeration; every write is sanitised and every response is minimal.
* Checkout uses a secure website-checkout handoff: a one-time code (<=120s), no
  tokens in URLs. The existing website payment gateway completes payment.

**Endpoints (namespace `apeps/v1`)**
* Public: `GET /version`, `GET /config`, `POST /device/register`
* Auth:   `POST /auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`,
          `/auth/forgot`, `POST /auth/cart/claim`
* Customer (Bearer, ownership-scoped): `GET /me`, `GET|POST /me/favourites`,
          `GET /me/orders`, `GET /me/orders/{id}`, `GET /me/orders/{id}/tracking`,
          `GET /me/loyalty`, `GET|POST /me/notifications/preferences`
* Checkout: `POST /checkout-sessions` (+ front-end handoff at
          `/?apeps_checkout_handoff=1&code=...`)

== Installation ==

1. Copy the `apeps-app-connector` folder to `wp-content/plugins/` (or upload the
   ZIP via Plugins → Add New → Upload Plugin).
2. Add the signing secret to `wp-config.php` (above the "stop editing" line):
   `define('APEPS_APP_JWT_SECRET', '<64+ random chars>');`
3. Activate the plugin.
4. WooCommerce must be active with the Store API enabled and pretty permalinks on.
5. Configure remote config / version gate under **Apeps App** in wp-admin.
6. (SiteGround) Exclude `/wp-json/wc/store/v1/*` and `/wp-json/apeps/v1/*` from the
   bot/WAF challenge so native clients receive JSON.

== Testing (staging only) ==

Validate every endpoint on a staging copy before production:
* `GET {site}/wp-json/apeps/v1/version` returns JSON.
* Login → `/me` → `/me/orders` (ownership scoping: user A cannot read user B).
* `POST /auth/cart/claim` with a guest Store API Cart-Token returns the guest items.
* `POST /checkout-sessions` returns a `{url}`; opening it logs the customer in,
  rebuilds the cart and lands on `/checkout`.
* Confirm the active loyalty / shipment-tracking plugins map correctly
  (see `includes/loyalty.php` and `includes/tracking.php`).

== Changelog ==

= 1.1.0 =
* Modular refactor (includes/*): auth, cart-claim, checkout-session, orders,
  tracking, loyalty, notifications, wc-hooks, version, rest, admin-settings.
* Added `POST /auth/cart/claim`, `POST /checkout-sessions` + website handoff,
  `GET /me/orders/{id}/tracking`, `GET /me/loyalty`,
  `GET|POST /me/notifications/preferences`.
* Moved customer routes under `/me/*`; added activation/uninstall cleanup and
  allow-listed CORS for the web preview.

= 1.0.0 =
* Initial release: version/config, auth (login/register/refresh/logout/forgot),
  profile, orders, favourites, device registration, admin settings.

== Upgrade Notice ==

= 1.1.0 =
Customer order routes moved from `/orders` to `/me/orders`. Update the app config
accordingly. Add `APEPS_APP_JWT_SECRET` to wp-config.php if not already present.
