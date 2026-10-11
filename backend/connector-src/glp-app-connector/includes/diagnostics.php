<?php
/**
 * GLP App Connector — v2.1.2 email lifecycle diagnostics (read-only, staff-only).
 *
 * Records, for Pentarchy app orders, which WooCommerce order/email hooks fire
 * and every wp_mail attempt / result, in a small ring buffer (option
 * `glp_email_debug`, last 300 events). Exposed ONLY via
 *   GET /glp/v1/fulfilment/debug/emails?order=ID
 * which requires the app secret + a staff token with glp_fulfil_orders.
 * Records no message bodies, only recipient/subject/hook names.
 */

if (!defined('ABSPATH')) { exit; }

function glp_dbg_context() {
    if (defined('REST_REQUEST') && REST_REQUEST) {
        $uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
        $uri = preg_replace('/[?].*$/', '', $uri);
        return 'rest:' . substr($uri, 0, 120);
    }
    if (wp_doing_cron()) { return 'cron'; }
    if (wp_doing_ajax()) { return 'ajax:' . (isset($_REQUEST['action']) ? sanitize_key($_REQUEST['action']) : ''); }
    if (is_admin()) { return 'admin'; }
    return 'front';
}

function glp_dbg($event, $order_id = 0, $data = array()) {
    $log = get_option('glp_email_debug', array());
    if (!is_array($log)) { $log = array(); }
    $log[] = array(
        't' => gmdate('c'), 'order' => (int) $order_id, 'event' => $event,
        'ctx' => glp_dbg_context(), 'data' => $data,
    );
    if (count($log) > 300) { $log = array_slice($log, -300); }
    update_option('glp_email_debug', $log, false);
}

function glp_dbg_is_app($order) {
    return $order instanceof WC_Order && function_exists('glp_is_app_order') && glp_is_app_order($order);
}

add_action('woocommerce_new_order', function ($id, $order = null) {
    $order = $order instanceof WC_Order ? $order : wc_get_order($id);
    if (glp_dbg_is_app($order)) { glp_dbg('woocommerce_new_order', $id, array('status' => $order->get_status())); }
}, 99, 2);

add_action('woocommerce_order_status_changed', function ($id, $from, $to, $order = null) {
    $order = $order instanceof WC_Order ? $order : wc_get_order($id);
    if (glp_dbg_is_app($order)) { glp_dbg('woocommerce_order_status_changed', $id, array('from' => $from, 'to' => $to)); }
}, 99, 4);

add_action('woocommerce_order_status_pending_to_processing', function ($id) {
    if (glp_dbg_is_app(wc_get_order($id))) { glp_dbg('woocommerce_order_status_pending_to_processing', $id); }
}, 99, 1);

add_action('woocommerce_order_status_pending_to_processing_notification', function ($id) {
    if (glp_dbg_is_app(wc_get_order($id))) { glp_dbg('pending_to_processing_notification', $id); }
}, 1, 1);

add_action('woocommerce_payment_complete', function ($id) {
    if (glp_dbg_is_app(wc_get_order($id))) { glp_dbg('woocommerce_payment_complete', $id); }
}, 99, 1);

add_action('woocommerce_update_order', function ($id, $order = null) {
    $order = $order instanceof WC_Order ? $order : wc_get_order($id);
    if (glp_dbg_is_app($order)) { glp_dbg('woocommerce_update_order', $id, array('status' => $order->get_status())); }
}, 99, 2);

add_action('woocommerce_email_sent', function ($ok, $email_id, $email) {
    $o = is_object($email) && isset($email->object) ? $email->object : null;
    if (glp_dbg_is_app($o)) { glp_dbg('woocommerce_email_sent', $o->get_id(), array('email' => $email_id, 'ok' => (bool) $ok)); }
}, 99, 3);

add_filter('woocommerce_email_enabled_customer_processing_order', function ($enabled, $order = null) {
    if (glp_dbg_is_app($order)) { glp_dbg('email_enabled_filter', $order->get_id(), array('email' => 'customer_processing_order', 'enabled' => (bool) $enabled)); }
    return $enabled;
}, 9999, 2);

add_filter('wp_mail', function ($args) {
    $to = is_array($args['to']) ? implode(',', $args['to']) : (string) $args['to'];
    glp_dbg('wp_mail_attempt', 0, array('to' => $to, 'subject' => (string) $args['subject']));
    return $args;
}, 9999);
// Which transport actually sends each mail (smtp vs PHP mail()) — no credentials logged.
add_action('phpmailer_init', function ($m) {
    glp_dbg('phpmailer_transport', 0, array(
        'mailer' => (string) $m->Mailer, 'host' => (string) $m->Host, 'port' => (int) $m->Port,
        'smtp_auth' => (bool) $m->SMTPAuth, 'from' => (string) $m->From, 'sender' => (string) $m->Sender,
    ));
}, 99999);
add_action('wp_mail_succeeded', function ($d) {
    glp_dbg('wp_mail_succeeded', 0, array('to' => is_array($d['to']) ? implode(',', $d['to']) : (string) $d['to'], 'subject' => (string) $d['subject']));
});
add_action('wp_mail_failed', function ($err) {
    glp_dbg('wp_mail_failed', 0, array('error' => $err instanceof WP_Error ? $err->get_error_message() : 'unknown'));
});

add_action('rest_api_init', function () {
    register_rest_route('glp/v1', '/fulfilment/debug/emails', array(
        'methods' => 'GET', 'permission_callback' => 'glp_require_app_secret',
        'callback' => function (WP_REST_Request $req) {
            $uid = glp_staff_or_error($req);
            if (is_wp_error($uid)) { return $uid; }
            $oid = absint($req->get_param('order'));
            $log = get_option('glp_email_debug', array());
            if (!is_array($log)) { $log = array(); }
            $out = array(
                'connector' => '2.3.0',
                'defer_transactional_emails' => (bool) apply_filters('woocommerce_defer_transactional_emails', false),
                'emails' => array(),
                'events' => array_values(array_slice($log, -120)),
            );
            if (function_exists('WC')) {
                foreach (array('WC_Email_Customer_Processing_Order', 'WC_Email_Customer_Completed_Order', 'WC_Email_New_Order') as $cls) {
                    $all = WC()->mailer()->get_emails();
                    if (isset($all[$cls])) { $out['emails'][$cls] = array('enabled_setting' => $all[$cls]->enabled); }
                }
            }
            // Read-only snapshot of the sender settings actually in effect + who filters them.
            $hooked = function ($tag) {
                global $wp_filter;
                $out = array();
                if (empty($wp_filter[$tag])) { return $out; }
                foreach ($wp_filter[$tag]->callbacks as $prio => $cbs) {
                    foreach ($cbs as $cb) {
                        $f = $cb['function'];
                        try {
                            if (is_string($f)) { $r = new ReflectionFunction($f); $name = $f; }
                            elseif (is_array($f)) { $r = new ReflectionMethod($f[0], $f[1]); $name = (is_object($f[0]) ? get_class($f[0]) : $f[0]) . '::' . $f[1]; }
                            else { $r = new ReflectionFunction($f); $name = 'closure'; }
                            $file = str_replace(ABSPATH, '', (string) $r->getFileName());
                        } catch (Exception $e) { $name = 'unknown'; $file = ''; }
                        $out[] = array('priority' => $prio, 'callback' => $name, 'file' => $file);
                    }
                }
                return $out;
            };
            $out['settings'] = array(
                'home_url' => home_url(), 'site_url' => site_url(), 'blogname' => get_option('blogname'),
                'admin_email' => get_option('admin_email'),
                'woocommerce_email_from_name' => get_option('woocommerce_email_from_name'),
                'woocommerce_email_from_address' => get_option('woocommerce_email_from_address'),
                'is_multisite' => is_multisite(),
                'object_cache' => wp_using_ext_object_cache(),
                'filters' => array(
                    'wp_mail_from' => $hooked('wp_mail_from'),
                    'wp_mail_from_name' => $hooked('wp_mail_from_name'),
                    'woocommerce_email_from_address' => $hooked('woocommerce_email_from_address'),
                    'woocommerce_email_from_name' => $hooked('woocommerce_email_from_name'),
                    'phpmailer_init' => $hooked('phpmailer_init'),
                ),
            );
            if ($oid && ($order = wc_get_order($oid))) {
                $notes = array();
                foreach (wc_get_order_notes(array('order_id' => $oid, 'limit' => 40)) as $n) {
                    $notes[] = array('date' => $n->date_created ? $n->date_created->date('c') : '', 'by' => $n->added_by, 'note' => wp_strip_all_tags($n->content));
                }
                $out['order'] = array(
                    'id' => $oid, 'status' => $order->get_status(), 'created_via' => $order->get_created_via(),
                    'billing_email' => $order->get_billing_email(), 'payment_method' => $order->get_payment_method(),
                    'date_paid' => $order->get_date_paid() ? $order->get_date_paid()->date('c') : null,
                    'email_meta' => array(
                        'processing' => (string) $order->get_meta('_glp_email_processing', true),
                        'completed'  => (string) $order->get_meta('_glp_email_completed', true),
                    ),
                    'notes' => $notes,
                );
            }
            return glp_nocache_response($out);
        },
    ));
});
