<?php

/**
 * URL REST API controller for Sciova.
 *
 * Handles tracked URL CRUD (freemium MVP: max 3 URLs).
 *
 * Endpoints:
 * - GET  /sciova/v1/urls
 * - POST /sciova/v1/urls
 * - DELETE /sciova/v1/urls/{id}
 *
 * @package Sciova
 */

if (! defined('ABSPATH')) {
    exit;
}

if (! class_exists('SCIOVA_REST_API')) {

    /**
     * Class SCIOVA_REST_API
     *
     * @since 0.1.0
     */
    final class SCIOVA_REST_API
    {

        /**
         * REST namespace.
         *
         * @since 0.1.0
         * @var string
         */
        private string $namespace = 'sciova/v1';

        /**
         * URL repository.
         *
         * @since 0.1.0
         * @var SCIOVA_Url_Repository
         */
        private SCIOVA_Url_Repository $urls;

        /**
         * Freemium policy.
         *
         * @since 0.1.0
         * @var SCIOVA_Freemium_Policy
         */
        private SCIOVA_Freemium_Policy $policy;

        /**
         * PSI repository (optional).
         *
         * Used to auto-run PSI after adding a URL.
         *
         * @var SCIOVA_PSI_Repository|null
         */
        private ?SCIOVA_PSI_Repository $psi;

        /**
         * Constructor.
         *
         * @since 0.1.0
         *
         * @param SCIOVA_Url_Repository        $url_repository URL repository.
         * @param SCIOVA_Freemium_Policy|null $policy         Optional freemium policy.
         */
        public function __construct(SCIOVA_Url_Repository $url_repository, ?SCIOVA_Freemium_Policy $policy = null, ?SCIOVA_PSI_Repository $psi_repo = null)
        {
            $this->urls   = $url_repository;
            $this->policy = $policy ?: new SCIOVA_Freemium_Policy();
            $this->psi    = $psi_repo;
        }

        /**
         * Register REST routes.
         *
         * @since 0.1.0
         *
         * @return void
         */
        public function register_routes(): void
        {
            // GET/POST: /urls
            register_rest_route(
                $this->namespace,
                '/urls',
                array(
                    array(
                        'methods'             => WP_REST_Server::READABLE,
                        'callback'            => array($this, 'get_urls'),
                        'permission_callback' => array($this, 'permission_check'),
                    ),
                    array(
                        'methods'             => WP_REST_Server::CREATABLE,
                        'callback'            => array($this, 'create_url'),
                        'permission_callback' => array($this, 'permission_check'),
                        'args'                => array(
                            'url' => array(
                                'type'     => 'string',
                                'required' => true,
                            ),
                        ),
                    ),
                )
            );

            // DELETE: /urls/{id}
            register_rest_route(
                $this->namespace,
                '/urls/(?P<id>\d+)',
                array(
                    array(
                        'methods'             => WP_REST_Server::DELETABLE,
                        'callback'            => array($this, 'delete_url'),
                        'permission_callback' => array($this, 'permission_check'),
                        'args'                => array(
                            'id' => array(
                                'type'     => 'integer',
                                'required' => true,
                            ),
                        ),
                    ),
                )
            );
        }

        /**
         * Permission check (admin-only).
         *
         * @since 0.1.0
         *
         * @return bool
         */
        public function permission_check(): bool
        {
            return current_user_can('manage_options');
        }

        /**
         * GET /urls
         *
         * @since 0.1.0
         *
         * @param WP_REST_Request $request Request.
         * @return WP_REST_Response
         */
        public function get_urls(WP_REST_Request $request): WP_REST_Response
        {
            $items = $this->urls->get_all();

            return SCIOVA_REST_Response::success(
                array(
                    'items' => $items,
                    'count' => is_array($items) ? count($items) : 0,
                    'max'   => $this->policy->max_urls(),
                ),
                200
            );
        }

        /**
         * POST /urls
         *
         * Flow:
         * - Normalize URL
         * - Validate
         * - Enforce freemium max
         * - Duplicate check
         * - Insert
         *
         * @since 0.1.0
         *
         * @param WP_REST_Request $request Request.
         * @return WP_REST_Response
         */
        public function create_url(WP_REST_Request $request): WP_REST_Response
        {
            $params = $request->get_json_params();
            $params = is_array($params) ? $params : array();

            $raw_url = isset($params['url']) && is_string($params['url']) ? $params['url'] : '';
            $raw_url = trim($raw_url);

            // Normalize before validation (per your hardened behavior).
            $normalized = $this->urls->normalize_url($raw_url);

            // Validate after normalization.
            if ($normalized === '' || ! filter_var($normalized, FILTER_VALIDATE_URL)) {
                return SCIOVA_REST_Response::error('invalid_url', 'Invalid URL.', 400);
            }

            // Enforce freemium limit (server-side).
            $count = (int) $this->urls->count_all();
            if (! $this->policy->can_add_url($count)) {
                return SCIOVA_REST_Response::error(
                    'limit_reached',
                    'Freemium limit reached. You can track up to 3 URLs.',
                    403,
                    array(
                        'max'   => $this->policy->max_urls(),
                        'count' => $count,
                    )
                );
            }

            // Duplicate prevention (normalized).
            if ($this->urls->exists($normalized)) {
                return SCIOVA_REST_Response::error('duplicate_url', 'This URL is already tracked.', 409);
            }

            // Insert.
            $new_id = $this->urls->add($normalized);

            if (! $new_id) {
                return SCIOVA_REST_Response::error('insert_failed', 'Failed to add URL.', 500);
            }

            // Schedule PSI fetch asynchronously so URL add response is instant.
            // Use time() - 1 to ensure the event is past-due, then spawn_cron() to
            // trigger it immediately rather than waiting for the next frontend page load.
            if (! wp_next_scheduled('sciova_run_psi_on_url_add', [(int) $new_id])) {
                wp_schedule_single_event(time() - 1, 'sciova_run_psi_on_url_add', [(int) $new_id]);
            }
            spawn_cron();

            return SCIOVA_REST_Response::success(
                array(
                    'id'  => (int) $new_id,
                    'url' => $normalized,
                ),
                201
            );
        }

        /**
         * DELETE /urls/{id}
         *
         * @since 0.1.0
         *
         * @param WP_REST_Request $request Request.
         * @return WP_REST_Response
         */
        public function delete_url(WP_REST_Request $request): WP_REST_Response
        {
            $id = (int) $request->get_param('id');

            if ($id <= 0) {
                return SCIOVA_REST_Response::error('invalid_id', 'Invalid URL id.', 400);
            }

            $deleted = $this->urls->delete_url($id);

            if (! $deleted) {
                // Not found or delete failed.
                return SCIOVA_REST_Response::error('not_found', 'URL not found.', 404);
            }

            return SCIOVA_REST_Response::success(
                array(
                    'deleted' => true,
                    'id'      => $id,
                ),
                200
            );
        }
    }
}
