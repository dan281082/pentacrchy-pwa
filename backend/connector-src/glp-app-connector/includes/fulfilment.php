<?php
/**
 * GLP App Connector — v2.1.0 fulfilment module (Pentarchy storefront).
 *
 * Customer-supplied postage labels + staff fulfilment. Additive only: it does not
 * touch authentication, catalogue, stock validation or the crypto gateway.
 *
 * SECURITY
 * - Dedicated role `glp_fulfilment` with capability `glp_fulfil_orders` (also
 *   granted to administrators). Fulfilment-only users cannot use wp-admin.
 * - Every staff endpoint re-checks `glp_fulfil_orders` server-side.
 * - Customer endpoints are owner-scoped (order customer === token user).
 * - Label files are NOT in the Media Library: stored under random names in a
 *   private directory (outside the web root when possible, otherwise a
 *   deny-all directory inside uploads) and only streamed via authenticated
 *   endpoints / an admin-only nonce-protected download.
 * - Files validated by size (<= 5 MB) and by content signature (PDF/JPEG/PNG).
 * - WooCommerce order meta is the source of truth for label + fulfilment state.
 */

if (!defined('ABSPATH')) { exit; }

define('GLP_FULFIL_CAP', 'glp_fulfil_orders');
define('GLP_FULFIL_ROLE', 'glp_fulfilment');
define('GLP_LABEL_META', '_glp_postage_label');
define('GLP_FULFIL_STATE_META', '_glp_fulfil_state');   // '' | ready | dispatched
define('GLP_FULFIL_LOG_META', '_glp_fulfil_log');
define('GLP_LABEL_MAX_BYTES', 5 * 1024 * 1024);
define('GLP_APP_SHIPPING_RATE_ID', 'glp_customer_label');
define('GLP_FULFIL_SCHEMA', '2.1.0');

/* ------------------------------------------------------------------ */
/* Roles / capability                                                   */
/* ------------------------------------------------------------------ */

add_action('init', function () {
    if (get_option('glp_fulfil_schema') === GLP_FULFIL_SCHEMA) { return; }
    if (!get_role(GLP_FULFIL_ROLE)) {
        add_role(GLP_FULFIL_ROLE, 'GLP Fulfilment (Pentarchy staff)', array('read' => true, GLP_FULFIL_CAP => true));
    } else {
        get_role(GLP_FULFIL_ROLE)->add_cap(GLP_FULFIL_CAP);
    }
    $admin = get_role('administrator');
    if ($admin) { $admin->add_cap(GLP_FULFIL_CAP); }
    update_option('glp_fulfil_schema', GLP_FULFIL_SCHEMA);
});

function glp_can_fulfil($user_id) {
    return $user_id && user_can((int) $user_id, GLP_FULFIL_CAP);
}

// Staff accounts are app members too (so they can sign in to the app).
function glp_fulfil_mark_staff_approved($user_id, $role) {
    if ($role === GLP_FULFIL_ROLE) { update_user_meta($user_id, GLP_APP_APPROVED_META, 'yes'); }
}
add_action('set_user_role', 'glp_fulfil_mark_staff_approved', 10, 2);
add_action('add_user_role', 'glp_fulfil_mark_staff_approved', 10, 2);

function glp_is_fulfilment_only($user_id) {
    return glp_can_fulfil($user_id) && !user_can((int) $user_id, 'manage_woocommerce') && !user_can((int) $user_id, 'edit_posts');
}

// Fulfilment-only staff never use wp-admin.
add_action('admin_init', function () {
    if (wp_doing_ajax() || (defined('DOING_CRON') && DOING_CRON)) { return; }
    if (glp_is_fulfilment_only(get_current_user_id())) {
        wp_safe_redirect(home_url('/'));
        exit;
    }
});
add_filter('show_admin_bar', function ($show) {
    return glp_is_fulfilment_only(get_current_user_id()) ? false : $show;
});

/* ------------------------------------------------------------------ */
/* App shipping: £0 customer-supplied label (app orders only)          */
/* ------------------------------------------------------------------ */

add_filter('glp_shipping_rates', function ($rates, $package) {
    if (!class_exists('WC_Shipping_Rate')) { return $rates; }
    $rate = new WC_Shipping_Rate(GLP_APP_SHIPPING_RATE_ID, 'Customer-supplied postage label', 0, array(), GLP_APP_SHIPPING_RATE_ID);
    return array(array(
        'id'    => GLP_APP_SHIPPING_RATE_ID,
        'label' => 'Customer-supplied postage label',
        'cost'  => 0.0,
        'rate'  => $rate,
    ));
}, 10, 2);

/* ------------------------------------------------------------------ */
/* Private storage                                                      */
/* ------------------------------------------------------------------ */

function glp_label_dir() {
    if (defined('GLP_LABEL_DIR') && GLP_LABEL_DIR) {
        $dir = rtrim(GLP_LABEL_DIR, '/\\');
    } else {
        $outside = dirname(rtrim(ABSPATH, '/\\')) . '/glp-private-labels';
        $dir = (is_dir($outside) || @wp_mkdir_p($outside)) && is_writable($outside)
            ? $outside
            : rtrim(wp_upload_dir()['basedir'], '/\\') . '/glp-labels';
    }
    if (!is_dir($dir)) { wp_mkdir_p($dir); }
    if (!file_exists($dir . '/.htaccess')) {
        @file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
    }
    if (!file_exists($dir . '/index.php')) {
        @file_put_contents($dir . '/index.php', "<?php // Silence.\n");
    }
    return $dir;
}

function glp_detect_label_mime($bytes) {
    if (strncmp($bytes, '%PDF-', 5) === 0) { return 'application/pdf'; }
    if (strncmp($bytes, "\x89PNG\r\n\x1a\n", 8) === 0) { return 'image/png'; }
    if (strncmp($bytes, "\xFF\xD8\xFF", 3) === 0) { return 'image/jpeg'; }
    return '';
}

function glp_label_meta($order) {
    $m = $order->get_meta(GLP_LABEL_META, true);
    return is_array($m) && !empty($m['file']) ? $m : null;
}

function glp_label_path($meta) {
    $file = basename((string) $meta['file']); // never trust stored paths
    return glp_label_dir() . '/' . $file;
}

/* ------------------------------------------------------------------ */
/* Fulfilment state                                                     */
/* ------------------------------------------------------------------ */

function glp_is_app_order($order) {
    return (string) $order->get_meta('_glp_client_ref', true) !== '';
}

function glp_fulfil_state($order) {
    $s = (string) $order->get_meta(GLP_FULFIL_STATE_META, true);
    if ($s === 'dispatched') { return 'dispatched'; }
    if ($s === 'ready') { return 'ready'; }
    return glp_label_meta($order) ? 'label_supplied' : 'awaiting_label';
}

function glp_fulfil_state_label($state) {
    $labels = array(
        'awaiting_label' => 'Awaiting label',
        'label_supplied' => 'Label supplied',
        'ready'          => 'Ready to dispatch',
        'dispatched'     => 'Dispatched',
    );
    return isset($labels[$state]) ? $labels[$state] : $state;
}

function glp_label_can_replace($order) {
    return $order->get_status() === 'processing' && glp_fulfil_state($order) !== 'dispatched';
}

function glp_fulfil_log($order, $event, $uid) {
    $log = $order->get_meta(GLP_FULFIL_LOG_META, true);
    if (!is_array($log)) { $log = array(); }
    $u = get_user_by('id', (int) $uid);
    $log[] = array('event' => $event, 'by' => $u ? $u->display_name : '', 'by_id' => (int) $uid, 'at' => gmdate('c'));
    $order->update_meta_data(GLP_FULFIL_LOG_META, $log);
}

function glp_public_label($order) {
    $m = glp_label_meta($order);
    return $m ? array(
        'kind'        => $m['kind'],
        'mime'        => $m['mime'],
        'filename'    => $m['name'],
        'size'        => (int) $m['size'],
        'uploaded_at' => $m['uploaded_at'],
    ) : null;
}

function glp_public_fulfilment($order) {
    $state = glp_fulfil_state($order);
    return array(
        'state'          => $state,
        'state_label'    => glp_fulfil_state_label($state),
        'label'          => glp_public_label($order),
        'can_upload'     => glp_label_can_replace($order),
        'dispatched_at'  => (string) $order->get_meta('_glp_dispatched_at', true) ?: null,
    );
}

// Customer order payloads (list + detail) gain the fulfilment block.
add_filter('glp_map_order', function ($out, $order, $detail) {
    if (glp_is_app_order($order)) {
        $out['fulfilment'] = glp_public_fulfilment($order);
    }
    return $out;
}, 10, 3);

// Never let a page cache store ANY glp/v1 response (incl. errors): per-user data.
add_filter('rest_post_dispatch', function ($response, $server, $request) {
    if (strpos((string) $request->get_route(), '/glp/v1/') === 0 && $response instanceof WP_REST_Response) {
        $response->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
        $response->header('X-Cache-Enabled', 'False');
    }
    return $response;
}, 10, 3);

/* ------------------------------------------------------------------ */
/* REST routes                                                          */
/* ------------------------------------------------------------------ */

add_action('rest_api_init', function () {
    $ns = 'glp/v1';
    $gate = 'glp_require_app_secret';
    register_rest_route($ns, '/orders/(?P<id>\d+)/label', array(
        array('methods' => 'GET', 'permission_callback' => $gate, 'callback' => 'glp_rest_customer_label_get'),
        array('methods' => 'POST', 'permission_callback' => $gate, 'callback' => 'glp_rest_customer_label_upload'),
    ));
    register_rest_route($ns, '/fulfilment/orders', array(
        'methods' => 'GET', 'permission_callback' => $gate, 'callback' => 'glp_rest_fulfil_list',
    ));
    register_rest_route($ns, '/fulfilment/orders/(?P<id>\d+)', array(
        'methods' => 'GET', 'permission_callback' => $gate, 'callback' => 'glp_rest_fulfil_detail',
    ));
    register_rest_route($ns, '/fulfilment/orders/(?P<id>\d+)/label', array(
        'methods' => 'GET', 'permission_callback' => $gate, 'callback' => 'glp_rest_fulfil_label',
    ));
    register_rest_route($ns, '/fulfilment/orders/(?P<id>\d+)/ready', array(
        'methods' => 'POST', 'permission_callback' => $gate, 'callback' => 'glp_rest_fulfil_ready',
    ));
    register_rest_route($ns, '/fulfilment/orders/(?P<id>\d+)/dispatch', array(
        'methods' => 'POST', 'permission_callback' => $gate, 'callback' => 'glp_rest_fulfil_dispatch',
    ));
});

function glp_owned_app_order_or_error(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    $guard = glp_guard_approved($uid);
    if (is_wp_error($guard)) { return $guard; }
    $order = wc_get_order((int) $req['id']);
    // Same 404 for "missing" and "not yours" — never reveal other orders.
    if (!$order || (int) $order->get_customer_id() !== (int) $uid || !glp_is_app_order($order)) {
        return new WP_Error('glp_not_found', 'Order not found', array('status' => 404));
    }
    return array($uid, $order);
}

function glp_staff_or_error(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    if (!glp_can_fulfil($uid)) {
        return new WP_Error('glp_forbidden', 'Fulfilment access required', array('status' => 403));
    }
    return $uid;
}

function glp_staff_order_or_error(WP_REST_Request $req) {
    $uid = glp_staff_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    $order = wc_get_order((int) $req['id']);
    if (!$order || !glp_is_app_order($order) || !in_array($order->get_status(), array('processing', 'completed'), true)) {
        return new WP_Error('glp_not_found', 'Order not found', array('status' => 404));
    }
    return array($uid, $order);
}

function glp_label_file_response($order) {
    $m = glp_label_meta($order);
    if (!$m) { return new WP_Error('glp_no_label', 'No label uploaded', array('status' => 404)); }
    $path = glp_label_path($m);
    if (!is_readable($path)) { return new WP_Error('glp_label_missing', 'Label file missing', array('status' => 410)); }
    $label = glp_public_label($order);
    $label['data'] = base64_encode(file_get_contents($path));
    return glp_nocache_response(array('label' => $label));
}

// GET /orders/{id}/label : owner-only file read.
function glp_rest_customer_label_get(WP_REST_Request $req) {
    $r = glp_owned_app_order_or_error($req);
    if (is_wp_error($r)) { return $r; }
    return glp_label_file_response($r[1]);
}

// POST /orders/{id}/label {kind: label|qr, filename, data(base64)} : owner-only.
function glp_rest_customer_label_upload(WP_REST_Request $req) {
    $r = glp_owned_app_order_or_error($req);
    if (is_wp_error($r)) { return $r; }
    list($uid, $order) = $r;

    if (!glp_label_can_replace($order)) {
        $code = glp_fulfil_state($order) === 'dispatched' ? 'label_locked' : 'label_not_open';
        $msg  = $code === 'label_locked'
            ? 'This order has been dispatched — the label can no longer be changed.'
            : 'A label can be provided once payment is confirmed and the order is Processing.';
        return new WP_REST_Response(array('error' => $code, 'message' => $msg), 409);
    }
    $kind = (string) $req->get_param('kind') === 'qr' ? 'qr' : 'label';
    $b64  = (string) $req->get_param('data');
    if (strpos($b64, 'base64,') !== false) { $b64 = substr($b64, strpos($b64, 'base64,') + 7); }
    if ($b64 === '' || strlen($b64) > (int) ceil(GLP_LABEL_MAX_BYTES * 4 / 3) + 16) {
        return new WP_REST_Response(array('error' => 'file_too_large', 'message' => 'Files must be 5 MB or smaller.'), 413);
    }
    $bytes = base64_decode($b64, true);
    if ($bytes === false || $bytes === '') {
        return new WP_REST_Response(array('error' => 'invalid_file', 'message' => 'The file could not be read.'), 400);
    }
    if (strlen($bytes) > GLP_LABEL_MAX_BYTES) {
        return new WP_REST_Response(array('error' => 'file_too_large', 'message' => 'Files must be 5 MB or smaller.'), 413);
    }
    $mime = glp_detect_label_mime($bytes);
    if ($mime === '' || ($kind === 'qr' && $mime === 'application/pdf')) {
        $msg = $kind === 'qr' ? 'QR codes must be a JPG or PNG image.' : 'Labels must be a PDF, JPG or PNG file.';
        return new WP_REST_Response(array('error' => 'invalid_type', 'message' => $msg), 415);
    }
    if ($mime !== 'application/pdf' && !@getimagesizefromstring($bytes)) {
        return new WP_REST_Response(array('error' => 'invalid_file', 'message' => 'The image could not be read.'), 400);
    }

    $ext  = $mime === 'application/pdf' ? 'pdf' : ($mime === 'image/png' ? 'png' : 'jpg');
    $file = 'o' . $order->get_id() . '-' . bin2hex(random_bytes(16)) . '.' . $ext;
    $dir  = glp_label_dir();
    if (@file_put_contents($dir . '/' . $file, $bytes) === false) {
        return new WP_Error('glp_store_failed', 'Could not store the file', array('status' => 500));
    }
    @chmod($dir . '/' . $file, 0640);

    $old = glp_label_meta($order);
    $was_ready = glp_fulfil_state($order) === 'ready';
    $name = sanitize_file_name((string) $req->get_param('filename'));
    $order->update_meta_data(GLP_LABEL_META, array(
        'file' => $file, 'mime' => $mime, 'kind' => $kind, 'size' => strlen($bytes),
        'name' => $name !== '' ? $name : ('postage-' . $kind . '.' . $ext),
        'uploaded_at' => gmdate('c'), 'uploaded_by' => (int) $uid,
    ));
    if ($was_ready) { $order->delete_meta_data(GLP_FULFIL_STATE_META); } // staff must re-check a replaced label
    glp_fulfil_log($order, $old ? 'label_replaced' : 'label_uploaded', $uid);
    $order->add_order_note(sprintf(
        'Pentarchy app: customer %s a postage %s (%s).',
        $old ? 'replaced' : 'uploaded',
        $kind === 'qr' ? 'QR code' : 'label',
        strtoupper($ext)
    ) . ($was_ready ? ' Order moved back from "Ready to dispatch" for re-check.' : ''));
    $order->save();
    if ($old && $old['file'] !== $file) { @unlink(glp_label_path($old)); }

    return array('order' => glp_map_order($order, true));
}

/* ---- staff ---------------------------------------------------------- */

function glp_fulfil_summary($order) {
    $state = glp_fulfil_state($order);
    $label = glp_public_label($order);
    return array(
        'id'           => (string) $order->get_id(),
        'number'       => (string) $order->get_order_number(),
        'status'       => $order->get_status(),
        'state'        => $state,
        'state_label'  => glp_fulfil_state_label($state),
        'date_created' => $order->get_date_created() ? $order->get_date_created()->date('c') : null,
        'date_paid'    => $order->get_date_paid() ? $order->get_date_paid()->date('c') : null,
        'customer_name'=> trim($order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name()) ?: trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name()),
        'item_count'   => (int) $order->get_item_count(),
        'total_display'=> wp_strip_all_tags(wc_price($order->get_total(), array('currency' => $order->get_currency()))),
        'label_kind'   => $label ? $label['kind'] : null,
    );
}

// GET /fulfilment/orders?state=all|awaiting_label|label_supplied|ready|dispatched
function glp_rest_fulfil_list(WP_REST_Request $req) {
    $uid = glp_staff_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    $want = sanitize_key((string) $req->get_param('state'));
    $orders = wc_get_orders(array(
        'status'       => array('processing', 'completed'),
        'limit'        => 150,
        'orderby'      => 'date',
        'order'        => 'DESC',
        'meta_key'     => '_glp_client_ref',
        'meta_compare' => 'EXISTS',
    ));
    $out = array();
    $counts = array('awaiting_label' => 0, 'label_supplied' => 0, 'ready' => 0, 'dispatched' => 0);
    foreach ($orders as $order) {
        $state = glp_fulfil_state($order);
        // Completed orders are only fulfilment-relevant if dispatched via this flow.
        if ($order->get_status() === 'completed' && $state !== 'dispatched') { continue; }
        $counts[$state]++;
        if ($want && $want !== 'all' && $want !== $state) { continue; }
        $out[] = glp_fulfil_summary($order);
    }
    return glp_nocache_response(array('orders' => $out, 'counts' => $counts));
}

function glp_rest_fulfil_detail(WP_REST_Request $req) {
    $r = glp_staff_order_or_error($req);
    if (is_wp_error($r)) { return $r; }
    $order = $r[1];
    $cust  = get_user_by('id', (int) $order->get_customer_id());
    $items = array();
    foreach ($order->get_items() as $it) {
        $attrs = array();
        foreach ($it->get_meta_data() as $m) {
            $d = $m->get_data();
            $key = isset($d['key']) ? (string) $d['key'] : '';
            if ($key === '' || $key[0] === '_') { continue; }
            $attrs[wc_attribute_label($key)] = is_scalar($d['value']) ? (string) $d['value'] : '';
        }
        $p = $it->get_product();
        $items[] = array(
            'name' => $it->get_name(), 'qty' => (int) $it->get_quantity(),
            'sku' => $p ? $p->get_sku() : '', 'attributes' => $attrs,
        );
    }
    $log = $order->get_meta(GLP_FULFIL_LOG_META, true);
    $out = glp_fulfil_summary($order);
    $out['items'] = $items;
    $out['customer'] = array(
        'name'     => $out['customer_name'],
        'email'    => $order->get_billing_email(),
        'phone'    => $order->get_shipping_phone() ?: $order->get_billing_phone(),
        'telegram' => $cust ? (string) get_user_meta($cust->ID, GLP_TELEGRAM_META, true) : '',
    );
    $out['shipping_address'] = array(
        'name'     => trim($order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name()),
        'line1'    => $order->get_shipping_address_1(),
        'line2'    => $order->get_shipping_address_2(),
        'city'     => $order->get_shipping_city(),
        'postcode' => $order->get_shipping_postcode(),
        'country'  => $order->get_shipping_country(),
    );
    $out['customer_note'] = $order->get_customer_note();
    $out['label'] = glp_public_label($order);
    $out['dispatched_at'] = (string) $order->get_meta('_glp_dispatched_at', true) ?: null;
    $out['log'] = is_array($log) ? $log : array();
    return glp_nocache_response(array('order' => $out));
}

function glp_rest_fulfil_label(WP_REST_Request $req) {
    $r = glp_staff_order_or_error($req);
    if (is_wp_error($r)) { return $r; }
    return glp_label_file_response($r[1]);
}

function glp_rest_fulfil_ready(WP_REST_Request $req) {
    $r = glp_staff_order_or_error($req);
    if (is_wp_error($r)) { return $r; }
    list($uid, $order) = $r;
    $state = glp_fulfil_state($order);
    if ($state !== 'label_supplied') {
        return new WP_REST_Response(array('error' => 'invalid_state', 'message' => 'Only orders with a supplied label can be marked ready.'), 409);
    }
    $order->update_meta_data(GLP_FULFIL_STATE_META, 'ready');
    glp_fulfil_log($order, 'ready', $uid);
    $u = get_user_by('id', $uid);
    $order->add_order_note('Pentarchy fulfilment: marked Ready to dispatch by ' . ($u ? $u->display_name : 'staff') . '.');
    $order->save();
    return glp_rest_fulfil_detail($req);
}

function glp_fulfil_dispatch_order($order, $uid, $via) {
    $order->update_meta_data(GLP_FULFIL_STATE_META, 'dispatched');
    $order->update_meta_data('_glp_dispatched_at', gmdate('c'));
    $order->update_meta_data('_glp_dispatched_by', (int) $uid);
    glp_fulfil_log($order, 'dispatched', $uid);
    $u = get_user_by('id', $uid);
    $order->save();
    $order->update_status('completed', 'Pentarchy fulfilment: dispatched with customer-supplied postage by ' . ($u ? $u->display_name : 'staff') . ' (' . $via . '). Label locked.');
}

function glp_rest_fulfil_dispatch(WP_REST_Request $req) {
    $r = glp_staff_order_or_error($req);
    if (is_wp_error($r)) { return $r; }
    list($uid, $order) = $r;
    $state = glp_fulfil_state($order);
    if ($order->get_status() !== 'processing' || !in_array($state, array('label_supplied', 'ready'), true)) {
        return new WP_REST_Response(array('error' => 'invalid_state', 'message' => 'Only Processing orders with a supplied label can be dispatched.'), 409);
    }
    glp_fulfil_dispatch_order($order, $uid, 'app');
    return glp_rest_fulfil_detail($req);
}

/* ------------------------------------------------------------------ */
/* WooCommerce admin fallback (order edit screen)                       */
/* ------------------------------------------------------------------ */

add_action('add_meta_boxes', function () {
    $screens = array('shop_order');
    if (function_exists('wc_get_page_screen_id')) { $screens[] = wc_get_page_screen_id('shop-order'); }
    foreach (array_unique($screens) as $screen) {
        add_meta_box('glp_postage_label', 'Customer Postage Label (Pentarchy)', 'glp_admin_label_box', $screen, 'side', 'high');
    }
});

function glp_admin_label_box($post_or_order) {
    $order = $post_or_order instanceof WC_Order ? $post_or_order : wc_get_order($post_or_order->ID);
    if (!$order || !glp_is_app_order($order)) { echo '<p>Not a Pentarchy app order.</p>'; return; }
    if (!current_user_can(GLP_FULFIL_CAP)) { echo '<p>Fulfilment permission required.</p>'; return; }
    $state = glp_fulfil_state($order);
    $label = glp_public_label($order);
    echo '<p><strong>Status:</strong> ' . esc_html(glp_fulfil_state_label($state)) . '</p>';
    if (!$label) { echo '<p>No label uploaded yet.</p>'; return; }
    $url = wp_nonce_url(admin_url('admin-post.php?action=glp_label_download&order_id=' . $order->get_id()), 'glp_label_' . $order->get_id());
    echo '<p>' . esc_html($label['kind'] === 'qr' ? 'Postage QR code' : 'Postage label') . ' · ' . esc_html(strtoupper(substr($label['mime'], strpos($label['mime'], '/') + 1))) . ' · ' . esc_html(size_format($label['size'])) . '</p>';
    echo '<p><a class="button" target="_blank" rel="noopener" href="' . esc_url($url) . '">View / download</a></p>';
    if ($order->get_status() === 'processing' && $state !== 'dispatched') {
        $durl = wp_nonce_url(admin_url('admin-post.php?action=glp_label_dispatch&order_id=' . $order->get_id()), 'glp_dispatch_' . $order->get_id());
        echo '<p><a class="button button-primary" href="' . esc_url($durl) . '" onclick="return confirm(\'Mark this order dispatched? The customer can no longer change the label.\')">Mark dispatched</a></p>';
    }
}

add_action('admin_post_glp_label_download', function () {
    $id = isset($_GET['order_id']) ? absint($_GET['order_id']) : 0;
    if (!$id || !current_user_can(GLP_FULFIL_CAP) || !check_admin_referer('glp_label_' . $id)) { wp_die('Forbidden', 403); }
    $order = wc_get_order($id);
    $m = $order ? glp_label_meta($order) : null;
    if (!$m || !is_readable(glp_label_path($m))) { wp_die('Label not found', 404); }
    nocache_headers();
    header('Content-Type: ' . $m['mime']);
    header('Content-Disposition: inline; filename="' . rawurlencode($m['name']) . '"');
    header('X-Content-Type-Options: nosniff');
    header('Content-Length: ' . filesize(glp_label_path($m)));
    readfile(glp_label_path($m));
    exit;
});

add_action('admin_post_glp_label_dispatch', function () {
    $id = isset($_GET['order_id']) ? absint($_GET['order_id']) : 0;
    if (!$id || !current_user_can(GLP_FULFIL_CAP) || !check_admin_referer('glp_dispatch_' . $id)) { wp_die('Forbidden', 403); }
    $order = wc_get_order($id);
    if ($order && glp_is_app_order($order) && $order->get_status() === 'processing' && glp_label_meta($order) && glp_fulfil_state($order) !== 'dispatched') {
        glp_fulfil_dispatch_order($order, get_current_user_id(), 'WooCommerce admin');
    }
    wp_safe_redirect(wp_get_referer() ?: admin_url());
    exit;
});
