<?php
/**
 * Pentarchy Vial — production API proxy (replaces the FastAPI proxy).
 *
 * Lives at https://app.ap3p-fitness.com/api/glp.php and is reached as
 * /api/glp/<route> via .htaccess. It loads the SAME WordPress install
 * (ap3p-fitness.com) and dispatches the request INTERNALLY to the GLP App
 * Connector (glp/v1) with the shared secret taken from wp-config.php
 * (GLP_APP_SHARED_SECRET). No HTTP hop → no SiteGround AntiBot / IP whitelist.
 *
 * - The secret never leaves the server and is never returned.
 * - Only an explicit allow-list of routes/methods is proxied.
 * - Customer identity comes ONLY from the Bearer token (forwarded as
 *   X-GLP-Customer-Token); the connector enforces ownership + staff permission.
 * - Responses are never cached.
 */

// ── Config: path to the main site's wp-load.php ────────────────────────────
// SiteGround layout: ~/www/<domain>/public_html. Override if yours differs.
$GLP_WP_LOAD_CANDIDATES = array(
    dirname(__DIR__, 3) . '/ap3p-fitness.com/public_html/wp-load.php',
    dirname(__DIR__, 2) . '/wp-load.php',
    dirname(__DIR__, 2) . '/public_html/wp-load.php',
);

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0, private');
header('X-Cache-Enabled: False');
header('X-Content-Type-Options: nosniff');
header('Content-Type: application/json; charset=utf-8');

function glp_px_out($status, $data) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

$method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';
$route  = '/' . trim(isset($_GET['__route']) ? (string) $_GET['__route'] : '', '/');

// Allow-list: [method, app route regex, connector route template]
$routes = array(
    array('POST', '#^/auth/register$#', '/register'),
    array('POST', '#^/auth/session$#', '/session'),
    array('POST', '#^/auth/request-password-reset$#', '/auth/request-password-reset'),
    array('GET',  '#^/me$#', '/me'),
    array('GET',  '#^/me/addresses$#', '/me/addresses'),
    array('POST', '#^/me/change-password$#', '/me/change-password'),
    array('POST', '#^/account/shipping-address$#', '/account/shipping-address'),
    array('GET',  '#^/categories$#', '/categories'),
    array('GET',  '#^/catalogue$#', '/catalogue'),
    array('GET',  '#^/products/(\d+)$#', '/products/$1'),
    array('POST', '#^/basket/validate$#', '/basket/validate'),
    array('POST', '#^/shipping/quote$#', '/shipping/quote'),
    array('GET',  '#^/orders$#', '/orders'),
    array('POST', '#^/orders$#', '/orders'),
    array('GET',  '#^/orders/(\d+)$#', '/orders/$1'),
    array('POST', '#^/orders/(\d+)/cancel$#', '/orders/$1/cancel'),
    array('GET',  '#^/crypto/networks$#', '/crypto/networks'),
    array('GET',  '#^/orders/(\d+)/crypto-invoice$#', '/orders/$1/crypto-invoice'),
    array('POST', '#^/orders/(\d+)/crypto-recheck$#', '/orders/$1/crypto-recheck'),
    array('POST', '#^/orders/(\d+)/crypto-network$#', '/orders/$1/crypto-network'),
    array('GET',  '#^/orders/(\d+)/label$#', '/orders/$1/label'),
    array('POST', '#^/orders/(\d+)/label$#', '/orders/$1/label'),
    array('GET',  '#^/fulfilment/orders$#', '/fulfilment/orders'),
    array('GET',  '#^/fulfilment/orders/(\d+)$#', '/fulfilment/orders/$1'),
    array('GET',  '#^/fulfilment/orders/(\d+)/label$#', '/fulfilment/orders/$1/label'),
    array('POST', '#^/fulfilment/orders/(\d+)/ready$#', '/fulfilment/orders/$1/ready'),
    array('POST', '#^/fulfilment/orders/(\d+)/dispatch$#', '/fulfilment/orders/$1/dispatch'),
    array('GET',  '#^/fulfilment/debug/emails$#', '/fulfilment/debug/emails'),
    array('GET',  '#^/health$#', '/version'),
);

$target = null;
foreach ($routes as $r) {
    if ($r[0] === $method && preg_match($r[1], $route, $m)) {
        $target = preg_replace($r[1], $r[2], $route);
        break;
    }
}
if ($target === null) { glp_px_out(404, array('error' => 'not_found', 'message' => 'Unknown endpoint.')); }

// Body (JSON only; labels are base64 JSON ≤ ~7 MB).
$body = array();
if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    if (strlen($raw) > 8 * 1024 * 1024) { glp_px_out(413, array('error' => 'file_too_large', 'message' => 'Files must be 5 MB or smaller.')); }
    $body = $raw !== '' ? json_decode($raw, true) : array();
    if (!is_array($body)) { glp_px_out(400, array('error' => 'invalid_json', 'message' => 'Invalid request.')); }
}
// Same payload renames the FastAPI proxy applied.
if ($route === '/auth/register') {
    $body = array(
        'email' => (string) ($body['email'] ?? ''),
        'password' => (string) ($body['password'] ?? ''),
        'first_name' => (string) ($body['firstName'] ?? $body['first_name'] ?? ''),
        'last_name' => (string) ($body['lastName'] ?? $body['last_name'] ?? ''),
        'telegram_username' => (string) ($body['telegramUsername'] ?? $body['telegram_username'] ?? ''),
    );
} elseif ($route === '/auth/session') {
    $body = array('username' => (string) ($body['username'] ?? $body['email'] ?? ''), 'password' => (string) ($body['password'] ?? ''));
}

// Bearer token (Apache may move the header; .htaccess also passes it through).
$auth = '';
foreach (array('HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION') as $k) {
    if (!empty($_SERVER[$k])) { $auth = (string) $_SERVER[$k]; break; }
}
$token = preg_match('/^\s*Bearer\s+(.+)$/i', $auth, $mm) ? trim($mm[1]) : '';

// Load WordPress (no theme output).
$wp_load = null;
foreach ($GLP_WP_LOAD_CANDIDATES as $c) { if (is_readable($c)) { $wp_load = $c; break; } }
if (!$wp_load) { glp_px_out(503, array('error' => 'proxy_unconfigured', 'message' => 'Store not reachable (wp-load.php not found).')); }
define('WP_USE_THEMES', false);
require_once $wp_load;

if (!function_exists('glp_shared_secret') || glp_shared_secret() === '') {
    glp_px_out(503, array('error' => 'proxy_unconfigured', 'message' => 'GLP connector not active or secret missing.'));
}

$req = new WP_REST_Request($method, '/glp/v1' . $target);
$req->set_header('X-GLP-App-Secret', glp_shared_secret());
if ($token !== '') { $req->set_header('X-GLP-Customer-Token', $token); }
$query = $_GET;
unset($query['__route'], $query['_nc']);
$req->set_query_params($query);
if ($method === 'POST') {
    $req->set_header('Content-Type', 'application/json');
    $req->set_body(wp_json_encode((object) $body));
}

$res  = rest_do_request($req);
// rest_do_request() skips the serve-time filter; apply it so connector hooks
// (no-cache headers, email reconcile) behave exactly as on /wp-json/.
$res  = apply_filters('rest_post_dispatch', rest_ensure_response($res), rest_get_server(), $req);
$data = rest_get_server()->response_to_data($res, false);
if ($route === '/health') {
    $data = array('ok' => $res->get_status() === 200, 'connector' => is_array($data) && isset($data['connector']) ? $data['connector'] : null);
}
glp_px_out($res->get_status(), $data);
