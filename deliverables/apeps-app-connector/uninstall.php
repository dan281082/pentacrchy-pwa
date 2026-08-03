<?php
/**
 * Apeps App Connector — Uninstall cleanup.
 * Runs only on plugin DELETE (not deactivate). Removes all namespaced options
 * and per-user meta this plugin created. WooCommerce/WordPress core data is
 * never touched.
 */

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// ── Options (apeps_app_*) ──────────────────────────────────────────────
$apeps_options = array(
    'apeps_app_api_enabled',
    'apeps_app_maintenance',
    'apeps_app_maintenance_msg',
    'apeps_app_latest_version',
    'apeps_app_min_version',
    'apeps_app_update_required',
    'apeps_app_apk_url',
    'apeps_app_release_notes',
    'apeps_app_support_url',
    'apeps_app_whatsapp_url',
    'apeps_app_terms_url',
    'apeps_app_privacy_url',
    'apeps_app_delivery_url',
    'apeps_app_refund_url',
    'apeps_app_banners',
    'apeps_app_featured_cats',
    'apeps_app_fcm_key_present',
    'apeps_app_fcm_server_key',
    'apeps_app_devices',
    'apeps_app_jwt_secret',
    'apeps_app_cors_origins',
    'apeps_app_loyalty_provider',
    'apeps_app_loyalty_value_label',
);
foreach ($apeps_options as $opt) {
    delete_option($opt);
}

// ── Per-user meta ──────────────────────────────────────────────────────
$apeps_user_meta = array(
    '_apeps_refresh_tokens',
    '_apeps_favourites',
    '_apeps_notif_prefs',
    '_apeps_last_claimed_cart',
);
foreach ($apeps_user_meta as $meta_key) {
    delete_metadata('user', 0, $meta_key, '', true);
}
