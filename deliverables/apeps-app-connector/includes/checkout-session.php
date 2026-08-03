<?php
/**
 * Apeps App Connector — Secure website-checkout handoff.
 *
 * POST /checkout-sessions  (Bearer + Cart-Token in body)
 *   → stores a ONE-TIME code hash (≤120s), returns { url, state }. No tokens in URLs.
 *
 * GET  {site}/?apeps_checkout_handoff=1&code=...   (public, one-time)
 *   → consumes the code, logs the (already app-authenticated) customer into the
 *     browser, rebuilds their cart server-side, redirects to /checkout.
 *
 * The app opens the returned URL with WebBrowser.openAuthSessionAsync and returns
 * via the `apeps://checkout-return` deep link. Returning is NOT proof of payment —
 * the app must refresh order state from WooCommerce afterwards.
 *
 * No card data ever touches the app or this plugin — the existing website gateway
 * completes payment.
 */

if (!defined('ABSPATH')) {
    exit;
}

/* ── REST: create a checkout session (one-time code) ───────────────────── */
add_action('rest_api_init', function () {
    register_rest_route(APEPS_APP_NS, '/checkout-sessions', array(
        'methods'             => 'POST',
        'permission_callback' => '__return_true',
        'callback'            => 'apeps_app_route_checkout_session',
    ));
});

function apeps_app_route_checkout_session($request) {
    if (!apeps_app_rate_ok('checkout_session', 15, 5 * MINUTE_IN_SECONDS)) {
        return apeps_app_error('rate_limited', 'Too many attempts.', 429);
    }
    $uid = apeps_app_require_user($request);
    if (is_wp_error($uid)) return $uid;

    $cart_token = sanitize_text_field((string) $request->get_param('cartToken'));
    $state      = sanitize_text_field((string) $request->get_param('state'));
    if (!$cart_token || !$state) {
        return apeps_app_error('invalid_input', 'Missing cart token or state', 400);
    }

    // Allow-list the return URI scheme (app deep link only).
    $return_uri = esc_url_raw((string) $request->get_param('returnUri'), array('apeps'));
    if (strpos($return_uri, 'apeps://') !== 0) {
        $return_uri = 'apeps://checkout-return';
    }

    $code = wp_generate_password(48, false, false);
    $key  = 'apeps_co_' . hash('sha256', $code);
    set_transient($key, array(
        'uid'        => (int) $uid,
        'cartToken'  => $cart_token,
        'state'      => $state,
        'returnUri'  => $return_uri,
        'exp'        => time() + APEPS_APP_CHECKOUT_TTL,
    ), APEPS_APP_CHECKOUT_TTL);

    $url = add_query_arg(array(
        'apeps_checkout_handoff' => '1',
        'code'                   => rawurlencode($code),
    ), home_url('/'));

    return rest_ensure_response(array(
        'url'       => esc_url_raw($url),
        'state'     => $state,
        'expiresIn' => APEPS_APP_CHECKOUT_TTL,
    ));
}

/* ── Front-end: consume the one-time code, rebuild cart, go to checkout ── */
add_action('template_redirect', 'apeps_app_checkout_handoff', 1);

function apeps_app_checkout_handoff() {
    if (empty($_GET['apeps_checkout_handoff'])) {
        return;
    }
    $code = isset($_GET['code']) ? sanitize_text_field(wp_unslash($_GET['code'])) : '';
    if (!$code) {
        wp_safe_redirect(home_url('/'));
        exit;
    }

    $key  = 'apeps_co_' . hash('sha256', $code);
    $data = get_transient($key);
    delete_transient($key); // ONE-TIME use, regardless of validity.

    if (!is_array($data) || empty($data['uid']) || (int) $data['exp'] < time()) {
        wp_safe_redirect(wc_get_page_permalink('shop') ?: home_url('/'));
        exit;
    }

    // The customer authenticated in-app; establish their browser session.
    wp_set_current_user((int) $data['uid']);
    wp_set_auth_cookie((int) $data['uid']);

    // Rebuild the cart server-side from the guest Cart-Token session.
    if (function_exists('WC') && WC()->cart) {
        WC()->cart->empty_cart();
        $session_key = apeps_app_session_key_from_cart_token($data['cartToken']);
        $guest_cart  = apeps_app_load_session_cart($session_key);
        foreach ($guest_cart as $item) {
            if (empty($item['product_id'])) continue;
            WC()->cart->add_to_cart(
                absint($item['product_id']),
                isset($item['quantity']) ? absint($item['quantity']) : 1,
                isset($item['variation_id']) ? absint($item['variation_id']) : 0,
                isset($item['variation']) && is_array($item['variation']) ? $item['variation'] : array()
            );
        }
        WC()->cart->calculate_totals();
    }

    wp_safe_redirect(wc_get_checkout_url());
    exit;
}
