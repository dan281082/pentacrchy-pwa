<?php
/**
 * Apeps App Connector — Customer orders (ownership-scoped).
 * Auth: GET /me/orders, GET /me/orders/{id}.
 * A customer can ONLY read their own orders. Fields are allow-listed; admin
 * notes / payment tokens are NEVER returned.
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {
    register_rest_route(APEPS_APP_NS, '/me/orders', array(
        'methods' => 'GET', 'permission_callback' => '__return_true',
        'callback' => 'apeps_app_route_orders',
    ));
    register_rest_route(APEPS_APP_NS, '/me/orders/(?P<id>\d+)', array(
        'methods' => 'GET', 'permission_callback' => '__return_true',
        'callback' => 'apeps_app_route_order',
    ));
});

function apeps_app_route_orders($request) {
    $uid = apeps_app_current_user($request);
    if (is_wp_error($uid)) return $uid;
    if (!function_exists('wc_get_orders')) {
        return apeps_app_error('unavailable', 'Store is unavailable.', 503);
    }
    $page = max(1, (int) $request->get_param('page'));
    $orders = wc_get_orders(array(
        'customer_id' => $uid, // ownership scoped
        'limit'       => 20,
        'paged'       => $page,
        'orderby'     => 'date',
        'order'       => 'DESC',
    ));
    $out = array();
    foreach ($orders as $order) {
        $out[] = apeps_app_order_summary($order);
    }
    return rest_ensure_response(array('orders' => $out, 'page' => $page));
}

function apeps_app_route_order($request) {
    $uid = apeps_app_current_user($request);
    if (is_wp_error($uid)) return $uid;
    $order = wc_get_order((int) $request['id']);
    if (!$order || (int) $order->get_customer_id() !== (int) $uid) {
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
    return array(
        'id'               => $order->get_id(),
        'number'           => $order->get_order_number(),
        'date'             => $order->get_date_created() ? $order->get_date_created()->date('c') : '',
        'status'           => $order->get_status(),
        'items'            => $lines,
        'subtotal'         => $order->get_subtotal(),
        'shipping'         => $order->get_shipping_total(),
        'tax'              => $order->get_total_tax(),
        'total'            => $order->get_total(),
        'currency'         => $order->get_currency(),
        'billing'          => $order->get_address('billing'),
        'shipping_address' => $order->get_address('shipping'),
        'paymentMethod'    => $order->get_payment_method_title(),
        'tracking'         => apeps_app_order_tracking($order), // allow-listed (tracking.php)
        // Internal admin notes / payment tokens are NEVER returned.
    );
}
