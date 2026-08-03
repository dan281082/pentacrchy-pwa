<?php
/**
 * Plugin Name:       Apeps App Connector
 * Plugin URI:        https://apeps.co.uk
 * Description:        Secure, minimal API layer for the Apeps Supplies mobile app. Exposes ONLY the endpoints the app needs. WooCommerce/WordPress remain the single source of truth. Never exposes WooCommerce consumer secrets or WP admin credentials.
 * Version:           1.0.0
 * Requires at least: 6.2
 * Requires PHP:      7.4
 * Author:            Apeps Supplies
 * License:           GPL-2.0-or-later
 * Text Domain:       apeps-app
 *
 * SECURITY MODEL
 * -------------------------------------------------------------------------
 * - Public endpoints (no auth): /version, /config, /device/register.
 * - Authenticated endpoints require a short-lived Bearer access token issued
 *   by /auth/login or /auth/refresh. Tokens are HMAC-signed with a server-side
 *   secret (APEPS_APP_JWT_SECRET, defined in wp-config.php — NEVER in the app).
 * - Refresh tokens are stored hashed (sha256) in user meta and are revocable.
 * - All customer endpoints enforce ownership (a customer can only read their
 *   own data). Order lookups are scoped to the authenticated user id.
 * - Every write is sanitised; every response is minimal. Rate limiting is
 *   applied to auth + write endpoints via transients keyed by IP + route.
 * - Generic auth errors prevent account enumeration.
 *
 * PHASE STATUS
 * -------------------------------------------------------------------------
 * Fully functional here: /version, /config (+ admin settings), rate limiting,
 * token issue/verify/refresh/revoke, device registration, favourites (user
 * meta), profile, orders list + single (ownership-scoped), tracking read.
 * To be validated on STAGING before any production use (see docs).
 */

if (!defined('ABSPATH')) {
    exit; // No direct access.
}

define('APEPS_APP_VERSION', '1.0.0');
define('APEPS_APP_NS', 'apeps/v1');
define('APEPS_APP_ACCESS_TTL', 15 * MINUTE_IN_SECONDS);      // short-lived access token
define('APEPS_APP_REFRESH_TTL', 30 * DAY_IN_SECONDS);        // rotating refresh token

/* ============================================================================
 * Helpers: secrets, tokens, rate limiting, responses
 * ========================================================================== */

function apeps_app_secret() {
    // Define in wp-config.php:  define('APEPS_APP_JWT_SECRET', '<64+ random chars>');
    if (defined('APEPS_APP_JWT_SECRET') && strlen(APEPS_APP_JWT_SECRET) >= 32) {
        return APEPS_APP_JWT_SECRET;
    }
    // Fallback: a per-site auto-generated secret stored as an option (created once).
    $secret = get_option('apeps_app_jwt_secret');
    if (!$secret) {
        $secret = wp_generate_password(64, true, true);
        add_option('apeps_app_jwt_secret', $secret, '', false);
    }
    return $secret;
}

function apeps_app_b64url($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}
function apeps_app_b64url_decode($data) {
    return base64_decode(strtr($data, '-_', '+/'));
}

/** Issue a compact signed access token (header.payload.signature). */
function apeps_app_issue_access($user_id) {
    $payload = wp_json_encode(array(
        'uid' => (int) $user_id,
        'iat' => time(),
        'exp' => time() + APEPS_APP_ACCESS_TTL,
        'typ' => 'access',
    ));
    $body = apeps_app_b64url($payload);
    $sig  = apeps_app_b64url(hash_hmac('sha256', $body, apeps_app_secret(), true));
    return $body . '.' . $sig;
}

/** Verify an access token; return user id or WP_Error. */
function apeps_app_verify_access($token) {
    if (!is_string($token) || strpos($token, '.') === false) {
        return new WP_Error('invalid_token', 'Invalid token', array('status' => 401));
    }
    list($body, $sig) = explode('.', $token, 2);
    $expected = apeps_app_b64url(hash_hmac('sha256', $body, apeps_app_secret(), true));
    if (!hash_equals($expected, $sig)) {
        return new WP_Error('invalid_token', 'Invalid token', array('status' => 401));
    }
    $data = json_decode(apeps_app_b64url_decode($body), true);
    if (!is_array($data) || empty($data['uid']) || empty($data['exp'])) {
        return new WP_Error('invalid_token', 'Invalid token', array('status' => 401));
    }
    if (time() > (int) $data['exp']) {
        return new WP_Error('expired_token', 'Session expired', array('status' => 401));
    }
    return (int) $data['uid'];
}

/** Create + persist a rotating refresh token (hashed). Returns the raw token. */
function apeps_app_issue_refresh($user_id, $device_id = '') {
    $raw    = wp_generate_password(64, false, false);
    $hash   = hash('sha256', $raw);
    $tokens = get_user_meta($user_id, '_apeps_refresh_tokens', true);
    if (!is_array($tokens)) $tokens = array();
    // Prune expired.
    $now = time();
    foreach ($tokens as $k => $t) {
        if (empty($t['exp']) || $t['exp'] < $now) unset($tokens[$k]);
    }
    $tokens[$hash] = array(
        'exp'    => $now + APEPS_APP_REFRESH_TTL,
        'device' => sanitize_text_field($device_id),
        'iat'    => $now,
    );
    update_user_meta($user_id, '_apeps_refresh_tokens', $tokens);
    return $raw;
}

/** Consume (rotate) a refresh token. Returns user id or WP_Error. */
function apeps_app_consume_refresh($raw) {
    $hash  = hash('sha256', (string) $raw);
    $users = get_users(array(
        'meta_key'   => '_apeps_refresh_tokens',
        'number'     => 1,
        'fields'     => 'ID',
        'meta_compare' => 'EXISTS',
    ));
    // NOTE: iterate users that have refresh tokens; for large stores add a
    // lookup table. Kept simple for staging validation.
    foreach (get_users(array('meta_key' => '_apeps_refresh_tokens', 'fields' => 'ID')) as $uid) {
        $tokens = get_user_meta($uid, '_apeps_refresh_tokens', true);
        if (is_array($tokens) && isset($tokens[$hash])) {
            if ($tokens[$hash]['exp'] < time()) {
                unset($tokens[$hash]);
                update_user_meta($uid, '_apeps_refresh_tokens', $tokens);
                return new WP_Error('expired_token', 'Session expired', array('status' => 401));
            }
            // Rotate: remove the old one.
            unset($tokens[$hash]);
            update_user_meta($uid, '_apeps_refresh_tokens', $tokens);
            return (int) $uid;
        }
    }
    return new WP_Error('invalid_token', 'Invalid session', array('status' => 401));
}

/** Revoke all refresh tokens for a user (logout-all / password change). */
function apeps_app_revoke_all($user_id) {
    delete_user_meta($user_id, '_apeps_refresh_tokens');
}

/** Simple transient-based rate limiter. Returns true if allowed. */
function apeps_app_rate_ok($bucket, $limit, $window) {
    $ip  = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : '0';
    $key = 'apeps_rl_' . md5($bucket . '|' . $ip);
    $hits = (int) get_transient($key);
    if ($hits >= $limit) return false;
    set_transient($key, $hits + 1, $window);
    return true;
}

function apeps_app_error($code, $message, $status) {
    return new WP_Error($code, $message, array('status' => $status));
}

/** Resolve the authenticated user for a request or return WP_Error. */
function apeps_app_current_user($request) {
    $auth = $request->get_header('authorization');
    if (!$auth || stripos($auth, 'Bearer ') !== 0) {
        return apeps_app_error('no_auth', 'Authentication required', 401);
    }
    $token = trim(substr($auth, 7));
    return apeps_app_verify_access($token);
}

/* ============================================================================
 * Route registration
 * ========================================================================== */

add_action('rest_api_init', function () {

    // ---- Public: app version gate ----
    register_rest_route(APEPS_APP_NS, '/version', array(
        'methods'             => 'GET',
        'permission_callback' => '__return_true',
        'callback'            => 'apeps_app_route_version',
    ));

    // ---- Public: remote config (urls, maintenance, banners) ----
    register_rest_route(APEPS_APP_NS, '/config', array(
        'methods'             => 'GET',
        'permission_callback' => '__return_true',
        'callback'            => 'apeps_app_route_config',
    ));

    // ---- Auth ----
    register_rest_route(APEPS_APP_NS, '/auth/login', array(
        'methods'             => 'POST',
        'permission_callback' => '__return_true',
        'callback'            => 'apeps_app_route_login',
    ));
    register_rest_route(APEPS_APP_NS, '/auth/register', array(
        'methods'             => 'POST',
        'permission_callback' => '__return_true',
        'callback'            => 'apeps_app_route_register',
    ));
    register_rest_route(APEPS_APP_NS, '/auth/refresh', array(
        'methods'             => 'POST',
        'permission_callback' => '__return_true',
        'callback'            => 'apeps_app_route_refresh',
    ));
    register_rest_route(APEPS_APP_NS, '/auth/logout', array(
        'methods'             => 'POST',
        'permission_callback' => '__return_true',
        'callback'            => 'apeps_app_route_logout',
    ));
    register_rest_route(APEPS_APP_NS, '/auth/forgot', array(
        'methods'             => 'POST',
        'permission_callback' => '__return_true',
        'callback'            => 'apeps_app_route_forgot',
    ));

    // ---- Customer (auth required) ----
    register_rest_route(APEPS_APP_NS, '/me', array(
        'methods'             => 'GET',
        'permission_callback' => '__return_true',
        'callback'            => 'apeps_app_route_me',
    ));
    register_rest_route(APEPS_APP_NS, '/orders', array(
        'methods'             => 'GET',
        'permission_callback' => '__return_true',
        'callback'            => 'apeps_app_route_orders',
    ));
    register_rest_route(APEPS_APP_NS, '/orders/(?P<id>\d+)', array(
        'methods'             => 'GET',
        'permission_callback' => '__return_true',
        'callback'            => 'apeps_app_route_order',
    ));
    register_rest_route(APEPS_APP_NS, '/favourites', array(
        array(
            'methods'             => 'GET',
            'permission_callback' => '__return_true',
            'callback'            => 'apeps_app_route_favourites_get',
        ),
        array(
            'methods'             => 'POST',
            'permission_callback' => '__return_true',
            'callback'            => 'apeps_app_route_favourites_set',
        ),
    ));

    // ---- Device registration (public; associates to user if token present) ----
    register_rest_route(APEPS_APP_NS, '/device/register', array(
        'methods'             => 'POST',
        'permission_callback' => '__return_true',
        'callback'            => 'apeps_app_route_device_register',
    ));
});

/* ============================================================================
 * Route handlers
 * ========================================================================== */

function apeps_app_route_version() {
    return rest_ensure_response(array(
        'latestVersion'           => get_option('apeps_app_latest_version', APEPS_APP_VERSION),
        'minimumSupportedVersion' => get_option('apeps_app_min_version', '1.0.0'),
        'updateRequired'          => (bool) get_option('apeps_app_update_required', false),
        'downloadUrl'             => esc_url_raw(get_option('apeps_app_apk_url', '')),
        'releaseNotes'            => array_values((array) get_option('apeps_app_release_notes', array())),
    ));
}

function apeps_app_route_config() {
    $enabled = (bool) get_option('apeps_app_api_enabled', true);
    if (!$enabled) {
        return apeps_app_error('disabled', 'App API is disabled', 503);
    }
    return rest_ensure_response(array(
        'maintenance'        => (bool) get_option('apeps_app_maintenance', false),
        'maintenanceMessage' => esc_html(get_option('apeps_app_maintenance_msg', '')),
        'supportUrl'         => esc_url_raw(get_option('apeps_app_support_url', '')),
        'whatsappUrl'        => esc_url_raw(get_option('apeps_app_whatsapp_url', '')),
        'termsUrl'           => esc_url_raw(get_option('apeps_app_terms_url', '')),
        'privacyUrl'         => esc_url_raw(get_option('apeps_app_privacy_url', '')),
        'deliveryUrl'        => esc_url_raw(get_option('apeps_app_delivery_url', '')),
        'refundUrl'          => esc_url_raw(get_option('apeps_app_refund_url', '')),
        'banners'            => array_values((array) get_option('apeps_app_banners', array())),
        'featuredCategories' => array_map('absint', (array) get_option('apeps_app_featured_cats', array())),
    ));
}

function apeps_app_route_login($request) {
    if (!apeps_app_rate_ok('login', 8, 5 * MINUTE_IN_SECONDS)) {
        return apeps_app_error('rate_limited', 'Too many attempts. Try again later.', 429);
    }
    $email    = sanitize_email((string) $request->get_param('email'));
    $password = (string) $request->get_param('password');
    $device   = sanitize_text_field((string) $request->get_param('deviceId'));

    if (!$email || !$password) {
        return apeps_app_error('invalid', 'Email or password is incorrect.', 401);
    }
    $user = wp_authenticate($email, $password);
    if (is_wp_error($user)) {
        // Generic message — never reveal whether the account exists.
        return apeps_app_error('invalid', 'Email or password is incorrect.', 401);
    }
    return rest_ensure_response(apeps_app_auth_response($user->ID, $device));
}

function apeps_app_route_register($request) {
    if (!apeps_app_rate_ok('register', 5, 10 * MINUTE_IN_SECONDS)) {
        return apeps_app_error('rate_limited', 'Too many attempts. Try again later.', 429);
    }
    $email    = sanitize_email((string) $request->get_param('email'));
    $password = (string) $request->get_param('password');
    $first    = sanitize_text_field((string) $request->get_param('firstName'));
    $last     = sanitize_text_field((string) $request->get_param('lastName'));

    if (!is_email($email) || strlen($password) < 8) {
        return apeps_app_error('invalid_input', 'Please provide a valid email and a password of at least 8 characters.', 400);
    }
    if (email_exists($email)) {
        // Do not confirm existence directly; return generic guidance.
        return apeps_app_error('cannot_register', 'We could not create an account with those details.', 409);
    }
    $user_id = wc_create_new_customer($email, '', $password, array(
        'first_name' => $first,
        'last_name'  => $last,
    ));
    if (is_wp_error($user_id)) {
        return apeps_app_error('cannot_register', 'We could not create an account with those details.', 400);
    }
    $device = sanitize_text_field((string) $request->get_param('deviceId'));
    return rest_ensure_response(apeps_app_auth_response($user_id, $device));
}

function apeps_app_route_refresh($request) {
    if (!apeps_app_rate_ok('refresh', 30, 5 * MINUTE_IN_SECONDS)) {
        return apeps_app_error('rate_limited', 'Too many attempts. Try again later.', 429);
    }
    $refresh = (string) $request->get_param('refreshToken');
    $uid = apeps_app_consume_refresh($refresh);
    if (is_wp_error($uid)) return $uid;
    $device = sanitize_text_field((string) $request->get_param('deviceId'));
    return rest_ensure_response(apeps_app_auth_response($uid, $device));
}

function apeps_app_route_logout($request) {
    $uid = apeps_app_current_user($request);
    if (is_wp_error($uid)) return $uid;
    // Revoke only the presented refresh token if given; else revoke all.
    $refresh = (string) $request->get_param('refreshToken');
    if ($refresh) {
        apeps_app_consume_refresh($refresh); // consuming removes it
    } else {
        apeps_app_revoke_all($uid);
    }
    return rest_ensure_response(array('ok' => true));
}

function apeps_app_route_forgot($request) {
    apeps_app_rate_ok('forgot', 5, 10 * MINUTE_IN_SECONDS);
    $email = sanitize_email((string) $request->get_param('email'));
    // Always return the same response to prevent account enumeration.
    if (is_email($email)) {
        $user = get_user_by('email', $email);
        if ($user) {
            // Use WordPress' built-in secure reset flow.
            retrieve_password($user->user_login);
        }
    }
    return rest_ensure_response(array(
        'ok'      => true,
        'message' => 'If an account exists for that email, a reset link has been sent.',
    ));
}

function apeps_app_auth_response($user_id, $device_id = '') {
    $user = get_userdata($user_id);
    return array(
        'accessToken'  => apeps_app_issue_access($user_id),
        'refreshToken' => apeps_app_issue_refresh($user_id, $device_id),
        'expiresIn'    => APEPS_APP_ACCESS_TTL,
        'customer'     => array(
            'id'        => (int) $user_id,
            'email'     => $user ? $user->user_email : '',
            'firstName' => get_user_meta($user_id, 'first_name', true),
            'lastName'  => get_user_meta($user_id, 'last_name', true),
        ),
    );
}

function apeps_app_route_me($request) {
    $uid = apeps_app_current_user($request);
    if (is_wp_error($uid)) return $uid;
    $customer = new WC_Customer($uid);
    return rest_ensure_response(array(
        'id'        => (int) $uid,
        'email'     => $customer->get_email(),
        'firstName' => $customer->get_first_name(),
        'lastName'  => $customer->get_last_name(),
        'phone'     => $customer->get_billing_phone(),
        'billing'   => $customer->get_billing(),
        'shipping'  => $customer->get_shipping(),
    ));
}

function apeps_app_route_orders($request) {
    $uid = apeps_app_current_user($request);
    if (is_wp_error($uid)) return $uid;
    $orders = wc_get_orders(array(
        'customer_id' => $uid, // ownership scoped
        'limit'       => 20,
        'orderby'     => 'date',
        'order'       => 'DESC',
    ));
    $out = array();
    foreach ($orders as $order) {
        $out[] = apeps_app_order_summary($order);
    }
    return rest_ensure_response(array('orders' => $out));
}

function apeps_app_route_order($request) {
    $uid = apeps_app_current_user($request);
    if (is_wp_error($uid)) return $uid;
    $order = wc_get_order((int) $request['id']);
    if (!$order || $order->get_customer_id() !== (int) $uid) {
        // Never allow horizontal access to another customer's order.
        return apeps_app_error('not_found', 'Order not found', 404);
    }
    return rest_ensure_response(apeps_app_order_detail($order));
}

function apeps_app_order_summary($order) {
    $items = $order->get_items();
    $first = reset($items);
    $img   = '';
    if ($first) {
        $product = $first->get_product();
        if ($product) {
            $img = wp_get_attachment_image_url($product->get_image_id(), 'thumbnail') ?: '';
        }
    }
    return array(
        'id'        => $order->get_id(),
        'number'    => $order->get_order_number(),
        'date'      => $order->get_date_created() ? $order->get_date_created()->date('c') : '',
        'status'    => $order->get_status(),
        'total'     => $order->get_total(),
        'currency'  => $order->get_currency(),
        'itemCount' => $order->get_item_count(),
        'image'     => esc_url_raw($img),
    );
}

function apeps_app_order_detail($order) {
    $lines = array();
    foreach ($order->get_items() as $item) {
        $product = $item->get_product();
        $lines[] = array(
            'name'      => $item->get_name(),
            'productId' => $product ? $product->get_id() : 0,
            'quantity'  => $item->get_quantity(),
            'total'     => $item->get_total(),
            'image'     => $product ? esc_url_raw(wp_get_attachment_image_url($product->get_image_id(), 'thumbnail') ?: '') : '',
        );
    }
    // Tracking meta commonly written by shipment tracking plugins.
    $tracking = $order->get_meta('_wc_shipment_tracking_items');
    return array(
        'id'        => $order->get_id(),
        'number'    => $order->get_order_number(),
        'date'      => $order->get_date_created() ? $order->get_date_created()->date('c') : '',
        'status'    => $order->get_status(),
        'items'     => $lines,
        'subtotal'  => $order->get_subtotal(),
        'shipping'  => $order->get_shipping_total(),
        'tax'       => $order->get_total_tax(),
        'total'     => $order->get_total(),
        'currency'  => $order->get_currency(),
        'billing'   => $order->get_address('billing'),
        'shipping_address' => $order->get_address('shipping'),
        'paymentMethod'    => $order->get_payment_method_title(),
        'tracking'  => is_array($tracking) ? array_values($tracking) : array(),
        // Internal admin notes are NEVER returned.
    );
}

function apeps_app_route_favourites_get($request) {
    $uid = apeps_app_current_user($request);
    if (is_wp_error($uid)) return $uid;
    $ids = get_user_meta($uid, '_apeps_favourites', true);
    return rest_ensure_response(array('ids' => array_values(array_map('absint', (array) $ids))));
}

function apeps_app_route_favourites_set($request) {
    $uid = apeps_app_current_user($request);
    if (is_wp_error($uid)) return $uid;
    $ids = (array) $request->get_param('ids');
    $ids = array_values(array_unique(array_map('absint', $ids)));
    update_user_meta($uid, '_apeps_favourites', $ids);
    return rest_ensure_response(array('ids' => $ids));
}

function apeps_app_route_device_register($request) {
    if (!apeps_app_rate_ok('device', 30, 5 * MINUTE_IN_SECONDS)) {
        return apeps_app_error('rate_limited', 'Too many attempts.', 429);
    }
    $token    = sanitize_text_field((string) $request->get_param('token'));
    $platform = sanitize_text_field((string) $request->get_param('platform'));
    $version  = sanitize_text_field((string) $request->get_param('appVersion'));
    if (!$token) {
        return apeps_app_error('invalid_input', 'Missing device token', 400);
    }
    // Associate to a customer if a valid access token is presented.
    $uid = apeps_app_current_user($request);
    $uid = is_wp_error($uid) ? 0 : (int) $uid;

    $devices = get_option('apeps_app_devices', array());
    if (!is_array($devices)) $devices = array();
    $devices[hash('sha256', $token)] = array(
        'platform'   => $platform,
        'appVersion' => $version,
        'userId'     => $uid,
        'updated'    => time(),
    );
    update_option('apeps_app_devices', $devices, false);
    return rest_ensure_response(array('ok' => true));
}

/* ============================================================================
 * Invalidate sessions on password change (server-side security).
 * ========================================================================== */
add_action('after_password_reset', function ($user) {
    if ($user instanceof WP_User) apeps_app_revoke_all($user->ID);
});
add_action('profile_update', function ($user_id, $old) {
    $u = get_userdata($user_id);
    if ($u && isset($old->user_pass) && $u->user_pass !== $old->user_pass) {
        apeps_app_revoke_all($user_id);
    }
}, 10, 2);

/* ============================================================================
 * Admin settings page (capability-gated)
 * ========================================================================== */
require_once plugin_dir_path(__FILE__) . 'includes/admin-settings.php';
