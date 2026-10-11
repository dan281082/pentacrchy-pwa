<?php
/**
 * GLP App Connector — v2.3.0 Pentarchy staff catalogue + members management.
 * WooCommerce stays the source of truth: every read/write uses WC product/user APIs.
 * Caps: glp_manage_catalogue (products, audit), glp_manage_members (members).
 * Role "Pentarchy Store Manager" = fulfilment + catalogue + members (no wp-admin).
 * Also: Pentarchy offers USDT on Ethereum (ERC20) ONLY — TRON is hidden & rejected.
 */
if (!defined('ABSPATH')) { exit; }

define('GLP_CAT_CAP', 'glp_manage_catalogue');
define('GLP_MEM_CAP', 'glp_manage_members');
define('GLP_PENTARCHY_NETWORKS', 'ethereum');

add_action('init', function () {
    if (get_option('glp_manage_schema') === '2.3.0') { return; }
    $caps = array('read' => true, GLP_FULFIL_CAP => true, GLP_CAT_CAP => true, GLP_MEM_CAP => true, 'upload_files' => true);
    if (!get_role('glp_store_manager')) { add_role('glp_store_manager', 'Pentarchy Store Manager', $caps); }
    foreach (array(GLP_CAT_CAP, GLP_MEM_CAP) as $c) { if ($a = get_role('administrator')) { $a->add_cap($c); } }
    update_option('glp_manage_schema', '2.3.0');
});
add_action('set_user_role', function ($uid, $role) { if ($role === 'glp_store_manager') { update_user_meta($uid, GLP_APP_APPROVED_META, 'yes'); } }, 10, 2);
add_action('admin_init', function () {
    $u = get_current_user_id();
    if ($u && !wp_doing_ajax() && user_can($u, GLP_CAT_CAP) && !user_can($u, 'manage_woocommerce') && !user_can($u, 'edit_posts')) {
        wp_safe_redirect(home_url('/')); exit;
    }
});

function glp_can_manage($uid) { return $uid && user_can((int) $uid, GLP_CAT_CAP); }
function glp_can_manage_members($uid) { return $uid && user_can((int) $uid, GLP_MEM_CAP); }

/* ---- ERC20 only -------------------------------------------------------- */
add_filter('rest_request_before_callbacks', function ($resp, $handler, $req) {
    $r = (string) $req->get_route();
    if ($req->get_method() === 'POST' && preg_match('#^/glp/v1/orders(/\d+/crypto-network)?$#', $r)) {
        $n = (string) $req->get_param('network');
        if ($n !== '' && $n !== GLP_PENTARCHY_NETWORKS) {
            return new WP_Error('glp_network_unavailable', 'Pentarchy accepts USDT on Ethereum (ERC20) only.', array('status' => 400));
        }
    }
    return $resp;
}, 10, 3);
add_filter('rest_post_dispatch', function ($res, $server, $req) {
    if ($req->get_route() === '/glp/v1/crypto/networks' && $res instanceof WP_REST_Response) {
        $d = $res->get_data();
        if (is_array($d) && isset($d['networks'])) {
            $d['networks'] = array_values(array_filter($d['networks'], function ($n) { return isset($n['id']) && $n['id'] === GLP_PENTARCHY_NETWORKS; }));
            $res->set_data($d);
        }
    }
    return $res;
}, 5, 3);

/* ---- helpers ------------------------------------------------------------ */
function glp_staff_cap_or_error(WP_REST_Request $req, $cap) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    return user_can((int) $uid, $cap) ? (int) $uid : new WP_Error('glp_forbidden', 'Staff permission required', array('status' => 403));
}

function glp_audit($uid, $pid, $action, $changes = array()) {
    $u = get_user_by('id', $uid);
    $e = array('at' => gmdate('c'), 'by' => $u ? ($u->display_name ?: $u->user_login) : '', 'by_id' => (int) $uid,
        'product' => (int) $pid, 'name' => $pid ? get_the_title($pid) : '', 'action' => $action, 'changes' => $changes);
    $log = get_option('glp_staff_audit', array()); $log = is_array($log) ? $log : array();
    $log[] = $e; if (count($log) > 1000) { $log = array_slice($log, -1000); }
    update_option('glp_staff_audit', $log, false);
    if ($pid) {
        $pl = get_post_meta($pid, '_glp_audit', true); $pl = is_array($pl) ? $pl : array();
        $pl[] = $e; update_post_meta($pid, '_glp_audit', array_slice($pl, -100));
    }
}

function glp_sales_30d() {
    static $map = null;
    if ($map !== null) { return $map; }
    $map = array();
    $orders = wc_get_orders(array('status' => array('processing', 'completed'), 'limit' => 1000,
        'date_created' => '>' . (time() - 30 * DAY_IN_SECONDS)));
    foreach ($orders as $o) {
        foreach ($o->get_items() as $it) { $pid = (int) $it->get_product_id(); $map[$pid] = ($map[$pid] ?? 0) + (int) $it->get_quantity(); }
    }
    return $map;
}

function glp_manage_map($p, $detail = false) {
    $id = $p->get_id(); $img = $p->get_image_id();
    $out = array(
        'id' => (string) $id, 'name' => $p->get_name(), 'sku' => $p->get_sku(), 'status' => $p->get_status(),
        'members_only' => get_post_meta($id, GLP_PRIVATE_PRODUCT_META, true) === 'yes',
        'price' => $p->get_regular_price(), 'sale_price' => $p->get_sale_price(),
        'manage_stock' => $p->get_manage_stock(), 'stock_quantity' => $p->get_stock_quantity(), 'stock_status' => $p->get_stock_status(),
        'image_url' => $img ? wp_get_attachment_image_url($img, 'medium') : null,
        'sold_total' => (int) $p->get_total_sales(), 'sold_30d' => (int) (glp_sales_30d()[$id] ?? 0),
        'modified' => $p->get_date_modified() ? $p->get_date_modified()->date('c') : null,
    );
    if ($detail) {
        $out['description'] = $p->get_description();
        $out['short_description'] = $p->get_short_description();
        $out['coa'] = function_exists('glp_coa_public') ? glp_coa_public($id) : null;
        $out['preview'] = function_exists('glp_map_product') ? glp_map_product($p, true) : null;
        $a = get_post_meta($id, '_glp_audit', true); $out['audit'] = is_array($a) ? array_reverse($a) : array();
    }
    return $out;
}

function glp_store_image_b64($b64, $filename, $pid) {
    if (strpos($b64, 'base64,') !== false) { $b64 = substr($b64, strpos($b64, 'base64,') + 7); }
    $bytes = base64_decode($b64, true);
    if (!$bytes || strlen($bytes) > 5 * 1024 * 1024 || !@getimagesizefromstring($bytes)) { return new WP_Error('glp_bad_image', 'Images must be JPG/PNG/WebP up to 5 MB.', array('status' => 415)); }
    require_once ABSPATH . 'wp-admin/includes/file.php'; require_once ABSPATH . 'wp-admin/includes/media.php'; require_once ABSPATH . 'wp-admin/includes/image.php';
    $up = wp_upload_bits(sanitize_file_name($filename ?: 'vial.jpg'), null, $bytes);
    if (!empty($up['error'])) { return new WP_Error('glp_upload_failed', $up['error'], array('status' => 500)); }
    $ft = wp_check_filetype($up['file']);
    if (!in_array($ft['type'], array('image/jpeg', 'image/png', 'image/webp'), true)) { @unlink($up['file']); return new WP_Error('glp_bad_image', 'Images must be JPG/PNG/WebP.', array('status' => 415)); }
    $att = wp_insert_attachment(array('post_mime_type' => $ft['type'], 'post_title' => get_the_title($pid), 'post_status' => 'inherit'), $up['file'], $pid);
    wp_update_attachment_metadata($att, wp_generate_attachment_metadata($att, $up['file']));
    return $att;
}

// Apply an edit payload to a WC product; returns [changes] or WP_Error.
function glp_apply_product_edit($p, WP_REST_Request $req, $uid) {
    $ch = array();
    $set = function ($field, $old, $new) use (&$ch) { if ((string) $old !== (string) $new) { $ch[$field] = array('from' => $old, 'to' => $new); } };
    $prm = $req->get_json_params(); $prm = is_array($prm) ? $prm : array();
    if (array_key_exists('name', $prm)) { $v = sanitize_text_field($prm['name']); if ($v === '') { return new WP_Error('glp_invalid', 'Name is required.', array('status' => 400)); } $set('name', $p->get_name(), $v); $p->set_name($v); }
    if (array_key_exists('price', $prm)) { $v = wc_format_decimal($prm['price']); if ($v === '' || $v < 0) { return new WP_Error('glp_invalid', 'Enter a valid price.', array('status' => 400)); } $set('price', $p->get_regular_price(), $v); $p->set_regular_price($v); }
    if (array_key_exists('sale_price', $prm)) { $v = $prm['sale_price'] === '' || $prm['sale_price'] === null ? '' : wc_format_decimal($prm['sale_price']); $set('sale_price', $p->get_sale_price(), $v); $p->set_sale_price($v); }
    if (array_key_exists('description', $prm)) { $v = wp_kses_post($prm['description']); $set('description', wp_strip_all_tags($p->get_description()), wp_strip_all_tags($v)); $p->set_description($v); }
    if (array_key_exists('stock_quantity', $prm) && $prm['stock_quantity'] !== null && $prm['stock_quantity'] !== '') {
        $v = (int) $prm['stock_quantity']; if ($v < 0) { return new WP_Error('glp_invalid', 'Stock cannot be negative.', array('status' => 400)); }
        $p->set_manage_stock(true); $set('stock_quantity', $p->get_stock_quantity(), $v); $p->set_stock_quantity($v);
    } elseif (array_key_exists('stock_status', $prm) && in_array($prm['stock_status'], array('instock', 'outofstock'), true)) {
        $set('stock_status', $p->get_stock_status(), $prm['stock_status']); if (!$p->get_manage_stock()) { $p->set_stock_status($prm['stock_status']); }
    }
    if (array_key_exists('status', $prm) && in_array($prm['status'], array('publish', 'draft'), true)) { $set('status', $p->get_status(), $prm['status']); $p->set_status($prm['status']); }
    if (!empty($prm['image'])) {
        if (!$p->get_id()) { $p->save(); }
        $att = glp_store_image_b64((string) $prm['image'], (string) ($prm['image_name'] ?? ''), $p->get_id());
        if (is_wp_error($att)) { return $att; }
        $set('image', $p->get_image_id(), $att); $p->set_image_id($att);
    }
    $GLOBALS['glp_push_product_save'] = true; // product-side change (not order-driven)
    $p->save();
    if (array_key_exists('members_only', $prm)) {
        $old = get_post_meta($p->get_id(), GLP_PRIVATE_PRODUCT_META, true) === 'yes'; $new = !empty($prm['members_only']);
        if ($old !== $new) { $ch['members_only'] = array('from' => $old, 'to' => $new); update_post_meta($p->get_id(), GLP_PRIVATE_PRODUCT_META, $new ? 'yes' : 'no'); }
    }
    if (function_exists('glp_coa_apply')) {
        $cc = glp_coa_apply($p->get_id(), $prm); if (is_wp_error($cc)) { return $cc; }
        $ch = array_merge($ch, $cc);
    }
    return $ch;
}

function glp_maybe_notify($p, $uid, $before, $notify) {
    if (!$notify || !function_exists('glp_push_send_to_members')) { return null; }
    $id = $p->get_id(); clean_post_cache($id); $p = wc_get_product($id);
    $live = $p && $p->get_status() === 'publish' && get_post_meta($id, GLP_PRIVATE_PRODUCT_META, true) === 'yes' && $p->is_in_stock();
    if (!$live) { return 'skipped_not_available'; }
    $was_live = $before && $before['status'] === 'publish' && $before['members_only'] && $before['stock_status'] !== 'outofstock';
    if ($was_live) { return 'skipped_already_available'; }
    $restock = $before && $before['status'] === 'publish' && $before['members_only'] && $before['stock_status'] === 'outofstock';
    if ($restock) { glp_push_send_to_members('back_in_stock', $id, 'Back in stock', $p->get_name() . ' is available again.'); $t = 'back_in_stock'; }
    else { glp_push_send_to_members('new_vial', $id, 'New product available', $p->get_name() . ' has just been added.'); update_post_meta($id, GLP_PUSH_NEW_SENT_META, gmdate('c')); $t = 'new_vial'; }
    glp_audit($uid, $id, 'notified_members', array('alert' => $t));
    return $t;
}

/* ---- routes ------------------------------------------------------------- */
add_action('rest_api_init', function () {
    $ns = 'glp/v1'; $g = 'glp_require_app_secret';

    register_rest_route($ns, '/manage/products', array(
        array('methods' => 'GET', 'permission_callback' => $g, 'callback' => function (WP_REST_Request $req) {
            $uid = glp_staff_cap_or_error($req, GLP_CAT_CAP); if (is_wp_error($uid)) { return $uid; }
            $args = array('type' => array('simple', 'variable'), 'limit' => 200, 'orderby' => 'modified', 'order' => 'DESC', 'status' => array('publish', 'draft', 'pending', 'private'));
            $s = sanitize_text_field((string) $req->get_param('search')); if ($s !== '') { $args['s'] = $s; }
            $f = sanitize_key((string) $req->get_param('filter'));
            if ($f === 'publish' || $f === 'draft') { $args['status'] = $f; }
            if ($f === 'outofstock') { $args['stock_status'] = 'outofstock'; }
            $out = array();
            foreach (wc_get_products($args) as $p) {
                $m = glp_manage_map($p);
                if ($f === 'members' && !$m['members_only']) { continue; }
                $out[] = $m;
            }
            return glp_nocache_response(array('products' => $out));
        }),
        array('methods' => 'POST', 'permission_callback' => $g, 'callback' => function (WP_REST_Request $req) {
            $uid = glp_staff_cap_or_error($req, GLP_CAT_CAP); if (is_wp_error($uid)) { return $uid; }
            $p = new WC_Product_Simple(); $p->set_status('draft');
            $p->set_catalog_visibility('hidden'); // private: never listed/searchable on the public website
            $cats = get_terms(array('taxonomy' => 'product_cat', 'name' => 'Vials', 'hide_empty' => false, 'fields' => 'ids'));
            if ($cats && !is_wp_error($cats)) { $p->set_category_ids(array((int) $cats[0])); }
            $ch = glp_apply_product_edit($p, $req, $uid); if (is_wp_error($ch)) { return $ch; }
            $body = $req->get_json_params();
            if (!is_array($body) || !array_key_exists('members_only', $body)) { update_post_meta($p->get_id(), GLP_PRIVATE_PRODUCT_META, 'yes'); } // default: members-only
            glp_audit($uid, $p->get_id(), 'created', $ch);
            $n = glp_maybe_notify($p, $uid, null, (bool) $req->get_param('notify'));
            return glp_nocache_response(array('product' => glp_manage_map(wc_get_product($p->get_id()), true), 'notify' => $n));
        }),
    ));
    register_rest_route($ns, '/manage/products/(?P<id>\d+)', array(
        array('methods' => 'GET', 'permission_callback' => $g, 'callback' => function (WP_REST_Request $req) {
            $uid = glp_staff_cap_or_error($req, GLP_CAT_CAP); if (is_wp_error($uid)) { return $uid; }
            $p = wc_get_product((int) $req['id']); if (!$p || $p->is_type('variation')) { return new WP_Error('glp_not_found', 'Not found', array('status' => 404)); }
            return glp_nocache_response(array('product' => glp_manage_map($p, true)));
        }),
        array('methods' => 'POST', 'permission_callback' => $g, 'callback' => function (WP_REST_Request $req) {
            $uid = glp_staff_cap_or_error($req, GLP_CAT_CAP); if (is_wp_error($uid)) { return $uid; }
            $p = wc_get_product((int) $req['id']); if (!$p || $p->is_type('variation')) { return new WP_Error('glp_not_found', 'Not found', array('status' => 404)); }
            $before = glp_manage_map($p);
            $ch = glp_apply_product_edit($p, $req, $uid); if (is_wp_error($ch)) { return $ch; }
            if ($ch) { glp_audit($uid, $p->get_id(), 'updated', $ch); }
            $n = glp_maybe_notify($p, $uid, $before, (bool) $req->get_param('notify'));
            return glp_nocache_response(array('product' => glp_manage_map(wc_get_product($p->get_id()), true), 'notify' => $n));
        }),
    ));
    register_rest_route($ns, '/manage/products/(?P<id>\d+)/duplicate', array('methods' => 'POST', 'permission_callback' => $g, 'callback' => function (WP_REST_Request $req) {
        $uid = glp_staff_cap_or_error($req, GLP_CAT_CAP); if (is_wp_error($uid)) { return $uid; }
        $p = wc_get_product((int) $req['id']); if (!$p) { return new WP_Error('glp_not_found', 'Not found', array('status' => 404)); }
        if (!class_exists('WC_Admin_Duplicate_Product')) { include_once WC_ABSPATH . 'includes/admin/class-wc-admin-duplicate-product.php'; }
        $GLOBALS['glp_push_product_save'] = true;
        $dup = (new WC_Admin_Duplicate_Product())->product_duplicate($p); // WooCommerce's own duplicate (always draft)
        update_post_meta($dup->get_id(), GLP_PRIVATE_PRODUCT_META, get_post_meta($p->get_id(), GLP_PRIVATE_PRODUCT_META, true));
        delete_post_meta($dup->get_id(), '_glp_audit'); delete_post_meta($dup->get_id(), GLP_PUSH_NEW_SENT_META);
        glp_audit($uid, $dup->get_id(), 'duplicated', array('from_product' => array('from' => null, 'to' => $p->get_id())));
        return glp_nocache_response(array('product' => glp_manage_map($dup, true)));
    }));
    register_rest_route($ns, '/manage/audit', array('methods' => 'GET', 'permission_callback' => $g, 'callback' => function (WP_REST_Request $req) {
        $uid = glp_staff_cap_or_error($req, GLP_CAT_CAP); if (is_wp_error($uid)) { return $uid; }
        $log = get_option('glp_staff_audit', array());
        return glp_nocache_response(array('entries' => array_slice(array_reverse(is_array($log) ? $log : array()), 0, 200)));
    }));

    register_rest_route($ns, '/manage/members', array('methods' => 'GET', 'permission_callback' => $g, 'callback' => function (WP_REST_Request $req) {
        $uid = glp_staff_cap_or_error($req, GLP_MEM_CAP); if (is_wp_error($uid)) { return $uid; }
        $s = sanitize_text_field((string) $req->get_param('search'));
        $args = array('number' => 200, 'orderby' => 'registered', 'order' => 'DESC', 'role__not_in' => array('administrator'));
        if ($s !== '') {
            $args['meta_query'] = array('relation' => 'OR', array('key' => GLP_TELEGRAM_META, 'value' => ltrim($s, '@'), 'compare' => 'LIKE'), array('key' => 'first_name', 'value' => $s, 'compare' => 'LIKE'), array('key' => 'last_name', 'value' => $s, 'compare' => 'LIKE'), array('key' => 'billing_email', 'value' => $s, 'compare' => 'LIKE'));
        }
        $users = get_users($args);
        if ($s !== '') { $users = array_merge($users, get_users(array('number' => 50, 'search' => '*' . $s . '*', 'search_columns' => array('user_email', 'user_login', 'display_name'), 'role__not_in' => array('administrator')))); }
        $out = array(); $seen = array();
        foreach ($users as $u) {
            if (isset($seen[$u->ID])) { continue; } $seen[$u->ID] = 1;
            $out[] = array('id' => (string) $u->ID, 'name' => trim($u->first_name . ' ' . $u->last_name) ?: $u->display_name, 'email' => $u->user_email,
                'telegram' => (string) get_user_meta($u->ID, GLP_TELEGRAM_META, true), 'approved' => glp_is_approved($u->ID),
                'staff' => user_can($u->ID, GLP_FULFIL_CAP), 'registered' => mysql2date('c', $u->user_registered),
                'orders' => function_exists('wc_get_customer_order_count') ? (int) wc_get_customer_order_count($u->ID) : 0);
        }
        return glp_nocache_response(array('members' => $out));
    }));
    register_rest_route($ns, '/manage/members/(?P<id>\d+)', array('methods' => 'POST', 'permission_callback' => $g, 'callback' => function (WP_REST_Request $req) {
        $uid = glp_staff_cap_or_error($req, GLP_MEM_CAP); if (is_wp_error($uid)) { return $uid; }
        $target = get_user_by('id', (int) $req['id']);
        if (!$target || user_can($target, 'manage_options') || (int) $target->ID === $uid) { return new WP_Error('glp_forbidden', 'This account cannot be changed here.', array('status' => 403)); }
        $approved = (bool) $req->get_param('approved');
        update_user_meta($target->ID, GLP_APP_APPROVED_META, $approved ? 'yes' : 'no');
        glp_audit($uid, 0, $approved ? 'member_approved' : 'member_suspended', array('member' => array('from' => null, 'to' => $target->user_email)));
        return glp_nocache_response(array('ok' => true, 'approved' => $approved));
    }));
});
