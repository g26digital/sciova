<?php

/**
 * PSI REST controller (free basics) for Sciova.
 *
 * Endpoints:
 * - GET /sciova/v1/psi?url_id=123
 *
 * Returns only freemium fields:
 * - Performance score
 * - FCP, LCP, CLS
 *
 * @package Sciova
 * @subpackage Init
 * @since 0.3.0
 */

if (! defined('ABSPATH')) {
    exit;
}

if (! class_exists('SCIOVA_PSI_Controller')) {

    /**
     * Class SCIOVA_PSI_Controller
     */
    final class SCIOVA_PSI_Controller
    {
        /**
         * REST namespace.
         *
         * @var string
         */
        private string $namespace = 'sciova/v1';

        /**
         * PSI repository.
         *
         * @var SCIOVA_PSI_Repository
         */
        private SCIOVA_PSI_Repository $psi;

        /**
         * Constructor.
         *
         * @param SCIOVA_PSI_Repository $psi_repo
         */
        public function __construct(SCIOVA_PSI_Repository $psi_repo)
        {
            $this->psi = $psi_repo;
        }

        /**
         * Register routes.
         *
         * @return void
         */
        public function register_routes(): void
        {
            register_rest_route($this->namespace, '/psi', [
                [
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => [$this, 'get_psi'],
                    'permission_callback' => [$this, 'permissions_check'],
                    'args'                => [
                        'url_id' => [
                            'required'          => true,
                            'sanitize_callback' => 'absint',
                        ],
                        'refresh' => [
                            'required'          => false,
                            'sanitize_callback' => 'absint',
                        ],
                    ],
                ],
            ]);
        }

        /**
         * Permission: admin-only.
         *
         * @return bool
         */
        public function permissions_check(): bool
        {
            return current_user_can('manage_options');
        }

        /**
         * GET /psi
         *
         * @param WP_REST_Request $request
         * @return WP_REST_Response
         */
        public function get_psi(WP_REST_Request $request): WP_REST_Response
        {
            $url_id  = (int) $request->get_param('url_id');
            $refresh = (int) $request->get_param('refresh');

            $data = $this->psi->get_summary($url_id, $refresh === 1);
            if (is_wp_error($data)) {
                $code = $data->get_error_code();
                $msg  = $data->get_error_message();

                $status = 400;
                if ($code === 'not_found') {
                    $status = 404;
                }
                if ($code === 'psi_fetch_failed') {
                    $status = 502;
                }

                return SCIOVA_REST_Response::error($code, $msg, $status);
            }

            return SCIOVA_REST_Response::success($data, 200);
        }
    }
}
