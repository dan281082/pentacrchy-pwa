<?php
/**
 * GLP App Connector — v2.1.2 customer email safety net (Pentarchy app orders).
 *
 * App orders reach Processing (crypto payment confirmed) and Completed
 * (dispatched) but WooCommerce's automatic customer emails were not arriving.
 * This module guarantees the STANDARD WooCommerce emails are sent exactly once:
 *   - Processing → "Processing order" (WC_Email_Customer_Processing_Order)
 *   - Completed  → "Completed order"  (WC_Email_Customer_Completed_Order)
 * If WooCommerce already sent the email in the same request, nothing extra is
 * sent. Uses WooCommerce's own mailer/templates/settings (enabled flag, subject,
 * recipient = order billing email). No checkout/payment code is touched.
 */

if (!defined('ABSPATH')) { exit; }

$GLOBALS['glp_email_watch'] = array();     // "id|status" => array(id, status)
$GLOBALS['glp_email_sent']  = array();     // "id|status" => true
$GLOBALS['glp_email_fallback_active'] = false;

function glp_email_map() {
    return array(
        'processing' => array('id' => 'customer_processing_order', 'class' => 'WC_Email_Customer_Processing_Order', 'label' => 'order confirmation ("Processing order")'),
        'completed'  => array('id' => 'customer_completed_order',  'class' => 'WC_Email_Customer_Completed_Order',  'label' => '"Completed order"'),
    );
}

// 1. Watch app orders entering Processing / Completed (any request: REST, cron, admin).
add_action('woocommerce_order_status_changed', function ($order_id, $from, $to, $order) {
    $map = glp_email_map();
    if (!isset($map[$to])) { return; }
    if (!$order instanceof WC_Order) { $order = wc_get_order($order_id); }
    if (!$order || !function_exists('glp_is_app_order') || !glp_is_app_order($order)) { return; }
    if ((string) $order->get_meta('_glp_email_' . $to, true) !== '') { return; } // already sent before
    $GLOBALS['glp_email_watch'][$order_id . '|' . $to] = array((int) $order_id, $to);
}, 20, 4);

// 2. Record when WooCommerce actually sends one of these emails for an app order.
add_action('woocommerce_email_sent', function ($ok, $email_id, $email) {
    if (!$ok || !is_object($email) || !isset($email->object) || !($email->object instanceof WC_Order)) { return; }
    $status = null;
    foreach (glp_email_map() as $s => $m) { if ($m['id'] === $email_id) { $status = $s; } }
    if (!$status) { return; }
    $order = $email->object;
    if (!function_exists('glp_is_app_order') || !glp_is_app_order($order)) { return; }
    $key = $order->get_id() . '|' . $status;
    if (!empty($GLOBALS['glp_email_sent'][$key])) { return; }
    $GLOBALS['glp_email_sent'][$key] = true;
    $order->update_meta_data('_glp_email_' . $status, gmdate('c'));
    $order->save_meta_data();
    $via = $GLOBALS['glp_email_fallback_active'] ? 'sent by the Pentarchy connector' : 'sent automatically by WooCommerce';
    $order->add_order_note(sprintf('Pentarchy: customer %s email %s to %s.', glp_email_map()[$status]['label'], $via, $order->get_billing_email()));
}, 10, 3);

// 2b. Status may change WITHOUT WooCommerce transition hooks (e.g. a gateway
//     writing the status directly). Whenever an app order is read or saved,
//     queue a reconcile: if it is Processing/Completed and the matching
//     customer email has never been sent, send it (once) at shutdown.
function glp_email_queue_reconcile($order) {
    if (!$order instanceof WC_Order || !function_exists('glp_is_app_order') || !glp_is_app_order($order)) { return; }
    $status = $order->get_status();
    if (!isset(glp_email_map()[$status])) { return; }
    if ((string) $order->get_meta('_glp_email_' . $status, true) !== '') { return; }
    // Don't send a confirmation for orders that pre-date v2.1.2 (avoid emailing old test orders).
    $since = (int) get_option('glp_email_reconcile_since', 0);
    $ref = $status === 'processing' ? $order->get_date_paid() : $order->get_date_completed();
    if (!$ref) { $ref = $order->get_date_modified(); }
    if ($since && $ref && $ref->getTimestamp() < $since) { return; }
    $GLOBALS['glp_email_watch'][$order->get_id() . '|' . $status] = array((int) $order->get_id(), $status);
}
add_action('init', function () {
    if (!get_option('glp_email_reconcile_since')) { update_option('glp_email_reconcile_since', time() - 600, false); }
});
add_action('woocommerce_update_order', function ($id, $order = null) {
    glp_email_queue_reconcile($order instanceof WC_Order ? $order : wc_get_order($id));
}, 50, 2);
// The app polls /orders/{id}/crypto-invoice, /crypto-recheck and /orders/{id}
// right after payment: reconcile on every such glp/v1 request.
add_filter('rest_post_dispatch', function ($response, $server, $request) {
    if (preg_match('#^/glp/v1/orders/(\d+)(/|$)#', (string) $request->get_route(), $m)) {
        $order = wc_get_order((int) $m[1]);
        if ($order) { glp_email_queue_reconcile($order); }
    }
    return $response;
}, 20, 3);

// 3. At the very end of the request (after WooCommerce's own deferred email
//    queue, which runs on shutdown priority 10), send any email WooCommerce did not.
add_action('shutdown', function () {
    if (empty($GLOBALS['glp_email_watch']) || !function_exists('WC')) { return; }
    $map = glp_email_map();
    foreach ($GLOBALS['glp_email_watch'] as $key => $pair) {
        list($order_id, $status) = $pair;
        if (!empty($GLOBALS['glp_email_sent'][$key])) { continue; }
        $order = wc_get_order($order_id);
        if (!$order || $order->get_status() !== $status) { continue; } // moved on; don't send a stale email
        if ((string) $order->get_meta('_glp_email_' . $status, true) !== '') { continue; }
        if (!$order->get_billing_email()) {
            $order->add_order_note('Pentarchy: customer email not sent — order has no billing email.');
            continue;
        }
        $emails = WC()->mailer()->get_emails();
        $cls = $map[$status]['class'];
        if (empty($emails[$cls]) || !$emails[$cls]->is_enabled()) { continue; } // respect WooCommerce settings
        if (function_exists('glp_dbg')) { glp_dbg('pentarchy_fallback_trigger', $order_id, array('email' => $map[$status]['id'])); }
        $GLOBALS['glp_email_fallback_active'] = true;
        $emails[$cls]->trigger($order_id, $order);
        $GLOBALS['glp_email_fallback_active'] = false;
        if (empty($GLOBALS['glp_email_sent'][$key])) {
            $order->add_order_note(sprintf('Pentarchy: tried to send the customer %s email but WordPress reported a mail failure.', $map[$status]['label']));
        }
    }
    $GLOBALS['glp_email_watch'] = array();
}, 100);

// v2.4.0: customer emails keep the existing technical sender (deliverability)
// but replies go to the Pentarchy support inbox.
define('GLP_REPLY_TO', 'thepentarchy@proton.me');
add_filter('woocommerce_email_headers', function ($headers, $email_id, $object = null, $email = null) {
    if (strpos((string) $email_id, 'customer_') !== 0) { return $headers; } // staff/admin emails unchanged
    $headers = preg_replace('/^Reply-to:.*\r?\n?/mi', '', (string) $headers);
    return $headers . 'Reply-To: Pentarchy <' . GLP_REPLY_TO . ">\r\n";
}, 99, 4);
