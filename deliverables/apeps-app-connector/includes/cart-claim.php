<?php
/**
 * Apeps App Connector — Cart claim.
 * POST /auth/cart/claim  (Bearer required)
 *
 * Associates a guest Store API Cart-Token with the now-authenticated customer.
 * The Cart-Token is sent in the request BODY (never in a URL). We read the guest
 * session cart via the public WC_Session_Handler API (no raw SQL) and return the
 * normalised line items so the app can reconcile against the authenticated cart.
 *
 * NOTE: server-side session merging behaviour varies by WooCommerce version and
 * active cart plugins — VALIDATE ON STAGING. The safe, version-independent
 * contract is: return the guest cart contents; the app re-adds them to the
 * authenticated Store API cart (idempotent add-item calls).
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {
    register_rest_route(APEPS_APP_NS, '/auth/cart/claim', array(
        'methods'             => 'POST',
        'permission_callback' => '__return_true',
        'callback'            => 'apeps_app_route_cart_claim',
    ));
});

function apeps_app_route_cart_claim($request) {
    if (!apeps_app_rate_ok('cart_claim', 20, 5 * MINUTE_IN_SECONDS)) {
        return apeps_app_error('rate_limited', 'Too many attempts.', 429);
    }
    $uid = apeps_app_require_user($request);
    if (is_wp_error($uid)) return $uid;

    $cart_token = sanitize_text_field((string) $request->get_param('cartToken'));
    if (!$cart_token) {
        return apeps_app_error('invalid_input', 'Missing cart token', 400);
    }

    $session_key = apeps_app_session_key_from_cart_token($cart_token);
    if (!$session_key) {
        return apeps_app_error('invalid_token', 'Invalid cart token', 400);
    }

    $guest_cart = apeps_app_load_session_cart($session_key);
    if (empty($guest_cart)) {
        // Nothing to claim (empty/expired guest cart) — not an error.
        return rest_ensure_response(array('ok' => true, 'merged' => false, 'items' => array()));
    }

    // Persist the association (auditable, removable on uninstall).
    update_user_meta($uid, '_apeps_last_claimed_cart', array(
        'sessionKey' => $session_key,
        'at'         => time(),
    ));

    // Normalise line items for the app to reconcile against the auth cart.
    $items = array();
    foreach ($guest_cart as $item) {
        if (empty($item['product_id'])) continue;
        $items[] = array(
            'productId'   => absint($item['product_id']),
            'variationId' => isset($item['variation_id']) ? absint($item['variation_id']) : 0,
            'quantity'    => isset($item['quantity']) ? absint($item['quantity']) : 1,
        );
    }

    return rest_ensure_response(array(
        'ok'     => true,
        'merged' => true,
        'items'  => $items,
    ));
}
