<?php
/**
 * GLP App Connector — v2.4.0 optional Certificate of Analysis (COA) per product.
 *
 * - Staff (glp_manage_catalogue) attach EITHER an uploaded file (PDF/JPG/PNG,
 *   max 5 MB) OR an external https URL, via the existing manage/products save.
 * - Uploaded COA files are stored in a PRIVATE directory (outside the web root
 *   when possible, else uploads/glp-coa with "deny all"). They are never added
 *   to the WordPress media library, so no public attachment page/URL exists.
 * - Members fetch a COA only through GET /glp/v1/products/{id}/coa, which uses
 *   the same approved-member + members-only checks as the catalogue.
 * - Members-only products also get a noindex robots directive on the website.
 * Kept separate from the product description and main image.
 */
if (!defined('ABSPATH')) { exit; }

define('GLP_COA_META', '_glp_coa');
define('GLP_COA_MAX_BYTES', 5 * 1024 * 1024);

function glp_coa_dir() {
    $outside = dirname(rtrim(ABSPATH, '/\\')) . '/glp-private-coa';
    $dir = (is_dir($outside) || @wp_mkdir_p($outside)) && is_writable($outside)
        ? $outside
        : rtrim(wp_upload_dir()['basedir'], '/\\') . '/glp-coa';
    if (!is_dir($dir)) { wp_mkdir_p($dir); }
    if (!file_exists($dir . '/.htaccess')) { @file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n"); }
    if (!file_exists($dir . '/index.php')) { @file_put_contents($dir . '/index.php', "<?php // Silence.\n"); }
    return $dir;
}

function glp_coa_meta($pid) {
    $m = get_post_meta((int) $pid, GLP_COA_META, true);
    if (!is_array($m) || empty($m['type'])) { return null; }
    if ($m['type'] === 'url' && !empty($m['url'])) { return $m; }
    if ($m['type'] === 'file' && !empty($m['file']) && is_readable(glp_coa_dir() . '/' . basename((string) $m['file']))) { return $m; }
    return null;
}

// Customer-safe summary (never exposes the stored file path).
function glp_coa_public($pid) {
    $m = glp_coa_meta($pid);
    if (!$m) { return null; }
    if ($m['type'] === 'url') { return array('type' => 'url', 'url' => $m['url']); }
    return array('type' => 'file', 'mime' => $m['mime'], 'name' => $m['name'], 'size' => (int) $m['size']);
}

function glp_coa_delete_file($m) {
    if (is_array($m) && ($m['type'] ?? '') === 'file' && !empty($m['file'])) { @unlink(glp_coa_dir() . '/' . basename((string) $m['file'])); }
}

/**
 * Apply COA changes from a staff edit payload:
 *   coa_remove: true | coa_url: "https://..." | coa_file: base64, coa_name: "x.pdf"
 * Returns change array (for the audit log) or WP_Error.
 */
function glp_coa_apply($pid, $prm) {
    $old = glp_coa_meta($pid);
    $desc = function ($m) { return $m ? ($m['type'] === 'url' ? $m['url'] : $m['name']) : null; };
    if (!empty($prm['coa_remove'])) {
        if (!$old) { return array(); }
        glp_coa_delete_file($old); delete_post_meta($pid, GLP_COA_META);
        return array('coa' => array('from' => $desc($old), 'to' => null));
    }
    if (isset($prm['coa_url']) && trim((string) $prm['coa_url']) !== '') {
        $url = esc_url_raw(trim((string) $prm['coa_url']), array('https', 'http'));
        if ($url === '' || !wp_http_validate_url($url)) { return new WP_Error('glp_invalid', 'Enter a valid COA link starting with https://', array('status' => 400)); }
        if ($old && $old['type'] === 'url' && $old['url'] === $url) { return array(); }
        glp_coa_delete_file($old);
        update_post_meta($pid, GLP_COA_META, array('type' => 'url', 'url' => $url, 'updated_at' => gmdate('c')));
        return array('coa' => array('from' => $desc($old), 'to' => $url));
    }
    if (!empty($prm['coa_file'])) {
        $b64 = (string) $prm['coa_file'];
        if (strpos($b64, 'base64,') !== false) { $b64 = substr($b64, strpos($b64, 'base64,') + 7); }
        $bytes = base64_decode($b64, true);
        if (!$bytes || strlen($bytes) > GLP_COA_MAX_BYTES) { return new WP_Error('glp_bad_coa', 'COA files must be a PDF, JPG or PNG up to 5 MB.', array('status' => 415)); }
        $mime = function_exists('glp_detect_label_mime') ? glp_detect_label_mime($bytes) : '';
        if ($mime === '' || ($mime !== 'application/pdf' && !@getimagesizefromstring($bytes))) { return new WP_Error('glp_bad_coa', 'COA files must be a PDF, JPG or PNG up to 5 MB.', array('status' => 415)); }
        $ext = $mime === 'application/pdf' ? 'pdf' : ($mime === 'image/png' ? 'png' : 'jpg');
        $file = 'p' . (int) $pid . '-' . bin2hex(random_bytes(16)) . '.' . $ext;
        $dir = glp_coa_dir();
        if (@file_put_contents($dir . '/' . $file, $bytes) === false) { return new WP_Error('glp_store_failed', 'Could not store the COA file.', array('status' => 500)); }
        @chmod($dir . '/' . $file, 0640);
        $name = sanitize_file_name((string) ($prm['coa_name'] ?? ''));
        glp_coa_delete_file($old);
        $meta = array('type' => 'file', 'file' => $file, 'mime' => $mime, 'size' => strlen($bytes),
            'name' => $name !== '' ? $name : ('certificate-of-analysis.' . $ext), 'updated_at' => gmdate('c'));
        update_post_meta($pid, GLP_COA_META, $meta);
        return array('coa' => array('from' => $desc($old), 'to' => $meta['name']));
    }
    return array();
}

// Duplicated products should not silently share/lose a private file: copy the reference only for URLs.
add_action('woocommerce_product_duplicate', function ($dup, $orig) {
    $m = glp_coa_meta($orig->get_id());
    if ($m && $m['type'] === 'file') { delete_post_meta($dup->get_id(), GLP_COA_META); }
}, 10, 2);

// Members-only products: never indexed by search engines on the website.
add_filter('wp_robots', function ($robots) {
    if (function_exists('is_product') && is_product()) {
        $pid = get_queried_object_id();
        if ($pid && get_post_meta($pid, GLP_PRIVATE_PRODUCT_META, true) === 'yes') {
            $robots['noindex'] = true; $robots['nofollow'] = true;
        }
    }
    return $robots;
});

// GET /products/{id}/coa — approved members (members-only, published) or catalogue staff (any status).
add_action('rest_api_init', function () {
    register_rest_route('glp/v1', '/products/(?P<id>\d+)/coa', array('methods' => 'GET', 'permission_callback' => 'glp_require_app_secret', 'callback' => function (WP_REST_Request $req) {
        $uid = glp_authed_user_or_error($req); if (is_wp_error($uid)) { return $uid; }
        $id = (int) $req['id']; $p = wc_get_product($id);
        $staff = function_exists('glp_can_manage') && glp_can_manage($uid);
        if (!$staff) {
            $g = glp_guard_approved($uid); if (is_wp_error($g)) { return $g; }
            if (!$p || $p->get_status() !== 'publish' || get_post_meta($id, GLP_PRIVATE_PRODUCT_META, true) !== 'yes') { return new WP_Error('glp_not_found', 'Not found', array('status' => 404)); }
        }
        $m = $p ? glp_coa_meta($id) : null;
        if (!$m) { return new WP_Error('glp_no_coa', 'No certificate of analysis for this product.', array('status' => 404)); }
        $out = glp_coa_public($id);
        if ($m['type'] === 'file') { $out['data'] = base64_encode(file_get_contents(glp_coa_dir() . '/' . basename((string) $m['file']))); }
        $r = glp_nocache_response(array('coa' => $out));
        $r->header('X-Robots-Tag', 'noindex, nofollow');
        return $r;
    }));
});
