<?php
/**
 * Apeps App Connector — Loyalty (read-only adapter).
 * Auth: GET /me/loyalty.
 *
 * Reads the customer's points balance from whichever ONE loyalty plugin is
 * active (WooCommerce Points and Rewards / myCred / YITH). This is a read-only
 * adapter that maps to the app's provisional loyalty contract — it NEVER writes
 * a second points ledger. CONFIRM THE ACTIVE PLUGIN ON STAGING; the option
 * `apeps_app_loyalty_provider` can force a specific provider.
 *
 * Response contract: { available, provider, points, valueLabel }
 * `available:false` cleanly disables the module in the app.
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {
    register_rest_route(APEPS_APP_NS, '/me/loyalty', array(
        'methods' => 'GET', 'permission_callback' => '__return_true',
        'callback' => 'apeps_app_route_loyalty',
    ));
});

function apeps_app_route_loyalty($request) {
    $uid = apeps_app_current_user($request);
    if (is_wp_error($uid)) return $uid;

    $provider = get_option('apeps_app_loyalty_provider', 'auto');
    $points   = null;

    // WooCommerce Points and Rewards
    if (($provider === 'auto' || $provider === 'wc_points') && class_exists('WC_Points_Rewards_Manager')
        && method_exists('WC_Points_Rewards_Manager', 'get_users_points')) {
        $points   = (int) WC_Points_Rewards_Manager::get_users_points($uid);
        $provider = 'wc_points';
    }

    // myCred
    if ($points === null && ($provider === 'auto' || $provider === 'mycred') && function_exists('mycred_get_users_balance')) {
        $points   = (int) mycred_get_users_balance($uid);
        $provider = 'mycred';
    }

    // YITH Points and Rewards
    if ($points === null && ($provider === 'auto' || $provider === 'yith') && function_exists('YITH_WC_Points_Rewards')) {
        $ywpar = YITH_WC_Points_Rewards();
        if (is_object($ywpar) && method_exists($ywpar, 'get_points_current_user')) {
            $points   = (int) $ywpar->get_points_current_user();
            $provider = 'yith';
        }
    }

    if ($points === null) {
        // No supported loyalty plugin detected — module stays disabled in-app.
        return rest_ensure_response(array(
            'available'  => false,
            'provider'   => null,
            'points'     => 0,
            'valueLabel' => '',
        ));
    }

    return rest_ensure_response(array(
        'available'  => true,
        'provider'   => $provider,
        'points'     => $points,
        'valueLabel' => sanitize_text_field(get_option('apeps_app_loyalty_value_label', '')),
    ));
}
