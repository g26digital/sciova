<?php
/**
 * Settings REST controller for Sciova.
 *
 * Endpoints:
 * - GET  /sciova/v1/settings
 * - POST /sciova/v1/settings
 *
 * Behavior:
 * - Admin-only (manage_options)
 * - GET returns masked keys + CrUX Step 5 settings (period count, form factor)
 * - POST updates ONLY the fields present and non-empty/valid (prevents accidental overwrite)
 *
 * @package Sciova
 * @subpackage Init
 * @since 0.2.0
 */

if (! defined('ABSPATH')) {
    exit;
}

if (! class_exists('SCIOVA_Settings_Controller')) {

    /**
     * Class SCIOVA_Settings_Controller
     *
     * @since 0.2.0
     */
    final class SCIOVA_Settings_Controller
    {
        /**
         * REST namespace.
         *
         * @var string
         */
        private $namespace = 'sciova/v1';

        /**
         * Settings repository.
         *
         * @var SCIOVA_Settings_Repository
         */
        private $settings;

        /**
         * Constructor.
         *
         * @param SCIOVA_Settings_Repository|null $settings_repo
         */
        public function __construct(?SCIOVA_Settings_Repository $settings_repo = null)
        {
            $this->settings = $settings_repo ?: new SCIOVA_Settings_Repository();
        }

        /**
         * Register REST routes.
         *
         * @return void
         */
        public function register_routes(): void
        {
            register_rest_route($this->namespace, '/settings/test', [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [$this, 'test_keys'],
                'permission_callback' => [$this, 'permissions_check'],
            ]);

            register_rest_route($this->namespace, '/settings', [
                [
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => [$this, 'get_settings'],
                    'permission_callback' => [$this, 'permissions_check'],
                ],
                [
                    'methods'             => WP_REST_Server::CREATABLE,
                    'callback'            => [$this, 'update_settings'],
                    'permission_callback' => [$this, 'permissions_check'],
                    'args'                => [
                        'crux_api_key' => [
                            'required'          => false,
                            'sanitize_callback' => 'sanitize_text_field',
                        ],
                        'psi_api_key' => [
                            'required'          => false,
                            'sanitize_callback' => 'sanitize_text_field',
                        ],
                        'crux_form_factor' => [
                            'required'          => false,
                            'sanitize_callback' => 'sanitize_text_field',
                        ],
                        'crux_period_count' => [
                            'required'          => false,
                            'sanitize_callback' => 'absint',
                        ],
                        'default_ma_window' => [
                            'required' => false,
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
         * GET /settings.
         *
         * @param WP_REST_Request $request
         * @return WP_REST_Response
         */
        public function get_settings(WP_REST_Request $request): WP_REST_Response
        {
            $policy = new SCIOVA_Freemium_Policy();

            $data = $this->settings->get_settings();

            $data['capabilities'] = [
                'ma_windows' => $policy->get_allowed_ma_windows(),
            ];

            $data['preferences'] = [
                'default_ma_window' => $this->settings->get_default_ma_window(),
            ];

            return SCIOVA_REST_Response::success($data, 200);
        }

        /**
         * POST /settings.
         *
         * Updates only provided + valid values.
         *
         * @param WP_REST_Request $request
         * @return WP_REST_Response
         */
        public function update_settings(WP_REST_Request $request): WP_REST_Response
        {
            $did_update = false;

            $crux_key = (string) $request->get_param('crux_api_key');
            $psi_key  = (string) $request->get_param('psi_api_key');

            // Keys: only update if present and non-empty.
            if ($request->has_param('crux_api_key') && trim($crux_key) !== '') {
                $did_update = $this->settings->set_crux_api_key($crux_key) || $did_update;
            }

            if ($request->has_param('psi_api_key') && trim($psi_key) !== '') {
                $did_update = $this->settings->set_psi_api_key($psi_key) || $did_update;
            }

            // CrUX Step 5 settings.
            if ($request->has_param('crux_form_factor')) {
                $ff = (string) $request->get_param('crux_form_factor');
                // Allow empty string for ALL.
                $ok = $this->settings->set_crux_form_factor($ff);
                if (! $ok && trim($ff) !== '') {
                    return SCIOVA_REST_Response::error('invalid_form_factor', 'Invalid CrUX form factor.', 400);
                }
                $did_update = $ok || $did_update;
            }

            if ($request->has_param('crux_period_count')) {
                $pc = (int) $request->get_param('crux_period_count');
                // Only treat as invalid if a non-zero value is provided and out of bounds.
                if ($pc !== 0) {
                    $ok = $this->settings->set_crux_period_count($pc);
                    if (! $ok) {
                        return SCIOVA_REST_Response::error('invalid_period_count', 'Invalid CrUX period count (must be 1..40).', 400);
                    }
                    $did_update = true;
                }
            }

            if ($request->has_param('default_ma_window')) {
                $ma = (int) $request->get_param('default_ma_window');

                if (! $this->settings->set_default_ma_window($ma)) {
                    return SCIOVA_REST_Response::error(
                        'invalid_ma_window',
                        'Invalid moving average window.',
                        400
                    );
                }

                $did_update = true;
            }

            // Return current settings payload (masked).
            $data = $this->settings->get_settings();
            $data['updated'] = $did_update;

            return SCIOVA_REST_Response::success($data, 200);
        }

        /**
         * GET /settings/test
         *
         * Tests CrUX and PSI API keys against known-good URLs.
         *
         * @param WP_REST_Request $request
         * @return WP_REST_Response
         */
        public function test_keys(WP_REST_Request $request): WP_REST_Response
        {
            $crux_key = $this->settings->get_crux_api_key_raw();
            $psi_key  = $this->settings->get_psi_api_key_raw();

            $results = [];

            // Test CrUX key with a known-good URL (google.com)
            if ($crux_key) {
                $crux_client = new SCIOVA_CrUX_History_Client();
                $res = $crux_client->query_url($crux_key, 'https://www.google.com/', [
                    'collection_period_count' => 1,
                    'metrics' => ['largest_contentful_paint'],
                ]);
                $results['crux'] = is_wp_error($res)
                    ? ['ok' => false, 'message' => $res->get_error_message()]
                    : ['ok' => true,  'message' => 'CrUX API key is working.'];
            } else {
                $results['crux'] = ['ok' => false, 'message' => 'No CrUX API key configured.'];
            }

            // Test PSI key with google.com
            if ($psi_key) {
                $endpoint = sprintf(
                    'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=%s&strategy=mobile&category=performance',
                    urlencode('https://www.google.com/')
                );
                $res = wp_remote_get($endpoint, [
                    'timeout' => 15,
                    'headers' => ['X-Goog-Api-Key' => $psi_key],
                ]);
                if (is_wp_error($res)) {
                    $results['psi'] = ['ok' => false, 'message' => $res->get_error_message()];
                } else {
                    $code = (int) wp_remote_retrieve_response_code($res);
                    $body = json_decode(wp_remote_retrieve_body($res), true);
                    if ($code >= 200 && $code < 300 && !empty($body['lighthouseResult'])) {
                        $results['psi'] = ['ok' => true, 'message' => 'PSI API key is working.'];
                    } else {
                        $msg = (is_array($body) && isset($body['error']['message'])) ? $body['error']['message'] : 'PSI request failed (HTTP ' . $code . ').';
                        $results['psi'] = ['ok' => false, 'message' => $msg];
                    }
                }
            } else {
                $results['psi'] = ['ok' => false, 'message' => 'No PSI API key configured.'];
            }

            return SCIOVA_REST_Response::success($results, 200);
        }
    }
}
