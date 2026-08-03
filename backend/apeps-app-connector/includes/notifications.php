<?php
/**
 * Apeps App Connector — Devices + notification preferences.
 * Public: POST /device/register (associates to the user if a Bearer token is present).
 * Auth:   GET|POST /me/notifications/preferences.
 *
 * The device registry stores hashed push tokens + platform + app version. The
 * Firebase SERVER key lives ONLY in the plugin (admin settings, write-only) and
 * is never returned to the app. Actual FCM sending happens server-side from
 * wc-hooks.php (transactional) — Phase 2 build step (needs google-services.json).
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {
    register_rest_route(APEPS_APP_NS, '/device/register', array(
        'methods' => 'POST', 'permission_callback' => '__return_true',
        'callback' => 'apeps_app_route_device_register',
    ));
    register_rest_route(APEPS_APP_NS, '/me/notifications/preferences', array(
        array(
            'methods' => 'GET', 'permission_callback' => '__return_true',
            'callback' => 'apeps_app_route_notif_prefs_get',
        ),
        array(
            'methods' => 'POST', 'permission_callback' => '__return_true',
            'callback' => 'apeps_app_route_notif_prefs_set',
        ),
    ));
});

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
    // Associate to a customer if a valid access token is presented (optional).
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

/** Default notification preference set. */
function apeps_app_notif_defaults() {
    return array(
        'orderUpdates'   => true,   // transactional — recommended always on
        'shipping'       => true,
        'restockAlerts'  => false,
        'marketing'      => false,  // consented marketing only
    );
}

function apeps_app_route_notif_prefs_get($request) {
    $uid = apeps_app_current_user($request);
    if (is_wp_error($uid)) return $uid;
    $prefs = get_user_meta($uid, '_apeps_notif_prefs', true);
    if (!is_array($prefs)) $prefs = array();
    return rest_ensure_response(array_merge(apeps_app_notif_defaults(), $prefs));
}

function apeps_app_route_notif_prefs_set($request) {
    $uid = apeps_app_current_user($request);
    if (is_wp_error($uid)) return $uid;
    $defaults = apeps_app_notif_defaults();
    $prefs = array();
    foreach ($defaults as $key => $_) {
        $val = $request->get_param($key);
        if ($val !== null) {
            $prefs[$key] = filter_var($val, FILTER_VALIDATE_BOOLEAN);
        }
    }
    $merged = array_merge($defaults, $prefs);
    update_user_meta($uid, '_apeps_notif_prefs', $merged);
    return rest_ensure_response($merged);
}
