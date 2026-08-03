<?php
/**
 * Apeps App Connector — Shipment tracking (read-only, allow-listed).
 * Auth: GET /me/orders/{id}/tracking.
 *
 * Reads tracking meta written by common shipment-tracking plugins (e.g.
 * "Advanced Shipment Tracking" -> `_wc_shipment_tracking_items`). Only
 * carrier / number / url / date are exposed — never invents events or dates.
 * CONFIRM THE EXACT META KEY ON STAGING and extend `apeps_app_order_tracking`
 * if your store uses a different tracking plugin.
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {
    register_rest_route(APEPS_APP_NS, '/me/orders/(?P<id>\d+)/tracking', array(
        'methods' => 'GET', 'permission_callback' => '__return_true',
        'callback' => 'apeps_app_route_tracking',
    ));
});

function apeps_app_route_tracking($request) {
    $uid = apeps_app_current_user($request);
    if (is_wp_error($uid)) return $uid;
    $order = wc_get_order((int) $request['id']);
    if (!$order || (int) $order->get_customer_id() !== (int) $uid) {
        return apeps_app_error('not_found', 'Order not found', 404);
    }
    return rest_ensure_response(array(
        'status'   => $order->get_status(),
        'tracking' => apeps_app_order_tracking($order),
    ));
}

/**
 * Return an allow-listed array of tracking entries for an order.
 * Supports the widely used `_wc_shipment_tracking_items` meta shape.
 */
function apeps_app_order_tracking($order) {
    $raw = $order->get_meta('_wc_shipment_tracking_items');
    if (!is_array($raw) || empty($raw)) {
        return array();
    }
    $out = array();
    foreach ($raw as $entry) {
        if (!is_array($entry)) continue;
        $carrier = isset($entry['tracking_provider']) ? $entry['tracking_provider']
                 : (isset($entry['custom_tracking_provider']) ? $entry['custom_tracking_provider'] : '');
        $number  = isset($entry['tracking_number']) ? $entry['tracking_number'] : '';
        $url     = '';
        if (!empty($entry['custom_tracking_link'])) {
            $url = $entry['custom_tracking_link'];
        } elseif (!empty($entry['tracking_link'])) {
            $url = $entry['tracking_link'];
        }
        $date = isset($entry['date_shipped']) && $entry['date_shipped']
            ? gmdate('c', is_numeric($entry['date_shipped']) ? (int) $entry['date_shipped'] : strtotime($entry['date_shipped']))
            : '';
        $out[] = array(
            'carrier'    => sanitize_text_field((string) $carrier),
            'number'     => sanitize_text_field((string) $number),
            'url'        => esc_url_raw((string) $url),
            'dateShipped'=> $date,
        );
    }
    return $out;
}
