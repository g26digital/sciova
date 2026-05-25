<?php

/**
 * Sciova uninstall cleanup.
 *
 * Removes plugin options and database tables.
 *
 * Note: This is optional for MVP, but included for cleanliness.
 */

if (! defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Delete options.
delete_option('sciova_crux_api_key');
delete_option('sciova_psi_api_key');
delete_option('sciova_crux_form_factor');
delete_option('sciova_crux_period_count');
delete_option('sciova_default_ma_window');

// Drop tables.
global $wpdb;

$sciova_tables = [
    $wpdb->prefix . 'sciova_urls',
    $wpdb->prefix . 'sciova_metrics',
    $wpdb->prefix . 'sciova_notes',
];

foreach ($sciova_tables as $sciova_table) {
    $sciova_table = esc_sql( $sciova_table );
    $wpdb->query("DROP TABLE IF EXISTS {$sciova_table}"); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.PreparedSQL.NotPrepared,WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery.SchemaChange -- Intentional uninstall cleanup. DROP TABLE cannot use prepare().
}
