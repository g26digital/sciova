<?php

/**
 * Database schema and helpers.
 *
 * @package Sciova
 * @subpackage Core
 */

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Class SCIOVA_DB
 *
 * Handles database table creation.
 */
class SCIOVA_DB
{

    /**
     * Create plugin database tables.
     *
     * @return void
     */
    public static function create_tables(): void
    {
        global $wpdb;

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $charset_collate = $wpdb->get_charset_collate();

        $urls = "{$wpdb->prefix}sciova_urls";
        $metrics = "{$wpdb->prefix}sciova_metrics";
        $notes = "{$wpdb->prefix}sciova_notes";

        dbDelta("
            CREATE TABLE $urls (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                url TEXT NOT NULL,
                created_at DATETIME NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY url (url(191))
            ) $charset_collate;
        ");

        // Reserved for Pro: persistent CrUX metric storage.
        // Currently unused — CrUX data is served via transient cache only.
        // Do not remove; upgrading installs will need this table present.
        dbDelta("
            CREATE TABLE $metrics (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                url_id BIGINT UNSIGNED NOT NULL,
                metric VARCHAR(50) NOT NULL,
                value FLOAT NOT NULL,
                source VARCHAR(20) NOT NULL,
                recorded_at DATE NOT NULL,
                PRIMARY KEY (id),
                KEY url_metric (url_id, metric)
            ) $charset_collate;
        ");


        dbDelta("
            CREATE TABLE $notes (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                url_id BIGINT UNSIGNED NULL,
                note_date DATE NOT NULL,
                content LONGTEXT NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                PRIMARY KEY (id),
                KEY note_date (note_date),
                KEY url_date (url_id, note_date)
            ) $charset_collate;
        ");

    }
}
