<?php
/**
 * Apeps App Connector — Authentication + customer profile.
 * Public: POST /auth/{login,register,refresh,logout,forgot}.
 * Auth:   GET /me (profile).
 * Generic errors prevent account enumeration. Tokens issued via rest.php helpers.
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!defined('APEPS_APP_TELEGRAM_META')) {
    define('APEPS_APP_TELEGRAM_META', '_apeps_telegram_username');
}
if (!defined('APEPS_APP_APPROVED_META')) {
    define('APEPS_APP_APPROVED_META', '_apeps_approved');
}

/**
 * Normalise + validate a Telegram username. Strips a leading "@", lowercases and
 * allow-lists Telegram's own character set (a–z, 0–9, _; 5–32 chars). Returns the
 * normalised value, or a WP_Error on invalid input.
 */
function apeps_app_normalize_telegram($raw) {
    if (!is_string($raw)) {
        return new WP_Error('telegram_invalid', 'Telegram username is required.', array('status' => 400));
    }
    $value = strtolower(ltrim(trim($raw), '@'));
    if ($value === '' || !preg_match('/^[a-z0-9_]{5,32}$/', $value)) {
        return new WP_Error('telegram_invalid', 'Use 5–32 letters, numbers or underscores for your Telegram username.', array('status' => 400));
    }
    return $value;
}

/** Server-authoritative approval + telegram state for a user. */
function apeps_app_user_state($user_id) {
    return array(
        'approved'         => (bool) get_user_meta($user_id, APEPS_APP_APPROVED_META, true),
        'telegramUsername' => (string) get_user_meta($user_id, APEPS_APP_TELEGRAM_META, true),
    );
}

add_action('rest_api_init', function () {
    register_rest_route(APEPS_APP_NS, '/auth/login', array(
        'methods' => 'POST', 'permission_callback' => '__return_true',
        'callback' => 'apeps_app_route_login',
    ));
    register_rest_route(APEPS_APP_NS, '/auth/register', array(
        'methods' => 'POST', 'permission_callback' => '__return_true',
        'callback' => 'apeps_app_route_register',
    ));
    register_rest_route(APEPS_APP_NS, '/auth/refresh', array(
        'methods' => 'POST', 'permission_callback' => '__return_true',
        'callback' => 'apeps_app_route_refresh',
    ));
    register_rest_route(APEPS_APP_NS, '/auth/logout', array(
        'methods' => 'POST', 'permission_callback' => '__return_true',
        'callback' => 'apeps_app_route_logout',
    ));
    register_rest_route(APEPS_APP_NS, '/auth/forgot', array(
        'methods' => 'POST', 'permission_callback' => '__return_true',
        'callback' => 'apeps_app_route_forgot',
    ));
    register_rest_route(APEPS_APP_NS, '/me', array(
        'methods' => 'GET', 'permission_callback' => '__return_true',
        'callback' => 'apeps_app_route_me',
    ));
    // Account-synced favourites (merges with the app's local favourites store).
    register_rest_route(APEPS_APP_NS, '/me/favourites', array(
        array(
            'methods' => 'GET', 'permission_callback' => '__return_true',
            'callback' => 'apeps_app_route_favourites_get',
        ),
        array(
            'methods' => 'POST', 'permission_callback' => '__return_true',
            'callback' => 'apeps_app_route_favourites_set',
        ),
    ));
});

function apeps_app_route_login($request) {
    if (!apeps_app_rate_ok('login', 8, 5 * MINUTE_IN_SECONDS)) {
        return apeps_app_error('rate_limited', 'Too many attempts. Try again later.', 429);
    }
    $email    = sanitize_email((string) $request->get_param('email'));
    $password = (string) $request->get_param('password');
    $device   = sanitize_text_field((string) $request->get_param('deviceId'));

    if (!$email || !$password) {
        return apeps_app_error('invalid', 'Email or password is incorrect.', 401);
    }
    $user = wp_authenticate($email, $password);
    if (is_wp_error($user)) {
        return apeps_app_error('invalid', 'Email or password is incorrect.', 401);
    }
    return rest_ensure_response(apeps_app_auth_response($user->ID, $device));
}

function apeps_app_route_register($request) {
    if (!apeps_app_rate_ok('register', 5, 10 * MINUTE_IN_SECONDS)) {
        return apeps_app_error('rate_limited', 'Too many attempts. Try again later.', 429);
    }
    $email    = sanitize_email((string) $request->get_param('email'));
    $password = (string) $request->get_param('password');
    $first    = sanitize_text_field((string) $request->get_param('firstName'));
    $last     = sanitize_text_field((string) $request->get_param('lastName'));

    if (!is_email($email) || strlen($password) < 8) {
        return apeps_app_error('invalid_input', 'Please provide a valid email and a password of at least 8 characters.', 400);
    }

    // Telegram username is REQUIRED — it links the member to the group-buy community.
    $telegram = apeps_app_normalize_telegram((string) $request->get_param('telegramUsername'));
    if (is_wp_error($telegram)) {
        return $telegram;
    }
    // Enforce one account per Telegram username.
    $existing_tg = get_users(array(
        'meta_key'   => APEPS_APP_TELEGRAM_META,
        'meta_value' => $telegram,
        'number'     => 1,
        'fields'     => 'ID',
    ));
    if (!empty($existing_tg)) {
        return apeps_app_error('telegram_taken', 'That Telegram username is already registered.', 409);
    }

    if (email_exists($email)) {
        return apeps_app_error('cannot_register', 'We could not create an account with those details.', 409);
    }
    if (!function_exists('wc_create_new_customer')) {
        return apeps_app_error('unavailable', 'Store is unavailable. Please try again later.', 503);
    }
    $user_id = wc_create_new_customer($email, '', $password, array(
        'first_name' => $first,
        'last_name'  => $last,
    ));
    if (is_wp_error($user_id)) {
        return apeps_app_error('cannot_register', 'We could not create an account with those details.', 400);
    }

    // Persist the Telegram username and auto-approve (a valid Telegram username
    // supplied at registration grants access). Change to `false` here to require
    // manual admin approval for everyone instead.
    update_user_meta($user_id, APEPS_APP_TELEGRAM_META, $telegram);
    update_user_meta($user_id, APEPS_APP_APPROVED_META, true);

    $device = sanitize_text_field((string) $request->get_param('deviceId'));
    return rest_ensure_response(apeps_app_auth_response($user_id, $device));
}

function apeps_app_route_refresh($request) {
    if (!apeps_app_rate_ok('refresh', 30, 5 * MINUTE_IN_SECONDS)) {
        return apeps_app_error('rate_limited', 'Too many attempts. Try again later.', 429);
    }
    $refresh = (string) $request->get_param('refreshToken');
    $uid = apeps_app_consume_refresh($refresh);
    if (is_wp_error($uid)) return $uid;
    $device = sanitize_text_field((string) $request->get_param('deviceId'));
    return rest_ensure_response(apeps_app_auth_response($uid, $device));
}

function apeps_app_route_logout($request) {
    $uid = apeps_app_current_user($request);
    if (is_wp_error($uid)) return $uid;
    $refresh = (string) $request->get_param('refreshToken');
    if ($refresh) {
        apeps_app_consume_refresh($refresh); // consuming removes it
    } else {
        apeps_app_revoke_all($uid);
    }
    return rest_ensure_response(array('ok' => true));
}

function apeps_app_route_forgot($request) {
    apeps_app_rate_ok('forgot', 5, 10 * MINUTE_IN_SECONDS);
    $email = sanitize_email((string) $request->get_param('email'));
    // Always return the same response to prevent account enumeration.
    if (is_email($email)) {
        $user = get_user_by('email', $email);
        if ($user) {
            retrieve_password($user->user_login); // WordPress' built-in secure reset flow.
        }
    }
    return rest_ensure_response(array(
        'ok'      => true,
        'message' => 'If an account exists for that email, a reset link has been sent.',
    ));
}

function apeps_app_auth_response($user_id, $device_id = '') {
    $user  = get_userdata($user_id);
    $state = apeps_app_user_state($user_id);
    return array(
        'accessToken'  => apeps_app_issue_access($user_id),
        'refreshToken' => apeps_app_issue_refresh($user_id, $device_id),
        'expiresIn'    => APEPS_APP_ACCESS_TTL,
        'customer'     => array(
            'id'               => (int) $user_id,
            'email'            => $user ? $user->user_email : '',
            'firstName'        => get_user_meta($user_id, 'first_name', true),
            'lastName'         => get_user_meta($user_id, 'last_name', true),
            'telegramUsername' => $state['telegramUsername'],
            'approved'         => $state['approved'],
        ),
    );
}

function apeps_app_route_me($request) {
    $uid = apeps_app_current_user($request);
    if (is_wp_error($uid)) return $uid;
    if (!class_exists('WC_Customer')) {
        return apeps_app_error('unavailable', 'Store is unavailable.', 503);
    }
    $customer = new WC_Customer($uid);
    $state = apeps_app_user_state($uid);
    return rest_ensure_response(array(
        'id'               => (int) $uid,
        'email'            => $customer->get_email(),
        'firstName'        => $customer->get_first_name(),
        'lastName'         => $customer->get_last_name(),
        'telegramUsername' => $state['telegramUsername'],
        'approved'         => $state['approved'],
        'phone'            => $customer->get_billing_phone(),
        'billing'          => $customer->get_billing(),
        'shipping'         => $customer->get_shipping(),
    ));
}

function apeps_app_route_favourites_get($request) {
    $uid = apeps_app_current_user($request);
    if (is_wp_error($uid)) return $uid;
    $ids = get_user_meta($uid, '_apeps_favourites', true);
    return rest_ensure_response(array('ids' => array_values(array_map('absint', (array) $ids))));
}

function apeps_app_route_favourites_set($request) {
    $uid = apeps_app_current_user($request);
    if (is_wp_error($uid)) return $uid;
    $ids = (array) $request->get_param('ids');
    $ids = array_values(array_unique(array_map('absint', $ids)));
    update_user_meta($uid, '_apeps_favourites', $ids);
    return rest_ensure_response(array('ids' => $ids));
}


/* ── Admin: app member approval ────────────────────────────────────────────
 * Members auto-approve on registration (valid Telegram username). This gives an
 * admin a simple way to review the Telegram handle and revoke/grant access.
 * Capability-gated to users who can edit other users. */

add_filter('manage_users_columns', function ($columns) {
    $columns['apeps_member'] = 'App Member';
    return $columns;
});

add_filter('manage_users_custom_column', function ($output, $column, $user_id) {
    if ($column !== 'apeps_member') {
        return $output;
    }
    $state = apeps_app_user_state($user_id);
    if ($state['telegramUsername'] === '' && !$state['approved']) {
        return '<span style="color:#888">—</span>';
    }
    $tg = $state['telegramUsername'] ? '@' . esc_html($state['telegramUsername']) : '<em>no Telegram</em>';
    $badge = $state['approved']
        ? '<span style="color:#1a7f37;font-weight:600">Approved</span>'
        : '<span style="color:#b32d2e;font-weight:600">Pending</span>';
    return $tg . '<br>' . $badge;
}, 10, 3);

function apeps_app_render_approval_field($user) {
    if (!current_user_can('edit_user', $user->ID)) {
        return;
    }
    $state = apeps_app_user_state($user->ID);
    ?>
    <h2>Apeps App Access</h2>
    <table class="form-table" role="presentation">
        <tr>
            <th><label for="apeps_telegram">Telegram username</label></th>
            <td>
                <input type="text" name="apeps_telegram" id="apeps_telegram"
                       value="<?php echo esc_attr($state['telegramUsername']); ?>" class="regular-text" />
                <p class="description">Member's Telegram handle (without the @).</p>
            </td>
        </tr>
        <tr>
            <th><label for="apeps_approved">Approved for app</label></th>
            <td>
                <label>
                    <input type="checkbox" name="apeps_approved" id="apeps_approved" value="1"
                        <?php checked($state['approved']); ?> />
                    Allow this member to use the Apeps app (view vials, basket, checkout).
                </label>
            </td>
        </tr>
    </table>
    <?php
}
add_action('show_user_profile', 'apeps_app_render_approval_field');
add_action('edit_user_profile', 'apeps_app_render_approval_field');

function apeps_app_save_approval_field($user_id) {
    if (!current_user_can('edit_user', $user_id)) {
        return;
    }
    $tg_raw = isset($_POST['apeps_telegram']) ? wp_unslash($_POST['apeps_telegram']) : '';
    if ($tg_raw !== '') {
        $tg = apeps_app_normalize_telegram((string) $tg_raw);
        if (!is_wp_error($tg)) {
            update_user_meta($user_id, APEPS_APP_TELEGRAM_META, $tg);
        }
    }
    $approved = isset($_POST['apeps_approved']) && $_POST['apeps_approved'] === '1';
    update_user_meta($user_id, APEPS_APP_APPROVED_META, $approved);
}
add_action('personal_options_update', 'apeps_app_save_approval_field');
add_action('edit_user_profile_update', 'apeps_app_save_approval_field');
