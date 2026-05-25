<?php

/**
 * Plugin loader for Sciova.
 *
 * Responsible for instantiating core services and registering
 * WordPress hooks. This class contains no business logic.
 *
 * @package Sciova
 * @subpackage Init
 * @since 0.1.0
 */

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Class SCIOVA_Loader
 *
 * Wires together admin, REST API, and core services.
 *
 * @since 0.1.0
 */
class SCIOVA_Loader
{

    /**
     * Bootstraps plugin services and hooks.
     *
     * Called from the main plugin file.
     *
     * @return void
     */
    public function run(): void
    {
        // Register admin dashboard (admin-only).
        if (is_admin()) {
            SCIOVA_Admin::register_hooks();
        }

        // Async PSI fetch triggered after a URL is added.
        add_action('sciova_run_psi_on_url_add', function (int $url_id) {
            $url_repo      = new SCIOVA_Url_Repository();
            $settings_repo = new SCIOVA_Settings_Repository();
            $psi_repo      = new SCIOVA_PSI_Repository($url_repo, $settings_repo, new SCIOVA_PSI_Client());
            try {
                $psi_repo->refresh($url_id);
            } catch (Throwable $e) {
                // Swallow — PSI is best-effort.
            }
        });

        // Register REST API endpoints.
        add_action('rest_api_init', function () {
            $url_repo      = new SCIOVA_Url_Repository();
            $settings_repo = new SCIOVA_Settings_Repository();
            $psi_repo      = new SCIOVA_PSI_Repository($url_repo, $settings_repo, new SCIOVA_PSI_Client());

            // Core REST (URLs).
            $rest_api = new SCIOVA_REST_API($url_repo, null, $psi_repo);
            $rest_api->register_routes();

            // Settings.
            $settings_controller = new SCIOVA_Settings_Controller($settings_repo);
            $settings_controller->register_routes();

            // Site content search (pages/posts/CPTs) to help add tracked URLs without manual typing.
            $site_search_controller = new SCIOVA_Site_Search_Controller();
            $site_search_controller->register_routes();

            // Notes (MVP): site-wide or URL-specific notes.
            $notes_repo = new SCIOVA_Notes_Repository();
            $notes_controller = new SCIOVA_Notes_Controller($notes_repo, $url_repo);
            $notes_controller->register_routes();

            // Step 5: CrUX History metrics.
            $metrics_controller = new SCIOVA_Metrics_Controller(
                $url_repo,
                $settings_repo,
                new SCIOVA_CrUX_History_Client(),
                new SCIOVA_Trend_Engine()
            );
            $metrics_controller->register_routes();

            // PSI (free basics) endpoint.
            $psi_controller = new SCIOVA_PSI_Controller($psi_repo);
            $psi_controller->register_routes();
        });
    }
}
