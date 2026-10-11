<?php
/**
 * Plugin Name: GLP App Connector
 * Description: Secure server-to-server bridge for the GLP customer PWA. Adds a
 *              `glp_customer` role (approval mirror), an approval flag, private
 *              product designation, and the /wp-json/glp/v1/ endpoints consumed
 *              ONLY by the trusted GLP API backend. WooCommerce remains the
 *              source of truth. Built fresh for ap3p-fitness.com (independent of Apeps).
 * Version:     2.4.0
 * Author:      GLP
 *
 * SECURITY MODEL
 * --------------
 * 1. SHARED SECRET: every /glp/v1/ endpoint requires the header
 *    `X-GLP-App-Secret` matching GLP_APP_SHARED_SECRET (defined in wp-config.php).
 *    These endpoints are called ONLY from the trusted GLP API backend, never a
 *    browser. WooCommerce consumer keys are never exposed.
 *
 * 2. CUSTOMER IDENTITY IS NEVER CLIENT-SUPPLIED: `POST /session` validates
 *    credentials and returns an opaque, HMAC-signed customer TOKEN. All other
 *    endpoints derive the user ONLY from `X-GLP-Customer-Token`. No endpoint
 *    accepts a `customer_id` parameter, so changing any URL/param/body can never
 *    cause a different WordPress user to be used.
 *
 * 3. APPROVAL MODEL: user meta `_glp_app_approved` is the AUTHORITATIVE flag.
 *    When set, the additive `glp_customer` role is added (existing WooCommerce
 *    `customer` role preserved); when unset it is removed. Admins approve/revoke
 *    from the standard WordPress user profile screen.
 *
 * 4. PRIVATE PRODUCT DESIGNATION: the product checkbox "Include in GLP private
 *    app" sets meta `_glp_private_app_product = yes`. The private endpoints ONLY
 *    return products carrying this flag, and /products/{id} re-checks it.
 *
 * SCOPE: Phase 1 — auth, catalogue, owner-scoped orders + AST shipment tracking.
 * NO crypto checkout, NO payment handoff, NO wallet config (added later).
 */

if (!defined('ABSPATH')) { exit; }

define('GLP_APP_APPROVED_META', '_glp_app_approved');
define('GLP_PRIVATE_PRODUCT_META', '_glp_private_app_product');
define('GLP_TELEGRAM_META', '_glp_telegram_username');
define('GLP_TOKEN_TTL', 60 * 60 * 24 * 30); // 30-day safety net; the app session is shorter.

// v2.1.0: customer-supplied postage labels + staff fulfilment (additive module).
require_once __DIR__ . '/includes/fulfilment.php';
require_once __DIR__ . '/includes/emails.php'; // v2.1.1: guaranteed standard WC customer emails
require_once __DIR__ . '/includes/diagnostics.php'; // v2.1.2: staff-only email lifecycle log
require_once __DIR__ . '/includes/push.php'; // v2.2.0: Web Push stock alerts
require_once __DIR__ . '/includes/manage.php'; // v2.3.0: staff catalogue + members, ERC20 only
require_once __DIR__ . '/includes/coa.php'; // v2.4.0: optional Certificate of Analysis (private)

function glp_shared_secret() {
    if (defined('GLP_APP_SHARED_SECRET')) { return GLP_APP_SHARED_SECRET; }
    $env = getenv('GLP_APP_SHARED_SECRET');
    return $env ?: '';
}

/* ------------------------------------------------------------------ */
/* 1. Role / capability + approval admin control                       */
/* ------------------------------------------------------------------ */

register_activation_hook(__FILE__, function () {
    add_role('glp_customer', 'GLP Customer', array('read' => true, 'glp_private_catalogue' => true));
});

add_action('show_user_profile', 'glp_approval_field');
add_action('edit_user_profile', 'glp_approval_field');
function glp_approval_field($user) {
    if (!current_user_can('edit_user', $user->ID)) { return; }
    $approved = get_user_meta($user->ID, GLP_APP_APPROVED_META, true) === 'yes';
    wp_nonce_field('glp_approval_save', 'glp_approval_nonce');
    ?>
    <h2>GLP App Access</h2>
    <table class="form-table">
        <tr>
            <th><label for="glp_app_approved">Private catalogue access</label></th>
            <td>
                <label>
                    <input type="checkbox" name="glp_app_approved" id="glp_app_approved" value="yes" <?php checked($approved); ?> />
                    Approve this customer for the GLP private app catalogue
                </label>
                <p class="description">Adds the <code>glp_customer</code> role (keeps existing roles). Unchecking removes only that role.</p>
            </td>
        </tr>
    </table>
    <?php
}

add_action('personal_options_update', 'glp_save_approval_field');
add_action('edit_user_profile_update', 'glp_save_approval_field');
function glp_save_approval_field($user_id) {
    if (!current_user_can('edit_user', $user_id)) { return; }
    if (!isset($_POST['glp_approval_nonce']) ||
        !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['glp_approval_nonce'])), 'glp_approval_save')) {
        return;
    }
    $approved = isset($_POST['glp_app_approved']) && $_POST['glp_app_approved'] === 'yes';
    update_user_meta($user_id, GLP_APP_APPROVED_META, $approved ? 'yes' : 'no');

    $user = new WP_User($user_id);
    if ($approved) {
        if (!in_array('glp_customer', (array) $user->roles, true)) { $user->add_role('glp_customer'); }
    } else {
        if (in_array('glp_customer', (array) $user->roles, true)) { $user->remove_role('glp_customer'); }
    }
}

function glp_is_approved($user_id) {
    return $user_id && get_user_meta($user_id, GLP_APP_APPROVED_META, true) === 'yes';
}

/* ------------------------------------------------------------------ */
/* 2. Product meta box: include a product in the GLP private app       */
/* ------------------------------------------------------------------ */

add_action('add_meta_boxes', function () {
    add_meta_box('glp_private_product', 'GLP Private App', 'glp_private_product_box', 'product', 'side');
});
function glp_private_product_box($post) {
    $val = get_post_meta($post->ID, GLP_PRIVATE_PRODUCT_META, true);
    wp_nonce_field('glp_private_product_save', 'glp_private_product_nonce');
    echo '<label><input type="checkbox" name="glp_private_app_product" value="yes" ' . checked($val, 'yes', false) . ' /> Include in GLP private app</label>';
    echo '<p class="description" style="margin-top:6px">Makes this product available in the GLP private app.</p>';
}
add_action('save_post_product', function ($post_id) {
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) { return; }
    if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) { return; }
    if (!isset($_POST['glp_private_product_nonce']) ||
        !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['glp_private_product_nonce'])), 'glp_private_product_save')) {
        return;
    }
    if (!current_user_can('edit_post', $post_id)) { return; }
    $val = (isset($_POST['glp_private_app_product']) && $_POST['glp_private_app_product'] === 'yes') ? 'yes' : 'no';
    update_post_meta($post_id, GLP_PRIVATE_PRODUCT_META, $val);
}, 10, 1);

/* ------------------------------------------------------------------ */
/* 3. Opaque, HMAC-signed customer token                               */
/* ------------------------------------------------------------------ */

function glp_issue_token($user_id) {
    $issued = time();
    $payload = $user_id . '|' . $issued;
    $sig = hash_hmac('sha256', $payload, glp_shared_secret());
    return rtrim(strtr(base64_encode($payload . '|' . $sig), '+/', '-_'), '=');
}

function glp_user_from_token(WP_REST_Request $req) {
    $token = $req->get_header('x-glp-customer-token');
    if (!$token) { return 0; }
    $raw = base64_decode(strtr($token, '-_', '+/'), true);
    if ($raw === false) { return 0; }
    $parts = explode('|', $raw);
    if (count($parts) !== 3) { return 0; }
    list($user_id, $issued, $sig) = $parts;
    $expected = hash_hmac('sha256', $user_id . '|' . $issued, glp_shared_secret());
    if (!hash_equals($expected, $sig)) { return 0; }
    if ((time() - (int) $issued) > GLP_TOKEN_TTL) { return 0; }
    if (!get_user_by('id', (int) $user_id)) { return 0; }
    return (int) $user_id;
}

/* ------------------------------------------------------------------ */
/* 4. REST API: /wp-json/glp/v1/                                       */
/* ------------------------------------------------------------------ */

add_action('rest_api_init', function () {
    $ns = 'glp/v1';
    $secret_gate = 'glp_require_app_secret';

    register_rest_route($ns, '/version', array(
        'methods' => 'GET', 'permission_callback' => $secret_gate,
        'callback' => function () { return array('connector' => '2.3.0'); },
    ));
    register_rest_route($ns, '/diagnostics/crypto', array(
        'methods' => 'GET', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_crypto_diagnostics',
    ));
    register_rest_route($ns, '/session', array(
        'methods' => 'POST', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_session',
    ));
    register_rest_route($ns, '/me', array(
        'methods' => 'GET', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_me',
    ));
    register_rest_route($ns, '/me/addresses', array(
        'methods' => 'GET', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_addresses',
    ));
    register_rest_route($ns, '/me/change-password', array(
        'methods' => 'POST', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_change_password',
    ));
    register_rest_route($ns, '/auth/request-password-reset', array(
        'methods' => 'POST', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_request_password_reset',
    ));
    register_rest_route($ns, '/categories', array(
        'methods' => 'GET', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_categories',
    ));
    register_rest_route($ns, '/catalogue', array(
        'methods' => 'GET', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_catalogue',
    ));
    register_rest_route($ns, '/products/(?P<id>\d+)', array(
        'methods' => 'GET', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_product',
    ));
    register_rest_route($ns, '/orders', array(
        'methods' => 'GET', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_orders',
    ));
    register_rest_route($ns, '/orders/(?P<id>\d+)', array(
        'methods' => 'GET', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_order',
    ));

    // ---- Phase 2B: basket validation, order creation + native crypto ------
    register_rest_route($ns, '/basket/validate', array(
        'methods' => 'POST', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_validate_basket',
    ));
    register_rest_route($ns, '/orders', array(
        'methods' => 'POST', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_create_order',
    ));
    register_rest_route($ns, '/shipping/quote', array(
        'methods' => 'POST', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_shipping_quote',
    ));
    register_rest_route($ns, '/account/shipping-address', array(
        'methods' => 'POST', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_update_shipping_address',
    ));
    register_rest_route($ns, '/crypto/networks', array(
        'methods' => 'GET', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_crypto_networks',
    ));
    register_rest_route($ns, '/orders/(?P<id>\d+)/crypto-invoice', array(
        'methods' => 'GET', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_crypto_invoice',
    ));
    register_rest_route($ns, '/orders/(?P<id>\d+)/crypto-recheck', array(
        'methods' => 'POST', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_crypto_recheck',
    ));
    register_rest_route($ns, '/orders/(?P<id>\d+)/crypto-network', array(
        'methods' => 'POST', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_change_crypto_network',
    ));
    register_rest_route($ns, '/orders/(?P<id>\d+)/cancel', array(
        'methods' => 'POST', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_cancel_order',
    ));
    register_rest_route($ns, '/diagnostics/wallets', array(
        'methods' => 'GET', 'permission_callback' => $secret_gate, 'callback' => 'glp_rest_wallet_validation',
    ));
});

function glp_require_app_secret(WP_REST_Request $req) {
    $expected = glp_shared_secret();
    $given = $req->get_header('x-glp-app-secret');
    if (!$expected || !$given || !hash_equals($expected, $given)) {
        return new WP_Error('glp_forbidden', 'Forbidden', array('status' => 403));
    }
    return true;
}

function glp_authed_user_or_error(WP_REST_Request $req) {
    $uid = glp_user_from_token($req);
    if (!$uid) { return new WP_Error('glp_unauthorized', 'Unauthorized', array('status' => 401)); }
    return $uid;
}

function glp_guard_approved($uid) {
    if (!glp_is_approved($uid)) {
        return new WP_Error('glp_not_approved', 'Not approved', array('status' => 403));
    }
    return true;
}

/* ---- customer serialisation (customer-safe fields only) ------------ */

function glp_public_customer($user) {
    $approved = glp_is_approved($user->ID);
    return array(
        'id'            => (string) $user->ID,
        'email'         => $user->user_email,
        'username'      => $user->user_login,
        'display_name'  => $user->display_name,
        'company'       => get_user_meta($user->ID, 'billing_company', true),
        'first_name'    => get_user_meta($user->ID, 'first_name', true),
        'last_name'     => get_user_meta($user->ID, 'last_name', true),
        'telegram_username' => (string) get_user_meta($user->ID, GLP_TELEGRAM_META, true),
        'approved'      => $approved,
        'role'          => $approved ? 'private_customer' : 'customer',
        'fulfilment'    => glp_can_fulfil($user->ID),
        'manage'        => function_exists('glp_can_manage') && glp_can_manage($user->ID),
        'members'       => function_exists('glp_can_manage_members') && glp_can_manage_members($user->ID),
    );
}

/* ---- auth / account ------------------------------------------------ */

function glp_rest_session(WP_REST_Request $req) {
    $username = sanitize_text_field((string) $req->get_param('username'));
    $password = (string) $req->get_param('password');
    if ($username === '' || $password === '') {
        return new WP_REST_Response(array('error' => 'invalid_credentials'), 401);
    }
    $user = wp_authenticate($username, $password);
    if (is_wp_error($user)) {
        return new WP_REST_Response(array('error' => 'invalid_credentials'), 401);
    }
    return array(
        'customer' => glp_public_customer($user),
        'token'    => glp_issue_token($user->ID),
    );
}

function glp_rest_me(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    // no-cache: the account name must reflect edits immediately (not a stale
    // SiteGround Dynamic Cache copy) on refresh / re-login.
    return glp_nocache_response(array('customer' => glp_public_customer(get_user_by('id', $uid))));
}

function glp_address_from_meta($uid, $prefix) {
    return array(
        'name'     => trim(get_user_meta($uid, $prefix . '_first_name', true) . ' ' . get_user_meta($uid, $prefix . '_last_name', true)),
        'company'  => get_user_meta($uid, $prefix . '_company', true),
        'line1'    => get_user_meta($uid, $prefix . '_address_1', true),
        'line2'    => get_user_meta($uid, $prefix . '_address_2', true),
        'city'     => get_user_meta($uid, $prefix . '_city', true),
        'postcode' => get_user_meta($uid, $prefix . '_postcode', true),
        'country'  => get_user_meta($uid, $prefix . '_country', true),
        'phone'    => get_user_meta($uid, $prefix . '_phone', true),
    );
}

function glp_rest_addresses(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    // no-cache: a freshly-saved delivery address must not be masked by a stale
    // SiteGround Dynamic Cache read (this was the "saving doesn't persist" cause).
    return glp_nocache_response(array('addresses' => array(
        'shipping' => glp_address_from_meta($uid, 'shipping'),
        'billing'  => glp_address_from_meta($uid, 'billing'),
    )));
}

function glp_rest_change_password(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    $user = get_user_by('id', $uid);
    $current = (string) $req->get_param('current_password');
    $new = (string) $req->get_param('new_password');
    if (strlen($new) < 8) {
        return new WP_REST_Response(array('error' => 'weak_password'), 400);
    }
    if (!wp_check_password($current, $user->user_pass, $user->ID)) {
        return new WP_REST_Response(array('error' => 'invalid_current_password'), 400);
    }
    wp_set_password($new, $user->ID);
    return new WP_REST_Response(array('ok' => true), 200);
}

// POST /auth/request-password-reset : trigger WordPress's STANDARD password
// reset email (retrieve_password) for the given email/username. Enumeration-safe:
// ALWAYS returns 200 {ok:true} and never reveals whether an account exists. This
// reuses WooCommerce/WordPress's own secure reset-key + email flow; no custom
// reset token or password logic is implemented here.
function glp_rest_request_password_reset(WP_REST_Request $req) {
    $login = trim((string) $req->get_param('username'));
    if ($login !== '') {
        $user = is_email($login) ? get_user_by('email', $login) : false;
        if (!$user) { $user = get_user_by('login', $login); }
        if (!$user && is_email($login)) { $user = get_user_by('email', $login); }
        if ($user && function_exists('retrieve_password')) {
            // Core generates the reset key and sends the standard reset email.
            retrieve_password($user->user_login);
        }
    }
    return new WP_REST_Response(array('ok' => true), 200);
}

/* ---- private catalogue (approved only) ----------------------------- */

function glp_private_meta_query() {
    return array(array('key' => GLP_PRIVATE_PRODUCT_META, 'value' => 'yes', 'compare' => '='));
}

function glp_private_category_ids() {
    $q = new WP_Query(array(
        'post_type' => 'product', 'post_status' => 'publish', 'posts_per_page' => -1,
        'fields' => 'ids', 'no_found_rows' => true,
        'meta_query' => glp_private_meta_query(),
    ));
    $terms = array();
    foreach ($q->posts as $pid) {
        foreach (wp_get_post_terms($pid, 'product_cat', array('fields' => 'ids')) as $tid) {
            $terms[$tid] = true;
        }
    }
    return array_keys($terms);
}

function glp_rest_categories(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    $guard = glp_guard_approved($uid);
    if (is_wp_error($guard)) { return $guard; }

    $ids = glp_private_category_ids();
    if (empty($ids)) { return array('categories' => array()); }
    $terms = get_terms(array('taxonomy' => 'product_cat', 'include' => $ids, 'hide_empty' => false));
    $out = array();
    foreach ($terms as $t) {
        $out[] = array('id' => (string) $t->term_id, 'name' => $t->name);
    }
    return array('categories' => $out);
}

function glp_first_category($product_id) {
    $terms = wp_get_post_terms($product_id, 'product_cat');
    if (!empty($terms) && !is_wp_error($terms)) {
        return array('id' => (string) $terms[0]->term_id, 'name' => $terms[0]->name);
    }
    return array('id' => '', 'name' => '');
}

function glp_map_product($product, $detail = false) {
    $cat = glp_first_category($product->get_id());
    $qty = $product->get_stock_quantity();
    $stock_status = $product->is_in_stock()
        ? (($qty !== null && $qty <= 20) ? 'low_stock' : 'in_stock')
        : 'out_of_stock';
    $out = array(
        'id'            => (string) $product->get_id(),
        'name'          => $product->get_name(),
        'sku'           => $product->get_sku(),
        'type'          => $product->get_type(),
        'price'         => (float) $product->get_price(),
        'price_display' => wp_strip_all_tags(wc_price($product->get_price())),
        'category'      => $cat['name'],
        'category_id'   => $cat['id'],
        'stock_status'  => $stock_status,
        'stock_count'   => $qty,
        'image_url'     => wp_get_attachment_url($product->get_image_id()),
        'coa'           => function_exists('glp_coa_public') ? glp_coa_public($product->get_id()) : null,
    );
    // Variable products have no own price — show WooCommerce's price range.
    if ($product->is_type('variable')) {
        $out['price_display'] = wp_strip_all_tags($product->get_price_html());
    }
    if ($detail) {
        $out['description'] = wp_strip_all_tags($product->get_description());
        $out['attributes'] = array();
        $out['variations'] = array();
        if ($product->is_type('variable')) {
            // Selectable attribute axes (display labels + display option values).
            foreach ($product->get_variation_attributes() as $attr_name => $slugs) {
                $opts = array();
                foreach ($slugs as $slug) {
                    if (taxonomy_exists($attr_name) && $slug !== '') {
                        $t = get_term_by('slug', $slug, $attr_name);
                        $opts[] = $t ? $t->name : $slug;
                    } else {
                        $opts[] = $slug;
                    }
                }
                $out['attributes'][] = array('name' => wc_attribute_label($attr_name), 'options' => $opts);
            }
            // Concrete purchasable variations with real id/sku/price/stock/image.
            foreach ($product->get_available_variations() as $v) {
                $vprod = wc_get_product($v['variation_id']);
                if (!$vprod) { continue; }
                $vqty = $vprod->get_stock_quantity();
                $vss  = $vprod->is_in_stock()
                    ? (($vqty !== null && $vqty <= 20) ? 'low_stock' : 'in_stock')
                    : 'out_of_stock';
                $attrs = array();
                foreach ($v['attributes'] as $akey => $aval) {
                    $tax   = str_replace('attribute_', '', $akey);
                    $label = wc_attribute_label($tax);
                    $val   = $aval;
                    if (taxonomy_exists($tax) && $aval !== '') {
                        $t = get_term_by('slug', $aval, $tax);
                        if ($t) { $val = $t->name; }
                    }
                    $attrs[$label] = $val;
                }
                $vprice = (float) $vprod->get_price();
                $out['variations'][] = array(
                    'variation_id' => (string) $v['variation_id'],
                    'sku'          => $vprod->get_sku(),
                    'price'        => $vprice,
                    'price_display'=> wp_strip_all_tags(wc_price($vprice)),
                    'stock_status' => $vss,
                    'stock_count'  => $vqty,
                    'image_url'    => (!empty($v['image']['url']) ? $v['image']['url'] : $out['image_url']),
                    'attributes'   => $attrs,
                    'purchasable'  => (bool) ($v['is_purchasable'] && $v['is_in_stock']),
                );
            }
        }
    }
    return $out;
}

function glp_rest_catalogue(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    $guard = glp_guard_approved($uid);
    if (is_wp_error($guard)) { return $guard; }

    $query_args = array(
        'post_type' => 'product', 'post_status' => 'publish', 'posts_per_page' => 100,
        'fields' => 'ids', 'meta_query' => glp_private_meta_query(),
    );
    $search = sanitize_text_field((string) $req->get_param('search'));
    if ($search !== '') { $query_args['s'] = $search; }
    $category = (int) $req->get_param('category');
    if ($category > 0) {
        $query_args['tax_query'] = array(array(
            'taxonomy' => 'product_cat', 'field' => 'term_id', 'terms' => $category,
        ));
    }
    $q = new WP_Query($query_args);
    $out = array();
    foreach ($q->posts as $pid) {
        $p = wc_get_product($pid);
        if ($p) { $out[] = glp_map_product($p); }
    }
    return array('products' => $out);
}

function glp_rest_product(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    $guard = glp_guard_approved($uid);
    if (is_wp_error($guard)) { return $guard; }

    $id = (int) $req['id'];
    if (get_post_meta($id, GLP_PRIVATE_PRODUCT_META, true) !== 'yes') {
        return new WP_Error('glp_not_found', 'Not found', array('status' => 404));
    }
    $product = wc_get_product($id);
    if (!$product || $product->get_status() !== 'publish') {
        return new WP_Error('glp_not_found', 'Not found', array('status' => 404));
    }
    return array('product' => glp_map_product($product, true));
}

/* ---- customer-owned orders + AST shipment tracking ----------------- */

// Customer-facing shipment tracking via Advanced Shipment Tracking's OWN
// accessor (ast_get_tracking_items). Returns only customer-safe fields; internal
// AST fields (user_id/source/tracking_id/etc.) are dropped. We never construct
// or scrape a Royal Mail URL — the tracking URL comes from AST's own registry.
function glp_order_tracking($order) {
    $raw = array();
    if (function_exists('ast_get_tracking_items')) {
        $raw = ast_get_tracking_items($order->get_id());
    } elseif (function_exists('wc_ast_get_tracking_items')) {
        $raw = wc_ast_get_tracking_items($order->get_id());
    } else {
        $meta = $order->get_meta('_wc_shipment_tracking_items');
        if (is_array($meta)) { $raw = $meta; }
    }
    if (!is_array($raw)) { return array(); }

    $items = array();
    foreach ($raw as $t) {
        if (!is_array($t)) { continue; }
        $number = isset($t['tracking_number']) ? trim((string) $t['tracking_number']) : '';
        if ($number === '') { continue; }
        $provider = '';
        foreach (array('formatted_tracking_provider', 'custom_tracking_provider', 'tracking_provider') as $pk) {
            if (!empty($t[$pk])) { $provider = wp_strip_all_tags((string) $t[$pk]); break; }
        }
        $url = '';
        foreach (array('formatted_tracking_link', 'custom_tracking_link', 'tracking_link') as $lk) {
            if (!empty($t[$lk])) { $url = esc_url_raw((string) $t[$lk]); break; }
        }
        $date_shipped = null;
        if (!empty($t['date_shipped'])) {
            $ds = $t['date_shipped'];
            $ts = is_numeric($ds) ? (int) $ds : strtotime((string) $ds);
            if ($ts) { $date_shipped = gmdate('Y-m-d', $ts); }
        }
        $entry = array(
            'provider'        => $provider,
            'tracking_number' => $number,
            'date_shipped'    => $date_shipped,
        );
        if ($url !== '') { $entry['tracking_url'] = $url; }
        $items[] = $entry;
    }
    return $items;
}

function glp_map_order($order, $detail = false) {
    $status = $order->get_status();
    $out = array(
        'id'            => (string) $order->get_id(),
        'number'        => (string) $order->get_order_number(),
        'status'        => $status,
        'status_label'  => wc_get_order_status_name($status),
        'currency'      => $order->get_currency(),
        'total'         => (float) $order->get_total(),
        'total_display' => wp_strip_all_tags(wc_price($order->get_total(), array('currency' => $order->get_currency()))),
        'needs_payment' => (bool) $order->needs_payment(),
        'is_paid'       => (bool) $order->is_paid(),
        'date_created'  => $order->get_date_created() ? $order->get_date_created()->date('c') : null,
        'item_count'    => (int) $order->get_item_count(),
    );
    if ($detail) {
        $items = array();
        foreach ($order->get_items() as $it) {
            $line = array(
                'name'  => $it->get_name(),
                'qty'   => $it->get_quantity(),
                'total' => (float) $it->get_total(),
                'total_display' => wp_strip_all_tags(wc_price($it->get_total(), array('currency' => $order->get_currency()))),
            );
            $lprod = $it->get_product();
            if ($lprod) { $line['sku'] = $lprod->get_sku(); }
            $vid = (int) $it->get_variation_id();
            if ($vid) { $line['variation_id'] = (string) $vid; }
            $attrs = array();
            foreach ($it->get_meta_data() as $m) {
                $d   = $m->get_data();
                $key = isset($d['key']) ? (string) $d['key'] : '';
                if ($key === '' || $key[0] === '_') { continue; }
                $attrs[wc_attribute_label($key)] = is_scalar($d['value']) ? (string) $d['value'] : '';
            }
            if (!empty($attrs)) { $line['attributes'] = $attrs; }
            $items[] = $line;
        }
        $out['items'] = $items;
        $out['subtotal_display'] = wp_strip_all_tags(wc_price($order->get_subtotal(), array('currency' => $order->get_currency())));
        $out['shipping_display'] = wp_strip_all_tags(wc_price($order->get_shipping_total(), array('currency' => $order->get_currency())));
        $out['payment_method_title'] = $order->get_payment_method_title();
        $out['payment_method'] = $order->get_payment_method();
        $out['shipping_method_title'] = '';
        foreach ($order->get_shipping_methods() as $sm) {
            $out['shipping_method_title'] = wp_strip_all_tags($sm->get_method_title() ? $sm->get_method_title() : $sm->get_name());
            break;
        }
        if ($order->get_shipping_address_1()) {
            $out['shipping_address'] = array(
                'name'     => trim($order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name()),
                'line1'    => $order->get_shipping_address_1(),
                'line2'    => $order->get_shipping_address_2(),
                'city'     => $order->get_shipping_city(),
                'postcode' => $order->get_shipping_postcode(),
                'country'  => $order->get_shipping_country(),
            );
        }
        $tracking = glp_order_tracking($order);
        if (!empty($tracking)) { $out['tracking'] = $tracking; }
    }
    return apply_filters('glp_map_order', $out, $order, $detail);
}

// GET /orders : orders owned by the token user ONLY.
function glp_rest_orders(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    $guard = glp_guard_approved($uid);
    if (is_wp_error($guard)) { return $guard; }
    if (!function_exists('wc_get_orders')) {
        return new WP_Error('glp_no_wc', 'WooCommerce not active', array('status' => 500));
    }
    $orders = wc_get_orders(array(
        'customer_id' => $uid,
        'limit'       => 50,
        'orderby'     => 'date',
        'order'       => 'DESC',
    ));
    $out = array();
    foreach ($orders as $order) {
        $out[] = glp_map_order($order, false);
    }
    return glp_nocache_response(array('orders' => $out));
}

// GET /orders/{id} : IDOR-safe — only if the order belongs to the token user.
function glp_rest_order(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    $guard = glp_guard_approved($uid);
    if (is_wp_error($guard)) { return $guard; }
    if (!function_exists('wc_get_order')) {
        return new WP_Error('glp_no_wc', 'WooCommerce not active', array('status' => 500));
    }
    $order = wc_get_order((int) $req['id']);
    // 404 (not 403) so an attacker cannot distinguish "not yours" from "missing".
    if (!$order || (int) $order->get_customer_id() !== (int) $uid) {
        return new WP_Error('glp_not_found', 'Order not found', array('status' => 404));
    }
    return glp_nocache_response(array('order' => glp_map_order($order, true)));
}

// POST /account/shipping-address : save/replace the customer's default delivery
// address (billing mirrors shipping). Owner-scoped via token. No other changes.
function glp_rest_update_shipping_address(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    $guard = glp_guard_approved($uid);
    if (is_wp_error($guard)) { return $guard; }
    $a = $req->get_param('address');
    if (!is_array($a)) {
        return new WP_Error('glp_bad_address', 'Invalid address', array('status' => 400));
    }
    $first = trim((string) ($a['first_name'] ?? ''));
    $last  = trim((string) ($a['last_name'] ?? ''));
    if ($first === '' && $last === '') {
        $name  = trim((string) ($a['name'] ?? ''));
        $parts = $name !== '' ? explode(' ', $name, 2) : array('', '');
        $first = $parts[0];
        $last  = isset($parts[1]) ? $parts[1] : '';
    }
    $line1    = (string) ($a['line1'] ?? '');
    $line2    = (string) ($a['line2'] ?? '');
    $city     = (string) ($a['city'] ?? '');
    $postcode = (string) ($a['postcode'] ?? '');
    $country  = strtoupper((string) ($a['country'] ?? 'GB'));
    $phone    = (string) ($a['phone'] ?? '');

    // Write THROUGH the WooCommerce customer object so the account-level name,
    // billing AND shipping addresses all land on the REAL WooCommerce customer
    // record and its caches are invalidated immediately.
    if (class_exists('WC_Customer')) {
        try {
            $c = new WC_Customer($uid);
            if ($first !== '' || $last !== '') {
                $c->set_first_name($first);
                $c->set_last_name($last);
            }
            $c->set_billing_first_name($first);
            $c->set_billing_last_name($last);
            $c->set_billing_address_1($line1);
            $c->set_billing_address_2($line2);
            $c->set_billing_city($city);
            $c->set_billing_postcode($postcode);
            $c->set_billing_country($country);
            if ($phone !== '') { $c->set_billing_phone($phone); }
            $c->set_shipping_first_name($first);
            $c->set_shipping_last_name($last);
            $c->set_shipping_address_1($line1);
            $c->set_shipping_address_2($line2);
            $c->set_shipping_city($city);
            $c->set_shipping_postcode($postcode);
            $c->set_shipping_country($country);
            $c->save();
        } catch (\Throwable $e) {
            return new WP_Error('glp_save_failed', 'Could not save account details', array('status' => 500));
        }
    } else {
        // Fallback (WooCommerce not loaded): write meta directly.
        $meta = array(
            'first_name' => $first, 'last_name' => $last,
            'address_1' => $line1, 'address_2' => $line2, 'city' => $city,
            'postcode' => $postcode, 'country' => $country, 'phone' => $phone,
        );
        foreach ($meta as $k => $v) {
            update_user_meta($uid, 'shipping_' . $k, $v);
            update_user_meta($uid, 'billing_' . $k, $v);
        }
    }
    // Persist the WP core account name + display name so /me reflects it.
    if ($first !== '' || $last !== '') {
        $userdata = array('ID' => $uid, 'first_name' => $first, 'last_name' => $last);
        $display  = trim($first . ' ' . $last);
        if ($display !== '') { $userdata['display_name'] = $display; }
        $res = wp_update_user($userdata);
        if (is_wp_error($res)) {
            update_user_meta($uid, 'first_name', $first);
            update_user_meta($uid, 'last_name', $last);
        }
    }
    clean_user_cache($uid);

    $addr = array(
        'name' => trim($first . ' ' . $last),
        'line1' => $line1, 'line2' => $line2,
        'city' => $city, 'postcode' => $postcode,
        'country' => $country, 'phone' => $phone,
    );
    $user = get_user_by('id', $uid);
    return glp_nocache_response(array(
        'addresses' => array('shipping' => $addr, 'billing' => $addr),
        'customer'  => glp_public_customer($user),
    ));
}

/* ------------------------------------------------------------------ */
/* 5. Phase 2B — basket validation, order creation + native crypto     */
/*                                                                     */
/* The WooCommerce "Apeps Crypto Payments" plugin is the AUTHORITATIVE  */
/* payment engine. Per the compatibility decision we do NOT rename any  */
/* of its internal identifiers (namespace Apeps\Crypto, gateway id      */
/* apeps_crypto, _apeps_* order meta, invoice table). We only ADD       */
/* owner-scoped connector endpoints that reuse its classes. All crypto  */
/* endpoints are guarded so this connector still works if the plugin is */
/* inactive.                                                            */
/* ------------------------------------------------------------------ */

// Whether the crypto payment engine (plugin) is available on this site.
function glp_crypto_available() {
    return function_exists('apeps_crypto')
        && defined('APEPS_CRYPTO_GATEWAY_ID')
        && class_exists('\\Apeps\\Crypto\\Payment\\Invoice_Store')
        && class_exists('\\Apeps\\Crypto\\Providers\\Rates\\Rate_Manager');
}

// Re-derive ONE authoritative order line from a client {product_id, qty}. Prices,
// stock and eligibility come from WooCommerce; client-sent prices are ignored.
// Only products flagged into the GLP private app are orderable.
function glp_resolve_line($item) {
    $pid = isset($item['product_id']) ? absint($item['product_id']) : 0;
    $qty = isset($item['qty']) ? absint($item['qty']) : 0;
    $variation_id = isset($item['variation_id']) ? absint($item['variation_id']) : 0;
    $parent = $pid ? wc_get_product($pid) : null;
    $base = array(
        'product_id' => (string) $pid, 'variation_id' => (string) $variation_id, 'qty' => $qty,
        'name' => 'Unavailable item', 'sku' => '', 'price' => 0.0, 'price_display' => '',
        'attributes' => array(), 'line_total' => 0.0, 'line_total_display' => '',
        'stock_status' => 'unavailable', 'stock_count' => null, 'available' => false, 'issue' => 'not_available',
    );
    // Must exist, be published and be a private-app product.
    if (!$parent || $parent->get_status() !== 'publish'
        || get_post_meta($pid, GLP_PRIVATE_PRODUCT_META, true) !== 'yes') {
        return $base;
    }
    $base['name'] = $parent->get_name();
    // Variable product => a valid, matching variation is REQUIRED; simple product
    // must NOT carry a variation id. Price/stock/sku come from the resolved object.
    $product = $parent;
    if ($parent->is_type('variable')) {
        if (!$variation_id) { $base['issue'] = 'variation_required'; return $base; }
        $variation = wc_get_product($variation_id);
        if (!$variation || !$variation->is_type('variation') || (int) $variation->get_parent_id() !== $pid) {
            $base['issue'] = 'invalid_variation'; return $base;
        }
        $product = $variation;
        foreach ($variation->get_variation_attributes() as $akey => $aval) {
            $tax   = str_replace('attribute_', '', $akey);
            $label = wc_attribute_label($tax);
            $val   = $aval;
            if (taxonomy_exists($tax) && $aval !== '') {
                $t = get_term_by('slug', $aval, $tax);
                if ($t) { $val = $t->name; }
            }
            $base['attributes'][$label] = $val;
        }
    } elseif ($variation_id) {
        $base['issue'] = 'invalid_variation'; return $base;
    }
    $base['sku'] = $product->get_sku();
    if ($qty <= 0) { $base['issue'] = 'invalid'; return $base; }
    $price = (float) $product->get_price();
    $stock = $product->get_stock_quantity();
    $base['price'] = $price;
    $base['price_display'] = wp_strip_all_tags(wc_price($price));
    $base['stock_count'] = $stock;
    if (!$product->is_purchasable() || !$product->is_in_stock() || ($stock !== null && $stock <= 0)) {
        $base['stock_status'] = 'out_of_stock'; $base['issue'] = 'out_of_stock'; return $base;
    }
    if ($stock !== null && $qty > $stock) {
        $base['stock_status'] = 'insufficient_stock'; $base['issue'] = 'insufficient_stock'; return $base;
    }
    $line_total = round($price * $qty, 2);
    $base['stock_status'] = ($stock !== null && $stock <= 20) ? 'low_stock' : 'in_stock';
    $base['line_total'] = $line_total;
    $base['line_total_display'] = wp_strip_all_tags(wc_price($line_total));
    $base['available'] = true; $base['issue'] = null;
    return $base;
}

function glp_validate_items($items) {
    $lines = array();
    foreach ((array) $items as $it) { $lines[] = glp_resolve_line($it); }
    $subtotal = 0.0;
    foreach ($lines as $l) { if ($l['available']) { $subtotal += $l['line_total']; } }
    $subtotal = round($subtotal, 2);
    $valid = count($lines) > 0;
    $issues = array();
    foreach ($lines as $l) {
        if (!$l['available']) { $valid = false; $issues[] = array('product_id' => $l['product_id'], 'issue' => $l['issue']); }
    }
    return array(
        'currency' => get_woocommerce_currency(), 'items' => $lines,
        'subtotal' => $subtotal, 'subtotal_display' => wp_strip_all_tags(wc_price($subtotal)),
        'valid' => $valid, 'issues' => $issues,
    );
}

// POST /basket/validate
function glp_rest_validate_basket(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    $guard = glp_guard_approved($uid);
    if (is_wp_error($guard)) { return $guard; }
    if (!function_exists('wc_get_product')) {
        return new WP_Error('glp_no_wc', 'WooCommerce not active', array('status' => 500));
    }
    return glp_validate_basket_response($req);
}

function glp_validate_basket_response(WP_REST_Request $req) {
    $items = $req->get_param('items');
    return glp_validate_items($items);
}

// Read the customer's saved default shipping address (app shape).
function glp_saved_address($uid) {
    return array(
        'name'     => trim(get_user_meta($uid, 'shipping_first_name', true) . ' ' . get_user_meta($uid, 'shipping_last_name', true)),
        'line1'    => get_user_meta($uid, 'shipping_address_1', true),
        'line2'    => get_user_meta($uid, 'shipping_address_2', true),
        'city'     => get_user_meta($uid, 'shipping_city', true),
        'postcode' => get_user_meta($uid, 'shipping_postcode', true),
        'country'  => get_user_meta($uid, 'shipping_country', true) ?: 'GB',
        'phone'    => get_user_meta($uid, 'shipping_phone', true),
    );
}

// Apply addresses to the order. When $override (the checkout-edited address) is
// given it is used AND saved back as the customer's default shipping address;
// billing mirrors shipping. Otherwise the saved profile is used.
function glp_apply_addresses($order, $uid, $override) {
    $user = get_user_by('id', $uid);
    if (is_array($override)) {
        $name  = trim((string) ($override['name'] ?? ''));
        $parts = $name !== '' ? explode(' ', $name, 2) : array('', '');
        $addr = array(
            'first_name' => $parts[0],
            'last_name'  => isset($parts[1]) ? $parts[1] : '',
            'address_1'  => (string) ($override['line1'] ?? ''),
            'address_2'  => (string) ($override['line2'] ?? ''),
            'city'       => (string) ($override['city'] ?? ''),
            'postcode'   => (string) ($override['postcode'] ?? ''),
            'country'    => strtoupper((string) ($override['country'] ?? 'GB')),
            'phone'      => (string) ($override['phone'] ?? ''),
        );
        foreach ($addr as $k => $v) { // save back as default (shipping + mirrored billing)
            update_user_meta($uid, 'shipping_' . $k, $v);
            update_user_meta($uid, 'billing_' . $k, $v);
        }
        $billing = $addr; $billing['email'] = $user ? $user->user_email : '';
        $order->set_address($billing, 'billing');
        $order->set_address($addr, 'shipping');
        return;
    }
    $billing = array(
        'first_name' => get_user_meta($uid, 'billing_first_name', true),
        'last_name'  => get_user_meta($uid, 'billing_last_name', true),
        'company'    => get_user_meta($uid, 'billing_company', true),
        'address_1'  => get_user_meta($uid, 'billing_address_1', true),
        'address_2'  => get_user_meta($uid, 'billing_address_2', true),
        'city'       => get_user_meta($uid, 'billing_city', true),
        'postcode'   => get_user_meta($uid, 'billing_postcode', true),
        'country'    => get_user_meta($uid, 'billing_country', true) ?: 'GB',
        'email'      => $user ? $user->user_email : '',
        'phone'      => get_user_meta($uid, 'billing_phone', true),
    );
    $shipping = array(
        'first_name' => get_user_meta($uid, 'shipping_first_name', true),
        'last_name'  => get_user_meta($uid, 'shipping_last_name', true),
        'company'    => get_user_meta($uid, 'shipping_company', true),
        'address_1'  => get_user_meta($uid, 'shipping_address_1', true),
        'address_2'  => get_user_meta($uid, 'shipping_address_2', true),
        'city'       => get_user_meta($uid, 'shipping_city', true),
        'postcode'   => get_user_meta($uid, 'shipping_postcode', true),
        'country'    => get_user_meta($uid, 'shipping_country', true) ?: 'GB',
    );
    $order->set_address($billing, 'billing');
    $order->set_address($shipping, 'shipping');
}

// Build a WooCommerce shipping package from authoritative products + destination.
function glp_build_package($lines, $address, $uid) {
    $contents = array();
    $cost = 0.0;
    foreach ($lines as $line) {
        if (empty($line['available'])) { continue; }
        $vid     = isset($line['variation_id']) ? (int) $line['variation_id'] : 0;
        $product = wc_get_product($vid ?: (int) $line['product_id']);
        if (!$product) { continue; }
        $qty   = (int) $line['qty'];
        $price = (float) $product->get_price();
        $contents[$product->get_id()] = array(
            'data' => $product, 'quantity' => $qty,
            'line_total' => $price * $qty, 'line_subtotal' => $price * $qty,
            'line_tax' => 0, 'line_subtotal_tax' => 0,
        );
        $cost += $price * $qty;
    }
    return array(
        'contents' => $contents, 'contents_cost' => $cost, 'applied_coupons' => array(),
        'user' => array('ID' => $uid), 'cart_subtotal' => $cost,
        'destination' => array(
            'country'   => strtoupper((string) ($address['country'] ?? 'GB')),
            'state'     => '',
            'postcode'  => (string) ($address['postcode'] ?? ''),
            'city'      => (string) ($address['city'] ?? ''),
            'address'   => (string) ($address['line1'] ?? ''),
            'address_2' => (string) ($address['line2'] ?? ''),
        ),
    );
}

// Available WooCommerce shipping rates for a package (zone-matched, enabled only).
function glp_shipping_rates_for_package($package) {
    if (!class_exists('WC_Shipping_Zones')) { return array(); }
    $zone = WC_Shipping_Zones::get_zone_matching_package($package);
    $out  = array();
    foreach ($zone->get_shipping_methods(true) as $method) {
        if (!is_a($method, 'WC_Shipping_Method')) { continue; }
        if (method_exists($method, 'is_available') && !$method->is_available($package)) { continue; }
        $rates = $method->get_rates_for_package($package);
        if (!$rates) { continue; }
        foreach ($rates as $rate_id => $rate) {
            $out[] = array(
                'id'    => (string) $rate_id,
                'label' => wp_strip_all_tags($rate->get_label()),
                'cost'  => round((float) $rate->get_cost(), 2),
                'rate'  => $rate,
            );
        }
    }
    return apply_filters('glp_shipping_rates', $out, $package);
}

// POST /shipping/quote : server-side WooCommerce methods + costs for the basket.
function glp_rest_shipping_quote(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    $guard = glp_guard_approved($uid);
    if (is_wp_error($guard)) { return $guard; }
    if (!function_exists('wc_get_product')) {
        return new WP_Error('glp_no_wc', 'WooCommerce not active', array('status' => 500));
    }
    $validation = glp_validate_items($req->get_param('items'));
    $address    = $req->get_param('address');
    if (!is_array($address)) { $address = glp_saved_address($uid); }
    $package = glp_build_package($validation['items'], $address, $uid);
    $rates   = glp_shipping_rates_for_package($package);
    $methods = array();
    foreach ($rates as $r) {
        $methods[] = array(
            'id' => $r['id'], 'label' => $r['label'], 'cost' => $r['cost'],
            'cost_display' => wp_strip_all_tags(wc_price($r['cost'])),
        );
    }
    return array(
        'currency'             => get_woocommerce_currency(),
        'subtotal'             => $validation['subtotal'],
        'subtotal_display'     => $validation['subtotal_display'],
        'destination_country'  => strtoupper((string) ($address['country'] ?? 'GB')),
        'available'            => !empty($methods),
        'methods'              => $methods,
    );
}

// Initiate the plugin's crypto invoice lifecycle for a freshly-built order.
// Mirrors Apeps\Crypto\Gateway\Gateway::process_payment() (rate lock, exact
// USDT amount, invoice row, _apeps_* meta) WITHOUT duplicating rate/blockchain
// logic. Returns true on success, or a WP_Error to abort order creation.
function glp_start_crypto_invoice($order, $network) {
    $wallet = $network->get_wallet_address();
    if ('' === $wallet) {
        return new WP_Error('glp_network_unconfigured', 'Network not fully configured', array('status' => 400));
    }
    $currency = $order->get_currency();
    $total    = (float) $order->get_total();
    $manager  = new \Apeps\Crypto\Providers\Rates\Rate_Manager();
    $conv     = $manager->convert($total, $currency, $network->get_token_symbol());
    if (!$conv) {
        return new WP_Error('glp_rate_unavailable', 'Live exchange rate unavailable', array('status' => 503));
    }
    $settings       = get_option('woocommerce_' . APEPS_CRYPTO_GATEWAY_ID . '_settings', array());
    $expiry_minutes = max(5, absint(isset($settings['invoice_expiry']) ? $settings['invoice_expiry'] : 20));
    $now            = current_time('timestamp', true);

    $store = new \Apeps\Crypto\Payment\Invoice_Store();
    $store->create(array(
        'order_id'               => $order->get_id(),
        'network'                => $network->get_id(),
        'token'                  => $network->get_token_symbol(),
        'address'                => $wallet,
        'fiat_currency'          => $currency,
        'fiat_total'             => $total,
        'crypto_amount'          => $conv['amount'],
        'exchange_rate'          => $conv['rate'],
        'markup'                 => $conv['markup'],
        'rate_provider'          => $conv['provider'],
        'required_confirmations' => $network->get_default_confirmations(),
        'status'                 => \Apeps\Crypto\Payment\Invoice::STATUS_AWAITING,
        'rate_locked_at'         => gmdate('Y-m-d H:i:s', $now),
        'expires_at'             => gmdate('Y-m-d H:i:s', $now + ($expiry_minutes * 60)),
    ));

    $order->update_meta_data('_apeps_network', $network->get_label());
    $order->update_meta_data('_apeps_wallet', $wallet);
    $order->update_meta_data('_apeps_token', $network->get_token_symbol());
    $order->update_meta_data('_apeps_exchange_rate', $conv['rate']);
    $order->update_meta_data('_apeps_crypto_amount', $conv['amount']);
    $order->set_payment_method(APEPS_CRYPTO_GATEWAY_ID);
    $order->set_payment_method_title(sprintf('%s (USDT)', $network->get_label()));
    return true;
}

// POST /orders : create a PENDING order owned by the token user, with authoritative
// WC prices. When payment_method=crypto a USDT invoice is initiated via the plugin.
function glp_rest_create_order(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    $guard = glp_guard_approved($uid);
    if (is_wp_error($guard)) { return $guard; }
    if (!function_exists('wc_create_order')) {
        return new WP_Error('glp_no_wc', 'WooCommerce not active', array('status' => 500));
    }

    $client_ref = sanitize_text_field((string) $req->get_param('client_ref'));

    // Idempotency: a repeated client_ref returns the already-created order.
    if ($client_ref !== '') {
        $existing = wc_get_orders(array(
            'customer_id' => $uid, 'limit' => 1,
            'meta_key' => '_glp_client_ref', 'meta_value' => $client_ref,
        ));
        if (!empty($existing)) {
            return array('order' => glp_map_order($existing[0], true));
        }
    }

    $validation = glp_validate_items($req->get_param('items'));
    if (!$validation['valid']) {
        return new WP_REST_Response(array('error' => 'basket_invalid', 'validation' => $validation), 409);
    }

    $payment_method = sanitize_text_field((string) $req->get_param('payment_method'));
    $network_id     = sanitize_text_field((string) $req->get_param('network'));
    $network        = null;
    $is_crypto      = ($payment_method === 'crypto');

    if ($is_crypto) {
        if (!glp_crypto_available()) {
            return new WP_Error('glp_crypto_unavailable', 'Crypto payments are not available.', array('status' => 503));
        }
        $registry = apeps_crypto()->networks();
        $network  = $registry->get($network_id);
        $enabled  = $registry->enabled();
        if (!$network || !isset($enabled[$network_id])) {
            return new WP_Error('glp_invalid_network', 'Unsupported crypto network.', array('status' => 400));
        }
    }

    // Delivery address (edited at checkout) — used for the order AND saved back
    // as the customer's default (billing mirrors shipping). Shipping method is a
    // WooCommerce rate id re-validated + priced server-side (client cost ignored).
    $shipping_address = $req->get_param('shipping_address');
    $shipping_method  = sanitize_text_field((string) $req->get_param('shipping_method'));

    // Build the order from authoritative product data.
    $order = wc_create_order(array('customer_id' => $uid));
    if (is_wp_error($order)) {
        return new WP_Error('glp_order_failed', 'Could not create order.', array('status' => 500));
    }
    foreach ($validation['items'] as $line) {
        $vid     = isset($line['variation_id']) ? (int) $line['variation_id'] : 0;
        $product = wc_get_product($vid ?: (int) $line['product_id']);
        if ($product) { $order->add_product($product, (int) $line['qty']); }
    }
    glp_apply_addresses($order, $uid, is_array($shipping_address) ? $shipping_address : null);

    if ($shipping_method !== '' || is_array($shipping_address)) {
        $addr_for_pkg = is_array($shipping_address) ? $shipping_address : glp_saved_address($uid);
        $package = glp_build_package($validation['items'], $addr_for_pkg, $uid);
        $rates   = glp_shipping_rates_for_package($package);
        if (empty($rates)) {
            return new WP_REST_Response(array('error' => 'shipping_unavailable'), 400);
        }
        if ($shipping_method === '') {
            return new WP_REST_Response(array('error' => 'shipping_required'), 400);
        }
        $chosen = null;
        foreach ($rates as $r) { if ($r['id'] === $shipping_method) { $chosen = $r; break; } }
        if (!$chosen) {
            return new WP_REST_Response(array('error' => 'invalid_shipping'), 400);
        }
        $ship_item = new WC_Order_Item_Shipping();
        $ship_item->set_shipping_rate($chosen['rate']); // authoritative cost/title/taxes
        $order->add_item($ship_item);
    }

    $order->calculate_totals();
    if ($client_ref !== '') { $order->update_meta_data('_glp_client_ref', $client_ref); }

    if ($is_crypto) {
        $started = glp_start_crypto_invoice($order, $network);
        if (is_wp_error($started)) { return $started; }
    }
    $order->update_status('pending', $is_crypto ? __('Awaiting USDT crypto payment.', 'glp') : '');
    $order->save();

    return array('order' => glp_map_order($order, true));
}

// GET /crypto/networks : customer-safe list of ENABLED networks (no wallet config).
function glp_rest_crypto_networks(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    $guard = glp_guard_approved($uid);
    if (is_wp_error($guard)) { return $guard; }
    if (!glp_crypto_available()) { return array('networks' => array()); }
    $out = array();
    foreach (apeps_crypto()->networks()->enabled() as $network) {
        $out[] = $network->to_public_array(); // id,label,chain,standard,token only
    }
    return array('networks' => $out);
}

// Resolve an owner-scoped invoice or a 404 WP_Error. Ownership is derived from
// the token user vs the order's customer id — NEVER the WooCommerce order key.
function glp_owned_invoice_or_404($req, $uid) {
    $order = wc_get_order((int) $req['id']);
    if (!$order || (int) $order->get_customer_id() !== (int) $uid) {
        return new WP_Error('glp_not_found', 'Order not found', array('status' => 404));
    }
    if (!glp_crypto_available()) {
        return new WP_Error('glp_not_found', 'Order not found', array('status' => 404));
    }
    $store   = new \Apeps\Crypto\Payment\Invoice_Store();
    $invoice = $store->get_by_order($order->get_id());
    if (!$invoice) {
        return new WP_Error('glp_not_found', 'Order not found', array('status' => 404));
    }
    return array($order, $invoice);
}

// Build the public invoice payload + payment_uri for the QR.
function glp_public_invoice($invoice) {
    $data    = $invoice->to_public_array();
    $network = apeps_crypto()->networks()->get($invoice->network);
    if ($network) {
        $data['payment_uri']   = $network->get_payment_uri($invoice->address, $invoice->crypto_amount);
        $data['network_label'] = $network->get_label();
    }
    return $data;
}

// GET /orders/{id}/crypto-invoice : owner-scoped public invoice (non-owner → 404).
// Drive the plugin's OWN authoritative monitor from the normal auto-poll so a
// non-final invoice progresses (detected → confirming → complete) WITHOUT the
// customer having to press "Check payment now" repeatedly. This does NOT
// duplicate any blockchain/rate logic — it simply calls the same Payment_Monitor
// the manual recheck and WP-Cron use. It is throttled per-invoice and applies
// only in the crypto gateway's Test Mode; real-mode progression is left to
// WP-Cron + the manual fallback (real blockchain behaviour is unchanged).
function glp_auto_progress_invoice($order, $invoice) {
    if (method_exists($invoice, 'is_final') && $invoice->is_final()) { return $invoice; }
    if (!class_exists('\\Apeps\\Crypto\\Payment\\Payment_Monitor')) { return $invoice; }
    $settings  = get_option('woocommerce_' . APEPS_CRYPTO_GATEWAY_ID . '_settings', array());
    $test_mode = (isset($settings['test_mode']) && $settings['test_mode'] === 'yes');
    if (!$test_mode) { return $invoice; }
    $throttle_key = 'glp_poll_mon_' . $invoice->id;
    if (get_transient($throttle_key)) { return $invoice; }
    set_transient($throttle_key, 1, 4); // at most ~once every 4s per invoice
    try {
        (new \Apeps\Crypto\Payment\Payment_Monitor())->process($invoice);
        $store = new \Apeps\Crypto\Payment\Invoice_Store();
        $fresh = $store->get_by_order($order->get_id());
        if ($fresh) { $invoice = $fresh; }
    } catch (\Throwable $e) {
        // Leave state as-is; WP-Cron + manual recheck remain authoritative.
    }
    return $invoice;
}

function glp_rest_crypto_invoice(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    $guard = glp_guard_approved($uid);
    if (is_wp_error($guard)) { return $guard; }
    $resolved = glp_owned_invoice_or_404($req, $uid);
    if (is_wp_error($resolved)) { return $resolved; }
    list($order, $invoice) = $resolved;
    $invoice = glp_auto_progress_invoice($order, $invoice); // auto-poll drives progression
    $data = glp_public_invoice($invoice);
    // Non-secret observability: `server_time` MUST change on every poll — if it is
    // identical across polls the GET is being served from a cache in front of WP
    // (e.g. SiteGround Dynamic Cache), which would stop the monitor being driven.
    $data['server_time'] = gmdate('c');
    $settings = get_option('woocommerce_' . APEPS_CRYPTO_GATEWAY_ID . '_settings', array());
    $test_mode = (isset($settings['test_mode']) && 'yes' === $settings['test_mode']);
    $data['test_mode'] = $test_mode;
    if ($test_mode) {
        $data['test_poll_count'] = (int) get_transient('apeps_sim_polls_' . $invoice->id);
    }
    // Never let a cache serve a stale invoice read.
    return glp_nocache_response(array('invoice' => $data));
}

// Build a REST response with aggressive no-cache headers so no dynamic/edge cache
// (SiteGround Dynamic Cache, Cloudflare, nginx) serves a stale polled invoice.
function glp_nocache_response($data, $status = 200) {
    $r = new WP_REST_Response($data, $status);
    $r->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    $r->header('Pragma', 'no-cache');
    $r->header('Expires', '0');
    $r->header('X-Accel-Expires', '0');
    return $r;
}

// POST /orders/{id}/crypto-recheck : owner-scoped, rate-limited manual recheck.
// Automatic monitoring stays authoritative; this only nudges the plugin engine.
function glp_rest_crypto_recheck(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    $guard = glp_guard_approved($uid);
    if (is_wp_error($guard)) { return $guard; }
    $resolved = glp_owned_invoice_or_404($req, $uid);
    if (is_wp_error($resolved)) { return $resolved; }
    list($order, $invoice) = $resolved;

    // Already final → report current state without work / rate limiting.
    if ($invoice->is_final()) {
        return array('invoice' => glp_public_invoice($invoice));
    }

    $settings = get_option('woocommerce_' . APEPS_CRYPTO_GATEWAY_ID . '_settings', array());
    $cooldown = min(120, max(30, absint(isset($settings['manual_recheck_cooldown']) ? $settings['manual_recheck_cooldown'] : 45)));
    $rl_key   = 'glp_recheck_rl_' . $invoice->id;
    $until    = (int) get_transient($rl_key);
    if ($until && $until > time()) {
        $data = glp_public_invoice($invoice);
        $data['retry_after'] = max(1, $until - time());
        $data['recheck_message'] = __('Please wait a moment before checking again.', 'glp');
        return new WP_REST_Response(array('invoice' => $data), 429);
    }
    set_transient($rl_key, time() + $cooldown, $cooldown);

    if (class_exists('\\Apeps\\Crypto\\Payment\\Payment_Monitor')) {
        try {
            $invoice = (new \Apeps\Crypto\Payment\Payment_Monitor())->process($invoice);
        } catch (\Throwable $e) {
            // Providers unavailable: automatic checking continues; return last state.
        }
    }
    return array('invoice' => glp_public_invoice($invoice));
}

/* ------------------------------------------------------------------ */
/* 5b. Change crypto network / cancel — UNPAID orders only             */
/*                                                                     */
/* Both are hard-blocked once ANY payment/partial is detected on-chain */
/* (glp_invoice_payment_detected). They do NOT touch amount matching,  */
/* confirmations, monitoring, rates or provider logic.                 */
/* ------------------------------------------------------------------ */

// True once ANY on-chain payment/partial is reflected in the invoice. Only
// awaiting/expired/failed are treated as "no funds have arrived".
function glp_invoice_payment_detected($invoice) {
    $pub    = method_exists($invoice, 'to_public_array') ? $invoice->to_public_array() : array();
    $paid   = isset($pub['amount_paid']) ? (float) $pub['amount_paid'] : 0.0;
    $status = isset($pub['status']) ? (string) $pub['status'] : '';
    if ($paid > 0) { return true; }
    return !in_array($status, array('awaiting_payment', 'awaiting', 'expired', 'failed', 'cancelled'), true);
}

// POST /orders/{id}/crypto-network : switch an UNPAID crypto order between the
// enabled USDT networks on the SAME WooCommerce order (no duplicate order).
function glp_rest_change_crypto_network(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    $guard = glp_guard_approved($uid);
    if (is_wp_error($guard)) { return $guard; }
    if (!glp_crypto_available()) {
        return new WP_Error('glp_crypto_unavailable', 'Crypto payments are not available.', array('status' => 503));
    }
    $order = wc_get_order((int) $req['id']);
    if (!$order || (int) $order->get_customer_id() !== (int) $uid) {
        return new WP_Error('glp_not_found', 'Order not found', array('status' => 404));
    }
    if ($order->is_paid() || !$order->needs_payment()
        || in_array($order->get_status(), array('cancelled', 'refunded', 'completed', 'processing', 'on-hold'), true)) {
        return new WP_Error('glp_not_switchable', 'This order can no longer change network.', array('status' => 409));
    }
    $store   = new \Apeps\Crypto\Payment\Invoice_Store();
    $invoice = $store->get_by_order($order->get_id());
    if (!$invoice) {
        return new WP_Error('glp_not_found', 'Order not found', array('status' => 404));
    }
    if (glp_invoice_payment_detected($invoice)) {
        return new WP_Error('glp_payment_detected', 'A payment has already been detected for this order.', array('status' => 409));
    }
    $network_id = sanitize_text_field((string) $req->get_param('network'));
    $registry   = apeps_crypto()->networks();
    $network    = $registry->get($network_id);
    $enabled    = $registry->enabled();
    if (!$network || !isset($enabled[$network_id])) {
        return new WP_Error('glp_invalid_network', 'Unsupported crypto network.', array('status' => 400));
    }
    if ($network_id === (string) $invoice->network) {
        return glp_nocache_response(array('invoice' => glp_public_invoice($invoice)));
    }
    // Replace the invoice on the SAME order with one for the new network.
    if (method_exists($store, 'delete_by_order')) {
        $store->delete_by_order($order->get_id());
    }
    $started = glp_start_crypto_invoice($order, $network);
    if (is_wp_error($started)) { return $started; }
    $order->save();
    $fresh = $store->get_by_order($order->get_id());
    return glp_nocache_response(array('invoice' => glp_public_invoice($fresh ? $fresh : $invoice)));
}

// POST /orders/{id}/cancel : customer-cancel an UNPAID order. Blocked once any
// payment/partial is detected. Sets the WooCommerce order status to 'cancelled'.
function glp_rest_cancel_order(WP_REST_Request $req) {
    $uid = glp_authed_user_or_error($req);
    if (is_wp_error($uid)) { return $uid; }
    $guard = glp_guard_approved($uid);
    if (is_wp_error($guard)) { return $guard; }
    $order = wc_get_order((int) $req['id']);
    if (!$order || (int) $order->get_customer_id() !== (int) $uid) {
        return new WP_Error('glp_not_found', 'Order not found', array('status' => 404));
    }
    if ($order->is_paid() || in_array($order->get_status(), array('cancelled', 'refunded', 'completed', 'processing'), true)) {
        return new WP_Error('glp_not_cancellable', 'This order can no longer be cancelled.', array('status' => 409));
    }
    if (glp_crypto_available() && class_exists('\\Apeps\\Crypto\\Payment\\Invoice_Store')) {
        $store   = new \Apeps\Crypto\Payment\Invoice_Store();
        $invoice = $store->get_by_order($order->get_id());
        if ($invoice && glp_invoice_payment_detected($invoice)) {
            return new WP_Error('glp_payment_detected', 'A payment has already been detected for this order.', array('status' => 409));
        }
    }
    $order->update_status('cancelled', __('Cancelled by customer from the app.', 'glp'));
    $order->save();
    return glp_nocache_response(array('order' => glp_map_order($order, true)));
}

/* ------------------------------------------------------------------ */
/* 6. READ-ONLY crypto availability diagnostic (no secrets exposed)    */
/*                                                                     */
/* Explains WHY GET /crypto/networks may be empty. Shared-secret gated,*/
/* returns only booleans + public network ids/labels. It NEVER returns */
/* wallet addresses, private keys or API keys. A network is offered at */
/* checkout only when it is BOTH selected in the gateway's "Supported  */
/* Networks" (enabled_networks) AND has a receiving wallet configured. */
/* ------------------------------------------------------------------ */
function glp_rest_crypto_diagnostics(WP_REST_Request $req) {
    if (!glp_crypto_available()) {
        return array(
            'crypto_available' => false,
            'gateway_id'       => defined('APEPS_CRYPTO_GATEWAY_ID') ? APEPS_CRYPTO_GATEWAY_ID : null,
            'message'          => 'Apeps Crypto Payments plugin is not active/available to the connector.',
        );
    }
    $gateway_id       = APEPS_CRYPTO_GATEWAY_ID;
    $option_key       = 'woocommerce_' . $gateway_id . '_settings';
    $raw              = get_option($option_key, null);
    $settings         = is_array($raw) ? $raw : array();
    $enabled_networks = isset($settings['enabled_networks']) ? (array) $settings['enabled_networks'] : array();

    $registry = apeps_crypto()->networks();
    $nets = array();
    foreach ($registry->all() as $id => $network) {
        $nets[] = array(
            'id'                   => (string) $id,
            'label'                => $network->get_label(),
            'in_supported_setting' => in_array($id, $enabled_networks, true), // in "Supported Networks"
            'is_enabled'           => method_exists($network, 'is_enabled') ? (bool) $network->is_enabled() : null,
            'has_wallet'           => ('' !== $network->get_wallet_address()), // bool only; address NOT exposed
        );
    }
    return array(
        'crypto_available'         => true,
        'gateway_id'               => $gateway_id,
        'settings_option_key'      => $option_key,
        'settings_option_exists'   => is_array($raw),
        'gateway_master_enabled'   => (isset($settings['enabled']) && $settings['enabled'] === 'yes'),
        'test_mode'                => (isset($settings['test_mode']) && $settings['test_mode'] === 'yes'),
        'enabled_networks_setting' => array_values($enabled_networks),
        'registered_networks'      => $nets,
        'enabled_count'            => count($registry->enabled()),
    );
}

/* ------------------------------------------------------------------ */
/* 7. READ-ONLY receiving-wallet validation (no full address exposed)  */
/*                                                                     */
/* Shared-secret gated. Structurally validates each configured         */
/* receiving wallet against its network (TRC20: T + 33 base58 chars;   */
/* ERC20: 0x + 40 hex) so a mistyped address can be caught BEFORE it is */
/* used. Returns valid/invalid + a MASKED preview (first6…last4) only — */
/* it NEVER returns the full wallet address, and it does NOT change any */
/* payment/monitoring logic (addresses are still owned by the gateway). */
/* ------------------------------------------------------------------ */
function glp_rest_wallet_validation(WP_REST_Request $req) {
    if (!glp_crypto_available()) {
        return glp_nocache_response(array('crypto_available' => false, 'wallets' => array()));
    }
    $registry = apeps_crypto()->networks();
    $out = array();
    foreach ($registry->all() as $id => $network) {
        $addr = (string) $network->get_wallet_address();
        $std  = method_exists($network, 'get_standard') ? strtoupper((string) $network->get_standard()) : '';
        $out[] = array(
            'id'         => (string) $id,
            'label'      => $network->get_label(),
            'standard'   => $std,
            'configured' => ($addr !== ''),
            'valid'      => glp_wallet_structurally_valid($addr, (string) $id, $std),
            'preview'    => glp_mask_wallet($addr),
        );
    }
    return glp_nocache_response(array('crypto_available' => true, 'wallets' => $out));
}

// TRC20: base58 'T' + 33 chars. ERC20: '0x' + 40 hex. Network resolved from the
// gateway's declared standard, falling back to the network id.
function glp_wallet_structurally_valid($addr, $id, $standard) {
    if ($addr === '') { return false; }
    $is_tron = ($standard === 'TRC20') || (stripos($id, 'tron') !== false) || (stripos($id, 'trc') !== false);
    $is_eth  = ($standard === 'ERC20') || (stripos($id, 'eth') !== false) || (stripos($id, 'erc') !== false);
    if ($is_tron) { return (bool) preg_match('/^T[1-9A-HJ-NP-Za-km-z]{33}$/', $addr); }
    if ($is_eth)  { return (bool) preg_match('/^0x[0-9a-fA-F]{40}$/', $addr); }
    return false;
}

// Mask so the admin can confirm the right wallet is set without exposing it.
function glp_mask_wallet($addr) {
    $len = strlen($addr);
    if ($len === 0) { return ''; }
    if ($len <= 10) { return str_repeat('•', $len); }
    return substr($addr, 0, 6) . '…' . substr($addr, -4);
}


/* ------------------------------------------------------------------ */
/* 6. Self-registration + mandatory Telegram username + auto-approval  */
/*                                                                     */
/* Members register in-app with a REQUIRED Telegram username. A valid  */
/* handle auto-approves (sets _glp_app_approved=yes + adds glp_customer */
/* role) and returns the same {customer, token} contract as /session.  */
/* Still gated by the shared app secret (called only via the trusted    */
/* backend proxy, never a browser).                                    */
/* ------------------------------------------------------------------ */

add_action('rest_api_init', function () {
    register_rest_route('glp/v1', '/register', array(
        'methods'             => 'POST',
        'permission_callback' => 'glp_require_app_secret',
        'callback'            => 'glp_rest_register',
    ));
});

// Normalise + validate a Telegram username (strip leading @, lowercase,
// allow-list a-z/0-9/_ , 5-32 chars). Returns normalised value or WP_Error.
function glp_normalize_telegram($raw) {
    if (!is_string($raw)) {
        return new WP_Error('telegram_invalid', 'Telegram username is required.', array('status' => 400));
    }
    $value = strtolower(ltrim(trim($raw), '@'));
    if ($value === '' || !preg_match('/^[a-z0-9_]{5,32}$/', $value)) {
        return new WP_Error('telegram_invalid', 'Use 5-32 letters, numbers or underscores for your Telegram username.', array('status' => 400));
    }
    return $value;
}

function glp_rest_register(WP_REST_Request $req) {
    $email     = sanitize_email((string) $req->get_param('email'));
    $password  = (string) $req->get_param('password');
    $first     = sanitize_text_field((string) $req->get_param('first_name'));
    $last      = sanitize_text_field((string) $req->get_param('last_name'));
    $telegram  = glp_normalize_telegram((string) $req->get_param('telegram_username'));

    if (!is_email($email) || strlen($password) < 8) {
        return new WP_REST_Response(array('error' => 'invalid_input',
            'message' => 'Enter a valid email and a password of at least 8 characters.'), 400);
    }
    if (is_wp_error($telegram)) {
        return new WP_REST_Response(array('error' => 'telegram_invalid',
            'message' => $telegram->get_error_message()), 400);
    }
    // One account per Telegram username.
    $dupe = get_users(array('meta_key' => GLP_TELEGRAM_META, 'meta_value' => $telegram,
        'number' => 1, 'fields' => 'ID'));
    if (!empty($dupe)) {
        return new WP_REST_Response(array('error' => 'telegram_taken',
            'message' => 'That Telegram username is already registered.'), 409);
    }
    if (email_exists($email)) {
        return new WP_REST_Response(array('error' => 'cannot_register',
            'message' => 'An account with those details already exists.'), 409);
    }

    if (function_exists('wc_create_new_customer')) {
        $user_id = wc_create_new_customer($email, '', $password, array(
            'first_name' => $first, 'last_name' => $last,
        ));
    } else {
        $user_id = wp_insert_user(array(
            'user_login' => $email, 'user_email' => $email, 'user_pass' => $password,
            'first_name' => $first, 'last_name' => $last, 'role' => 'customer',
        ));
    }
    if (is_wp_error($user_id)) {
        return new WP_REST_Response(array('error' => 'cannot_register',
            'message' => 'We could not create an account with those details.'), 400);
    }

    // Store Telegram + auto-approve (valid handle grants access).
    update_user_meta($user_id, GLP_TELEGRAM_META, $telegram);
    update_user_meta($user_id, GLP_APP_APPROVED_META, 'yes');
    $user = new WP_User($user_id);
    if (!in_array('glp_customer', (array) $user->roles, true)) {
        $user->add_role('glp_customer');
    }

    return new WP_REST_Response(array(
        'customer' => glp_public_customer(get_user_by('id', $user_id)),
        'token'    => glp_issue_token($user_id),
    ), 201);
}
