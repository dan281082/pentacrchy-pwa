<?php
/**
 * Apeps App Connector — Shared REST helpers.
 * Secrets, HMAC access tokens, rotating refresh tokens, rate limiting, CORS
 * (allow-listed for the web preview only), the authenticated-user resolver, and
 * WooCommerce session/cart helpers used by cart-claim + checkout handoff.
 */

if (!defined('ABSPATH')) {
    exit;
}

/* ── Secret ────────────────────────────────────────────────────────────── */
function apeps_app_secret() {
    // Define in wp-config.php:  define('APEPS_APP_JWT_SECRET', '<64+ random chars>');
    if (defined('APEPS_APP_JWT_SECRET') && strlen(APEPS_APP_JWT_SECRET) >= 32) {
        return APEPS_APP_JWT_SECRET;
    }
    // Fallback: per-site auto-generated secret stored as a non-autoloaded option.
    $secret = get_option('apeps_app_jwt_secret');
    if (!$secret) {
        $secret = wp_generate_password(64, true, true);
        add_option('apeps_app_jwt_secret', $secret, '', false);
    }
    return $secret;
}

/* ── Base64URL ─────────────────────────────────────────────────────────── */
function apeps_app_b64url($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}
function apeps_app_b64url_decode($data) {
    return base64_decode(strtr($data, '-_', '+/'));
}

/* ── Access token (compact HMAC-signed) ────────────────────────────────── */
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

/* ── Refresh tokens (rotating, hashed, revocable) ──────────────────────── */
function apeps_app_issue_refresh($user_id, $device_id = '') {
    $raw    = wp_generate_password(64, false, false);
    $hash   = hash('sha256', $raw);
    $tokens = get_user_meta($user_id, '_apeps_refresh_tokens', true);
    if (!is_array($tokens)) $tokens = array();
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
    $hash = hash('sha256', (string) $raw);
    // NOTE: iterates users holding refresh tokens. For large stores add a
    // dedicated lookup table. Kept simple for staging validation.
    foreach (get_users(array('meta_key' => '_apeps_refresh_tokens', 'fields' => 'ID')) as $uid) {
        $tokens = get_user_meta($uid, '_apeps_refresh_tokens', true);
        if (is_array($tokens) && isset($tokens[$hash])) {
            $expired = $tokens[$hash]['exp'] < time();
            unset($tokens[$hash]); // rotate / drop
            update_user_meta($uid, '_apeps_refresh_tokens', $tokens);
            if ($expired) {
                return new WP_Error('expired_token', 'Session expired', array('status' => 401));
            }
            return (int) $uid;
        }
    }
    return new WP_Error('invalid_token', 'Invalid session', array('status' => 401));
}

function apeps_app_revoke_all($user_id) {
    delete_user_meta($user_id, '_apeps_refresh_tokens');
}

/* ── Rate limiting ─────────────────────────────────────────────────────── */
function apeps_app_rate_ok($bucket, $limit, $window) {
    $ip  = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : '0';
    $key = 'apeps_rl_' . md5($bucket . '|' . $ip);
    $hits = (int) get_transient($key);
    if ($hits >= $limit) return false;
    set_transient($key, $hits + 1, $window);
    return true;
}

/* ── Responses / auth resolver ─────────────────────────────────────────── */
function apeps_app_error($code, $message, $status) {
    return new WP_Error($code, $message, array('status' => $status));
}

/** Resolve the authenticated user id for a request or return WP_Error. */
function apeps_app_current_user($request) {
    $auth = $request->get_header('authorization');
    if (!$auth || stripos($auth, 'Bearer ') !== 0) {
        return apeps_app_error('no_auth', 'Authentication required', 401);
    }
    $token = trim(substr($auth, 7));
    return apeps_app_verify_access($token);
}

/** Alias kept for readability in modules. */
function apeps_app_require_user($request) {
    return apeps_app_current_user($request);
}

/* ── WooCommerce Store-API Cart-Token / session helpers ────────────────── */

/**
 * Extract the WooCommerce session key encoded in a Store API Cart-Token (JWT).
 * The Store API Cart-Token payload carries `user_id` = the session customer key.
 */
function apeps_app_session_key_from_cart_token($token) {
    if (!is_string($token)) return '';
    $parts = explode('.', $token);
    if (count($parts) < 2) return '';
    $payload = json_decode(apeps_app_b64url_decode($parts[1]), true);
    if (is_array($payload) && !empty($payload['user_id'])) {
        return (string) $payload['user_id'];
    }
    return '';
}

/**
 * Load the raw cart array for a given WooCommerce session key (guest or user).
 * Uses the public WC_Session_Handler API only — no raw SQL on woocommerce_sessions.
 * Returns array of cart items (may be empty).
 */
function apeps_app_load_session_cart($session_key) {
    if (!$session_key || !class_exists('WC_Session_Handler')) return array();
    $handler = new WC_Session_Handler();
    if (!method_exists($handler, 'get_session')) return array();
    $data = $handler->get_session((string) $session_key, array());
    if (empty($data) || empty($data['cart'])) return array();
    $cart = maybe_unserialize($data['cart']);
    return is_array($cart) ? $cart : array();
}

/* ── CORS (allow-listed — web preview only; native RN is not subject to CORS) ─
 * Production should keep the allow-list empty. Configure origins in the
 * `apeps_app_cors_origins` option (array of exact origins). */
add_action('rest_api_init', function () {
    add_filter('rest_pre_serve_request', function ($served) {
        $origin  = get_http_origin();
        $allowed = (array) get_option('apeps_app_cors_origins', array());
        if ($origin && in_array($origin, $allowed, true)) {
            header('Access-Control-Allow-Origin: ' . esc_url_raw($origin));
            header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
            header('Access-Control-Allow-Headers: Authorization, Content-Type, Cart-Token, Nonce, X-WC-Store-API-Nonce');
            header('Access-Control-Expose-Headers: Cart-Token, Nonce');
            header('Vary: Origin');
        }
        return $served;
    });
}, 15);
