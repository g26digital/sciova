<?php

/**
 * Plugin deactivation handler.
 *
 * @package Sciova
 * @subpackage Init
 */

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Class SCIOVA_Deactivator
 *
 * Handles plugin deactivation logic.
 */
class SCIOVA_Deactivator
{

    /**
     * Runs on plugin deactivation.
     *
     * @return void
     */
    public static function deactivate(): void
    {
        // Clear any pending single-event cron jobs scheduled by this plugin.
        $timestamp = wp_next_scheduled('sciova_run_psi_on_url_add');
        if ($timestamp) {
            wp_unschedule_event($timestamp, 'sciova_run_psi_on_url_add');
        }

        // Data (tracked URLs, notes, settings) is intentionally preserved
        // so it survives deactivation/reactivation cycles.
    }
}
