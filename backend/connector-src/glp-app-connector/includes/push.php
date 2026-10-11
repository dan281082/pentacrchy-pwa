<?php
/**
 * GLP App Connector — v2.2.0 Pentarchy stock alerts (standard Web Push / VAPID).
 *
 * Two opt-in alert types per member (user meta, all devices):
 *   new_vial      — a members-only product is published / becomes available for the first time
 *   back_in_stock — an existing members-only product goes out-of-stock → available,
 *                   ONLY when a person changes it on the product (admin edit, quick/bulk
 *                   edit, variation save or WooCommerce product REST). Order stock
 *                   reductions/restores never trigger it.
 * Never fires for ordinary quantity changes, other edits, drafts or non-Pentarchy products.
 *
 * SECURITY: the VAPID private key is generated on the server and kept in a non-autoloaded
 * option. It is never returned by any endpoint. Subscriptions (endpoint + browser keys)
 * are stored in user meta, tied to the authenticated, approved member's token. Sending
 * runs in the background (Action Scheduler) and removes expired subscriptions (404/410).
 */

if (!defined('ABSPATH')) { exit; }

define('GLP_PUSH_SUBS_META', '_glp_push_subs');      // array hash => {endpoint,p256dh,auth,enc,ua,created}
define('GLP_PUSH_PREFS_META', '_glp_push_prefs');    // {new_vial:bool, back_in_stock:bool}
define('GLP_PUSH_STATUS_META', '_glp_push_last_stock_status');
define('GLP_PUSH_NEW_SENT_META', '_glp_push_new_sent');
define('GLP_PUSH_PWA_PATH', '/product/');

function glp_push_lib_loaded() {
    static $ok = null;
    if ($ok === null) {
        $auto = dirname(__DIR__) . '/vendor/autoload.php';
        $ok = is_readable($auto) && PHP_VERSION_ID >= 80100;
        if ($ok) { require_once $auto; }
    }
    return $ok;
}

function glp_push_vapid() {
    $v = get_option('glp_push_vapid');
    if (!is_array($v) || empty($v['publicKey']) || empty($v['privateKey'])) {
        if (!glp_push_lib_loaded()) { return null; }
        $v = \Minishlink\WebPush\VAPID::createVapidKeys();
        update_option('glp_push_vapid', $v, false);
    }
    return $v;
}

function glp_push_prefs($uid) {
    $p = get_user_meta($uid, GLP_PUSH_PREFS_META, true);
    return array(
        'new_vial'      => is_array($p) && !empty($p['new_vial']),
        'back_in_stock' => is_array($p) && !empty($p['back_in_stock']),
    );
}

function glp_push_is_pentarchy_product($product_id) {
    return get_post_meta((int) $product_id, GLP_PRIVATE_PRODUCT_META, true) === 'yes'
        && get_post_status((int) $product_id) === 'publish';
}

function glp_push_log($event, $pid, $data = array()) {
    if (function_exists('glp_dbg')) { glp_dbg('push_' . $event, 0, array_merge(array('product' => (int) $pid), $data)); }
}

/* ---- one-time baseline: existing products never trigger "new" ------------- */
add_action('init', function () {
    if (get_option('glp_push_baseline') === '1') { return; }
    $ids = get_posts(array('post_type' => 'product', 'post_status' => 'any', 'posts_per_page' => -1, 'fields' => 'ids',
        'meta_query' => array(array('key' => GLP_PRIVATE_PRODUCT_META, 'value' => 'yes'))));
    foreach ($ids as $id) {
        if (get_post_status($id) === 'publish') { update_post_meta($id, GLP_PUSH_NEW_SENT_META, 'baseline'); }
        $p = function_exists('wc_get_product') ? wc_get_product($id) : null;
        if ($p) { update_post_meta($id, GLP_PUSH_STATUS_META, $p->get_stock_status()); }
    }
    update_option('glp_push_baseline', '1', false);
}, 20);

/* ---- trigger 1: NEW VIAL ------------------------------------------------- */
function glp_push_queue_new_check($product_id) {
    $product_id = (int) $product_id;
    if (get_post_type($product_id) !== 'product') { return; }
    if (get_post_meta($product_id, GLP_PUSH_NEW_SENT_META, true)) { return; }
    // Deferred: WooCommerce saves meta/stock after the status transition.
    if (function_exists('as_schedule_single_action')) {
        if (!as_next_scheduled_action('glp_push_check_new', array($product_id), 'glp')) {
            as_schedule_single_action(time() + 60, 'glp_push_check_new', array($product_id), 'glp');
        }
    } else {
        wp_schedule_single_event(time() + 60, 'glp_push_check_new', array($product_id));
    }
}
// Members-only flag newly ticked on an already-published product.
$glp_push_meta_hook = function ($meta_id, $object_id, $meta_key, $value) {
    if ($meta_key === GLP_PRIVATE_PRODUCT_META && $value === 'yes' && get_post_status($object_id) === 'publish') {
        glp_push_queue_new_check($object_id);
    }
};

add_action('glp_push_check_new', function ($product_id) {
    $product_id = (int) $product_id;
    if (get_post_meta($product_id, GLP_PUSH_NEW_SENT_META, true)) { return; }
    $p = wc_get_product($product_id);
    if (!$p || !glp_push_is_pentarchy_product($product_id) || !$p->is_in_stock()) { return; }
    update_post_meta($product_id, GLP_PUSH_NEW_SENT_META, gmdate('c'));
    update_post_meta($product_id, GLP_PUSH_STATUS_META, $p->get_stock_status());
    glp_push_send_to_members('new_vial', $product_id, 'New product available', $p->get_name() . ' has just been added.');
});

/* ---- trigger 2: BACK IN STOCK (deliberate, product-side changes only) ----- */
$GLOBALS['glp_push_product_save'] = false;
$glp_flag = function () { $GLOBALS['glp_push_product_save'] = true; };
add_action('woocommerce_admin_process_product_object', $glp_flag);
add_action('woocommerce_admin_process_variation_object', $glp_flag);
add_action('woocommerce_product_quick_edit_save', $glp_flag, 1);
add_action('woocommerce_product_bulk_edit_start', $glp_flag);
add_filter('woocommerce_rest_pre_insert_product_object', function ($p) { $GLOBALS['glp_push_product_save'] = true; return $p; });
add_filter('woocommerce_rest_pre_insert_product_variation_object', function ($p) { $GLOBALS['glp_push_product_save'] = true; return $p; });
// Order-driven stock changes are never "restocks", even inside admin requests.
foreach (array('woocommerce_reduce_order_stock', 'woocommerce_restore_order_stock', 'woocommerce_order_status_changed') as $h) {
    add_action($h, function () { $GLOBALS['glp_push_order_stock'] = true; }, 1);
}
add_action('woocommerce_order_item_quantity_reduced', function () { $GLOBALS['glp_push_order_stock'] = true; }, 1);

function glp_push_on_stock_status($product_id, $status, $product = null) {
    $product = $product instanceof WC_Product ? $product : wc_get_product($product_id);
    if (!$product) { return; }
    $pid = $product->is_type('variation') ? $product->get_parent_id() : $product->get_id();
    if (get_post_meta($pid, GLP_PRIVATE_PRODUCT_META, true) !== 'yes') { return; }
    $parent = $pid === $product->get_id() ? $product : wc_get_product($pid);
    $now  = $parent ? $parent->get_stock_status() : $status;
    $prev = (string) get_post_meta($pid, GLP_PUSH_STATUS_META, true);
    update_post_meta($pid, GLP_PUSH_STATUS_META, $now);
    $deliberate = !empty($GLOBALS['glp_push_product_save']) && empty($GLOBALS['glp_push_order_stock']);
    if ($prev === 'outofstock' && $now !== 'outofstock' && $deliberate && glp_push_is_pentarchy_product($pid)
        && get_post_meta($pid, GLP_PUSH_NEW_SENT_META, true)) {
        glp_push_send_to_members('back_in_stock', $pid, 'Back in stock', $parent->get_name() . ' is available again.');
    } elseif ($prev === 'outofstock' && $now !== 'outofstock') {
        glp_push_log('restock_skipped', $pid, array('reason' => $deliberate ? 'not_published_or_new' : 'not_a_product_edit'));
    }
}

/* ---- sending ------------------------------------------------------------- */
function glp_push_send_to_members($type, $product_id, $title, $body) {
    $args = array($type, (int) $product_id, $title, $body);
    if (function_exists('as_enqueue_async_action')) { as_enqueue_async_action('glp_push_send', $args, 'glp'); }
    else { wp_schedule_single_event(time(), 'glp_push_send', $args); }
    glp_push_log('queued', $product_id, array('type' => $type));
}

function glp_push_deliver($uids_subs, $payload) {
    $v = glp_push_vapid();
    if (!$v || !glp_push_lib_loaded()) { return array('sent' => 0, 'failed' => 0, 'removed' => 0, 'error' => 'push library unavailable'); }
    $wp = new \Minishlink\WebPush\WebPush(
        array('VAPID' => array('subject' => 'mailto:' . get_option('woocommerce_email_from_address', get_option('admin_email')),
            'publicKey' => $v['publicKey'], 'privateKey' => $v['privateKey'])),
        array('TTL' => 86400, 'urgency' => 'normal', 'topic' => substr(preg_replace('/[^A-Za-z0-9_-]/', '', (string) $payload['tag']), 0, 32))
    );
    $map = array();
    foreach ($uids_subs as $row) {
        list($uid, $hash, $s) = $row;
        $wp->queueNotification(\Minishlink\WebPush\Subscription::create(array(
            'endpoint' => $s['endpoint'], 'publicKey' => $s['p256dh'], 'authToken' => $s['auth'],
            'contentEncoding' => !empty($s['enc']) ? $s['enc'] : 'aes128gcm',
        )), wp_json_encode($payload));
        $map[$s['endpoint']] = array($uid, $hash);
    }
    $sent = 0; $failed = 0; $removed = 0;
    foreach ($wp->flush() as $report) {
        if ($report->isSuccess()) { $sent++; continue; }
        $failed++;
        $ep = $report->getEndpoint();
        if ($report->isSubscriptionExpired() && isset($map[$ep])) {
            list($uid, $hash) = $map[$ep];
            $subs = get_user_meta($uid, GLP_PUSH_SUBS_META, true);
            if (is_array($subs) && isset($subs[$hash])) { unset($subs[$hash]); update_user_meta($uid, GLP_PUSH_SUBS_META, $subs); $removed++; }
        }
    }
    return array('sent' => $sent, 'failed' => $failed, 'removed' => $removed);
}

add_action('glp_push_send', function ($type, $product_id, $title, $body) {
    $users = get_users(array('meta_key' => GLP_PUSH_SUBS_META, 'meta_compare' => 'EXISTS', 'fields' => 'ID', 'number' => 5000));
    $rows = array();
    foreach ($users as $uid) {
        $uid = (int) $uid;
        if (!glp_is_approved($uid)) { continue; }
        if (empty(glp_push_prefs($uid)[$type])) { continue; }
        $subs = get_user_meta($uid, GLP_PUSH_SUBS_META, true);
        if (!is_array($subs)) { continue; }
        foreach ($subs as $hash => $s) { $rows[] = array($uid, $hash, $s); }
    }
    if (!$rows) { glp_push_log('no_subscribers', $product_id, array('type' => $type)); return; }
    $res = glp_push_deliver($rows, array(
        'title' => $title, 'body' => $body, 'url' => GLP_PUSH_PWA_PATH . (int) $product_id,
        'tag' => $type . '-' . (int) $product_id, 'type' => $type,
    ));
    glp_push_log('sent', $product_id, array_merge(array('type' => $type), $res));
}, 10, 4);

/* ---- member REST endpoints (secret + member token + approved) ------------ */
function glp_push_member_or_error(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    $g = glp_guard_approved($uid);
    return is_wp_error($g) ? $g : (int) $uid;
}

function glp_push_status_payload($uid, $endpoint = '') {
    $v = glp_push_vapid();
    $subs = get_user_meta($uid, GLP_PUSH_SUBS_META, true);
    $subs = is_array($subs) ? $subs : array();
    return array(
        'available'   => (bool) $v,
        'public_key'  => $v ? $v['publicKey'] : '',
        'prefs'       => glp_push_prefs($uid),
        'devices'     => count($subs),
        'this_device' => $endpoint !== '' && isset($subs[md5($endpoint)]),
    );
}

add_action('rest_api_init', function () {
    $ns = 'glp/v1'; $gate = 'glp_require_app_secret';
    register_rest_route($ns, '/push/status', array('methods' => 'POST', 'permission_callback' => $gate, 'callback' => function (WP_REST_Request $req) {
        $uid = glp_push_member_or_error($req); if (is_wp_error($uid)) { return $uid; }
        return glp_nocache_response(glp_push_status_payload($uid, esc_url_raw((string) $req->get_param('endpoint'))));
    }));
    register_rest_route($ns, '/push/subscribe', array('methods' => 'POST', 'permission_callback' => $gate, 'callback' => function (WP_REST_Request $req) {
        $uid = glp_push_member_or_error($req); if (is_wp_error($uid)) { return $uid; }
        $sub = (array) $req->get_param('subscription');
        $ep  = esc_url_raw((string) ($sub['endpoint'] ?? ''));
        $keys = (array) ($sub['keys'] ?? array());
        if (strpos($ep, 'https://') !== 0 || empty($keys['p256dh']) || empty($keys['auth']) || strlen($ep) > 1000) {
            return new WP_REST_Response(array('error' => 'invalid_subscription', 'message' => 'Invalid push subscription.'), 400);
        }
        $subs = get_user_meta($uid, GLP_PUSH_SUBS_META, true); $subs = is_array($subs) ? $subs : array();
        $subs[md5($ep)] = array('endpoint' => $ep, 'p256dh' => sanitize_text_field($keys['p256dh']), 'auth' => sanitize_text_field($keys['auth']),
            'enc' => 'aes128gcm', 'created' => gmdate('c'));
        if (count($subs) > 10) { $subs = array_slice($subs, -10, null, true); }
        update_user_meta($uid, GLP_PUSH_SUBS_META, $subs);
        $prefs = (array) $req->get_param('prefs');
        if ($prefs) {
            update_user_meta($uid, GLP_PUSH_PREFS_META, array('new_vial' => !empty($prefs['new_vial']), 'back_in_stock' => !empty($prefs['back_in_stock'])));
        }
        return glp_nocache_response(glp_push_status_payload($uid, $ep));
    }));
    register_rest_route($ns, '/push/prefs', array('methods' => 'POST', 'permission_callback' => $gate, 'callback' => function (WP_REST_Request $req) {
        $uid = glp_push_member_or_error($req); if (is_wp_error($uid)) { return $uid; }
        update_user_meta($uid, GLP_PUSH_PREFS_META, array('new_vial' => (bool) $req->get_param('new_vial'), 'back_in_stock' => (bool) $req->get_param('back_in_stock')));
        return glp_nocache_response(glp_push_status_payload($uid, esc_url_raw((string) $req->get_param('endpoint'))));
    }));
    register_rest_route($ns, '/push/unsubscribe', array('methods' => 'POST', 'permission_callback' => $gate, 'callback' => function (WP_REST_Request $req) {
        $uid = glp_push_member_or_error($req); if (is_wp_error($uid)) { return $uid; }
        $ep = esc_url_raw((string) $req->get_param('endpoint'));
        $subs = get_user_meta($uid, GLP_PUSH_SUBS_META, true);
        if (is_array($subs) && isset($subs[md5($ep)])) { unset($subs[md5($ep)]); update_user_meta($uid, GLP_PUSH_SUBS_META, $subs); }
        return glp_nocache_response(glp_push_status_payload($uid, $ep));
    }));
    // Sends a test alert to the CALLER's own devices only.
    register_rest_route($ns, '/push/test', array('methods' => 'POST', 'permission_callback' => $gate, 'callback' => function (WP_REST_Request $req) {
        $uid = glp_push_member_or_error($req); if (is_wp_error($uid)) { return $uid; }
        $subs = get_user_meta($uid, GLP_PUSH_SUBS_META, true);
        if (!is_array($subs) || !$subs) { return new WP_REST_Response(array('error' => 'no_devices', 'message' => 'Turn on an alert on this device first.'), 409); }
        $rows = array(); foreach ($subs as $h => $s) { $rows[] = array($uid, $h, $s); }
        $res = glp_push_deliver($rows, array('title' => 'Pentarchy', 'body' => 'Test alert — stock alerts are working on this device.', 'url' => '/', 'tag' => 'test-' . $uid, 'type' => 'test'));
        glp_push_log('test', 0, $res);
        return glp_nocache_response($res);
    }));
});
