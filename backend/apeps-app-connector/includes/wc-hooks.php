<?php
/**
 * Apeps App Connector — WooCommerce hooks + session security.
 *
 * 1. Transactional push on order status change (async via WP-Cron). Sending is
 *    gated on a configured Firebase server key AND the customer's consented
 *    preferences. Idempotent, keyed by order id + status.
 * 2. Session invalidation on password reset / change (revokes all refresh tokens).
 *
 * The actual FCM HTTP call is a Phase-2 build step (needs google-services.json +
 * server key). `apeps_app_send_push` is a documented stub that no-ops safely
 * until the server key is configured — VALIDATE ON STAGING.
 */

if (!defined('ABSPATH')) {
    exit;
}

/* ── Transactional order notifications ─────────────────────────────────── */
add_action('woocommerce_order_status_changed', 'apeps_app_on_order_status', 10, 4);

function apeps_app_on_order_status($order_id, $from, $to, $order) {
    // Only meaningful customer-facing transitions.
    $notify_statuses = array('processing', 'completed', 'on-hold', 'cancelled', 'refunded');
    if (!in_array($to, $notify_statuses, true)) {
        return;
    }
    // Idempotency: don't re-notify the same order+status.
    $seen_key = '_apeps_notified_' . $to;
    if ($order && $order->get_meta($seen_key)) {
        return;
    }
    if ($order) {
        $order->update_meta_data($seen_key, time());
        $order->save_meta_data();
    }
    // Defer the send to avoid blocking the checkout/admin request.
    wp_schedule_single_event(time() + 5, 'apeps_app_dispatch_order_push', array($order_id, $to));
}

add_action('apeps_app_dispatch_order_push', 'apeps_app_dispatch_order_push_cb', 10, 2);

function apeps_app_dispatch_order_push_cb($order_id, $status) {
    if (!get_option('apeps_app_fcm_key_present')) {
        return; // No server key configured yet — safe no-op.
    }
    $order = wc_get_order($order_id);
    if (!$order) return;
    $uid = (int) $order->get_customer_id();
    if (!$uid) return;

    // Respect consented preferences.
    $prefs = get_user_meta($uid, '_apeps_notif_prefs', true);
    if (is_array($prefs) && isset($prefs['orderUpdates']) && !$prefs['orderUpdates']) {
        return;
    }

    $title = __('Order update', 'apeps-app');
    $body  = sprintf(
        /* translators: 1: order number, 2: status */
        __('Order #%1$s is now %2$s.', 'apeps-app'),
        $order->get_order_number(),
        wc_get_order_status_name($status)
    );
    apeps_app_send_push($uid, $title, $body, array(
        'type'    => 'order_update',
        'orderId' => (string) $order_id,
        'status'  => $status,
    ));
}

/**
 * Send a push to all registered devices for a user via FCM.
 * STUB: implement the FCM HTTP v1 / legacy call here once the server key +
 * google-services.json are provided. No-ops safely until then.
 */
function apeps_app_send_push($user_id, $title, $body, $data = array()) {
    $server_key = get_option('apeps_app_fcm_server_key');
    if (!$server_key) return; // not configured

    $devices = get_option('apeps_app_devices', array());
    if (!is_array($devices)) return;

    // Collect this user's device tokens (stored hashed; the raw token is needed
    // to send — in Phase 2 store a reversible reference or send via topic).
    // Left as an explicit Phase-2 integration point; do NOT log tokens/keys.
    do_action('apeps_app_before_send_push', $user_id, $title, $body, $data);
    // TODO (Phase 2): POST to https://fcm.googleapis.com/v1/projects/{id}/messages:send
}

/* ── Session invalidation on credential change ─────────────────────────── */
add_action('after_password_reset', function ($user) {
    if ($user instanceof WP_User) {
        apeps_app_revoke_all($user->ID);
    }
});

add_action('profile_update', function ($user_id, $old) {
    $u = get_userdata($user_id);
    if ($u && isset($old->user_pass) && $u->user_pass !== $old->user_pass) {
        apeps_app_revoke_all($user_id);
    }
}, 10, 2);
