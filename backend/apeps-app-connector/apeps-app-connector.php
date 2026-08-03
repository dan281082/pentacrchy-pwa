<?php
/**
 * Plugin Name:       Apeps App Connector
 * Plugin URI:        https://apeps.co.uk
 * Description:        Secure, minimal API layer for the Apeps Supplies mobile app. Exposes ONLY the endpoints the app needs. WooCommerce/WordPress remain the single source of truth. Never exposes WooCommerce consumer secrets or WP admin credentials.
 * Version:           1.1.0
 * Requires at least: 6.2
 * Requires PHP:      7.4
 * Author:            Apeps Supplies
 * License:           GPL-2.0-or-later
 * Text Domain:       apeps-app
 *
 * SECURITY MODEL
 * -------------------------------------------------------------------------
 * - Public endpoints (no auth): /version, /config, /device/register,
 *   /checkout/handoff (one-time code only).
 * - Authenticated endpoints require a short-lived Bearer access token issued
 *   by /auth/login or /auth/refresh. Tokens are HMAC-signed with a server-side
 *   secret (APEPS_APP_JWT_SECRET, defined in wp-config.php — NEVER in the app).
 * - Refresh tokens are stored hashed (sha256) in user meta and are revocable.
 * - All customer endpoints enforce ownership (a customer can only read their
 *   own data). Order lookups are scoped to the authenticated user id.
 * - Every write is sanitised; every response is minimal. Rate limiting is
 *   applied to auth + write endpoints via transients keyed by IP + route.
 * - Generic auth errors prevent account enumeration.
 * - Checkout uses a secure website-checkout handoff (one-time code, ≤120s,
 *   no tokens in URLs). No card data ever touches the app or this plugin.
 *
 * ARCHITECTURE (modular)
 * -------------------------------------------------------------------------
 * apeps-app-connector.php   Bootstrap: constants, includes, (de)activation.
 * includes/rest.php         Shared helpers: secrets, tokens, rate limit, CORS,
 *                           auth resolver, WC session/cart helpers.
 * includes/version.php      GET /version, GET /config (remote config gate).
 * includes/auth.php         POST /auth/{login,register,refresh,logout,forgot}, GET /me.
 * includes/cart-claim.php   POST /auth/cart/claim (link Store API Cart-Token to customer).
 * includes/checkout-session.php  POST /checkout-sessions + website handoff consumer.
 * includes/orders.php       GET /me/orders, GET /me/orders/{id} (ownership-scoped).
 * includes/tracking.php     GET /me/orders/{id}/tracking (allow-listed meta).
 * includes/loyalty.php      GET /me/loyalty (read-only adapter, provisional contract).
 * includes/notifications.php POST /device/register, GET|POST /me/notifications/preferences.
 * includes/wc-hooks.php     Order-status transactional hooks (async) + session invalidation.
 * includes/admin-settings.php Capability-gated admin settings (remote config, version, FCM).
 *
 * PHASE STATUS
 * -------------------------------------------------------------------------
 * All endpoints must be VALIDATED ON STAGING before any production use.
 * Cart-claim + checkout handoff depend on the live WooCommerce version and the
 * active payment/shipping plugins — verify on staging (see readme.txt §Testing).
 */

if (!defined('ABSPATH')) {
    exit; // No direct access.
}

/* ── Constants ─────────────────────────────────────────────────────────── */
define('APEPS_APP_VERSION', '1.1.0');
define('APEPS_APP_NS', 'apeps/v1');
define('APEPS_APP_ACCESS_TTL', 15 * MINUTE_IN_SECONDS);   // short-lived access token
define('APEPS_APP_REFRESH_TTL', 30 * DAY_IN_SECONDS);     // rotating refresh token
define('APEPS_APP_CHECKOUT_TTL', 120);                    // website-checkout handoff (seconds)
define('APEPS_APP_DIR', plugin_dir_path(__FILE__));

/* ── Includes (order matters: rest.php first — shared helpers) ─────────────
 * Each module registers its own REST routes on `rest_api_init`. */
require_once APEPS_APP_DIR . 'includes/rest.php';
require_once APEPS_APP_DIR . 'includes/version.php';
require_once APEPS_APP_DIR . 'includes/auth.php';
require_once APEPS_APP_DIR . 'includes/cart-claim.php';
require_once APEPS_APP_DIR . 'includes/checkout-session.php';
require_once APEPS_APP_DIR . 'includes/orders.php';
require_once APEPS_APP_DIR . 'includes/tracking.php';
require_once APEPS_APP_DIR . 'includes/loyalty.php';
require_once APEPS_APP_DIR . 'includes/notifications.php';
require_once APEPS_APP_DIR . 'includes/wc-hooks.php';
require_once APEPS_APP_DIR . 'includes/admin-settings.php';

/* ── Activation / deactivation ─────────────────────────────────────────────
 * No custom tables are created (WooCommerce/WordPress remain the single source
 * of truth). We only seed default options and flush rewrite rules so the
 * checkout-handoff query var + REST routes resolve immediately. */
register_activation_hook(__FILE__, function () {
    add_option('apeps_app_api_enabled', true);
    add_option('apeps_app_latest_version', APEPS_APP_VERSION);
    add_option('apeps_app_min_version', '1.0.0');
    flush_rewrite_rules();
});

register_deactivation_hook(__FILE__, function () {
    flush_rewrite_rules();
});
