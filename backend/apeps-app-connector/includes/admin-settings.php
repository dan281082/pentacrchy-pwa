<?php
/**
 * Apeps App Connector — Admin settings page.
 * Capability-gated (manage_options). Provides the app remote-config, version
 * gate, maintenance mode, policy URLs and banners. Firebase SERVER credentials
 * are write-only (never echoed back after saving).
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('admin_menu', function () {
    add_menu_page(
        'Apeps App',
        'Apeps App',
        'manage_options',
        'apeps-app',
        'apeps_app_render_settings',
        'dashicons-smartphone',
        58
    );
});

add_action('admin_init', function () {
    // General
    register_setting('apeps_app', 'apeps_app_api_enabled', array('type' => 'boolean', 'default' => true));
    register_setting('apeps_app', 'apeps_app_maintenance', array('type' => 'boolean', 'default' => false));
    register_setting('apeps_app', 'apeps_app_maintenance_msg', array('sanitize_callback' => 'sanitize_text_field'));

    // Version gate
    register_setting('apeps_app', 'apeps_app_latest_version', array('sanitize_callback' => 'sanitize_text_field'));
    register_setting('apeps_app', 'apeps_app_min_version', array('sanitize_callback' => 'sanitize_text_field'));
    register_setting('apeps_app', 'apeps_app_update_required', array('type' => 'boolean', 'default' => false));
    register_setting('apeps_app', 'apeps_app_apk_url', array('sanitize_callback' => 'esc_url_raw'));
    register_setting('apeps_app', 'apeps_app_release_notes', array('sanitize_callback' => 'apeps_app_sanitize_lines'));

    // URLs
    register_setting('apeps_app', 'apeps_app_support_url', array('sanitize_callback' => 'esc_url_raw'));
    register_setting('apeps_app', 'apeps_app_whatsapp_url', array('sanitize_callback' => 'esc_url_raw'));
    register_setting('apeps_app', 'apeps_app_terms_url', array('sanitize_callback' => 'esc_url_raw'));
    register_setting('apeps_app', 'apeps_app_privacy_url', array('sanitize_callback' => 'esc_url_raw'));
    register_setting('apeps_app', 'apeps_app_delivery_url', array('sanitize_callback' => 'esc_url_raw'));
    register_setting('apeps_app', 'apeps_app_refund_url', array('sanitize_callback' => 'esc_url_raw'));

    // Firebase SERVER key — write-only (stored, never displayed after save).
    register_setting('apeps_app', 'apeps_app_fcm_key_present', array('type' => 'boolean', 'default' => false));
});

function apeps_app_sanitize_lines($value) {
    if (is_array($value)) return array_map('sanitize_text_field', $value);
    $lines = preg_split('/\r\n|\r|\n/', (string) $value);
    return array_values(array_filter(array_map('sanitize_text_field', $lines)));
}

function apeps_app_render_settings() {
    if (!current_user_can('manage_options')) {
        wp_die('Insufficient permissions');
    }

    // Handle write-only Firebase server key separately (never echoed back).
    if (isset($_POST['apeps_fcm_server_key']) && check_admin_referer('apeps_app_fcm')) {
        $key = sanitize_text_field(wp_unslash($_POST['apeps_fcm_server_key']));
        if ($key !== '') {
            update_option('apeps_app_fcm_server_key', $key, '', false); // autoload=false
            update_option('apeps_app_fcm_key_present', true);
            echo '<div class="notice notice-success"><p>Firebase server key saved.</p></div>';
        }
    }

    $notes = get_option('apeps_app_release_notes', array());
    $notes_text = is_array($notes) ? implode("\n", $notes) : '';
    ?>
    <div class="wrap">
        <h1>Apeps App Connector</h1>
        <form method="post" action="options.php">
            <?php settings_fields('apeps_app'); ?>
            <h2>General</h2>
            <table class="form-table">
                <tr><th>Enable app API</th><td><input type="checkbox" name="apeps_app_api_enabled" value="1" <?php checked(get_option('apeps_app_api_enabled', true)); ?>></td></tr>
                <tr><th>Maintenance mode</th><td><input type="checkbox" name="apeps_app_maintenance" value="1" <?php checked(get_option('apeps_app_maintenance', false)); ?>></td></tr>
                <tr><th>Maintenance message</th><td><input type="text" class="regular-text" name="apeps_app_maintenance_msg" value="<?php echo esc_attr(get_option('apeps_app_maintenance_msg', '')); ?>"></td></tr>
            </table>

            <h2>Version gate</h2>
            <table class="form-table">
                <tr><th>Latest version</th><td><input type="text" name="apeps_app_latest_version" value="<?php echo esc_attr(get_option('apeps_app_latest_version', '1.0.0')); ?>"></td></tr>
                <tr><th>Minimum supported</th><td><input type="text" name="apeps_app_min_version" value="<?php echo esc_attr(get_option('apeps_app_min_version', '1.0.0')); ?>"></td></tr>
                <tr><th>Force update</th><td><input type="checkbox" name="apeps_app_update_required" value="1" <?php checked(get_option('apeps_app_update_required', false)); ?>></td></tr>
                <tr><th>APK download URL</th><td><input type="url" class="regular-text" name="apeps_app_apk_url" value="<?php echo esc_attr(get_option('apeps_app_apk_url', '')); ?>"></td></tr>
                <tr><th>Release notes (one per line)</th><td><textarea name="apeps_app_release_notes" rows="4" class="large-text"><?php echo esc_textarea($notes_text); ?></textarea></td></tr>
            </table>

            <h2>URLs</h2>
            <table class="form-table">
                <tr><th>Support URL</th><td><input type="url" class="regular-text" name="apeps_app_support_url" value="<?php echo esc_attr(get_option('apeps_app_support_url', '')); ?>"></td></tr>
                <tr><th>WhatsApp URL</th><td><input type="url" class="regular-text" name="apeps_app_whatsapp_url" value="<?php echo esc_attr(get_option('apeps_app_whatsapp_url', '')); ?>"></td></tr>
                <tr><th>Terms URL</th><td><input type="url" class="regular-text" name="apeps_app_terms_url" value="<?php echo esc_attr(get_option('apeps_app_terms_url', '')); ?>"></td></tr>
                <tr><th>Privacy URL</th><td><input type="url" class="regular-text" name="apeps_app_privacy_url" value="<?php echo esc_attr(get_option('apeps_app_privacy_url', '')); ?>"></td></tr>
                <tr><th>Delivery URL</th><td><input type="url" class="regular-text" name="apeps_app_delivery_url" value="<?php echo esc_attr(get_option('apeps_app_delivery_url', '')); ?>"></td></tr>
                <tr><th>Refund URL</th><td><input type="url" class="regular-text" name="apeps_app_refund_url" value="<?php echo esc_attr(get_option('apeps_app_refund_url', '')); ?>"></td></tr>
            </table>

            <?php submit_button(); ?>
        </form>

        <hr>
        <h2>Firebase server key (write-only)</h2>
        <p>Stored securely and never displayed after saving. Status:
            <strong><?php echo get_option('apeps_app_fcm_key_present') ? 'Configured' : 'Not set'; ?></strong>
        </p>
        <form method="post">
            <?php wp_nonce_field('apeps_app_fcm'); ?>
            <input type="password" class="regular-text" name="apeps_fcm_server_key" placeholder="Paste new key to replace">
            <?php submit_button('Save Firebase key'); ?>
        </form>
    </div>
    <?php
}
