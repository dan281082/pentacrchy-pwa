<?php
/**
 * Apeps App Connector — Version gate + remote config.
 * Public (no auth): GET /version, GET /config.
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {
    register_rest_route(APEPS_APP_NS, '/version', array(
        'methods'             => 'GET',
        'permission_callback' => '__return_true',
        'callback'            => 'apeps_app_route_version',
    ));
    register_rest_route(APEPS_APP_NS, '/config', array(
        'methods'             => 'GET',
        'permission_callback' => '__return_true',
        'callback'            => 'apeps_app_route_config',
    ));
});

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
