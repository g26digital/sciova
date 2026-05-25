<?php
/**
 * Metrics controller (CrUX History) for Sciova.
 *
 * Provides the Step 5 MVP endpoint:
 * - GET /sciova/v1/metrics?url_id=123
 *
 * Returns:
 * - Periods (collectionPeriods)
 * - p75 timeseries for LCP/CLS (+ optional INP)
 * - 5-period and 10-period moving averages (period MA)
 * - Simple trend classification for each MA series
 *
 * Caching:
 * - Raw CrUX History API response cached in a transient per (url_id, form_factor, period_count)
 *
 * @package Sciova
 * @subpackage Init
 * @since 0.2.0
 */

if (! defined('ABSPATH')) {
    exit;
}

if (! class_exists('SCIOVA_Metrics_Controller')) {

    /**
     * Class SCIOVA_Metrics_Controller
     *
     * @since 0.2.0
     */
    class SCIOVA_Metrics_Controller
    {
        /**
         * Namespace for routes.
         *
         * @var string
         */
        protected $namespace = 'sciova/v1';

        /**
         * URL repository.
         *
         * @var SCIOVA_Url_Repository
         */
        protected $urls;

        /**
         * Settings repository.
         *
         * @var SCIOVA_Settings_Repository
         */
        protected $settings;

        /**
         * CrUX History client.
         *
         * @var SCIOVA_CrUX_History_Client
         */
        protected $crux;

        /**
         * Trend engine.
         *
         * @var SCIOVA_Trend_Engine
         */
        protected $trend;

        /**
         * Cache TTL for CrUX History API response (seconds).
         *
         * CrUX History data updates weekly; a 1-6 hour cache is safe for UX.
         *
         * @var int
         */
        protected $cache_ttl = 3 * HOUR_IN_SECONDS;

        /**
         * Constructor.
         *
         * @param SCIOVA_Url_Repository        $urls
         * @param SCIOVA_Settings_Repository   $settings
         * @param SCIOVA_CrUX_History_Client   $crux
         * @param SCIOVA_Trend_Engine          $trend
         */
        public function __construct(
            SCIOVA_Url_Repository $urls,
            SCIOVA_Settings_Repository $settings,
            SCIOVA_CrUX_History_Client $crux,
            SCIOVA_Trend_Engine $trend
        ) {
            $this->urls     = $urls;
            $this->settings = $settings;
            $this->crux     = $crux;
            $this->trend    = $trend;
        }

        /**
         * Register routes.
         *
         * @return void
         */
        public function register_routes(): void
        {
            register_rest_route($this->namespace, '/metrics', [
                [
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => [$this, 'get_metrics'],
                    'permission_callback' => [$this, 'permissions_check'],
                    'args'                => [
                        'url_id' => [
                            'required'          => true,
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
         * GET /metrics
         *
         * @param WP_REST_Request $request
         * @return WP_REST_Response
         */
        public function get_metrics(WP_REST_Request $request): WP_REST_Response
        {
            $url_id = (int) $request->get_param('url_id');

            if ($url_id <= 0) {
                return SCIOVA_REST_Response::error('invalid_url_id', 'Invalid url_id.', 400);
            }

            $row = $this->urls->find_by_id($url_id);
            if (! $row) {
                return SCIOVA_REST_Response::error('not_found', 'URL not found.', 404);
            }

            $settings = $this->settings->get_settings();

            if (empty($settings['has_crux_key'])) {
                return SCIOVA_REST_Response::error('missing_crux_key', 'CrUX API key is not configured.', 400);
            }

            $api_key = $this->settings->get_crux_api_key_raw();
            if (! $api_key) {
                return SCIOVA_REST_Response::error('missing_crux_key', 'CrUX API key is not configured.', 400);
            }

            $form_factor  = $this->settings->get_crux_form_factor(); // PHONE/DESKTOP/TABLET/''(all)
            $period_count = $this->settings->get_crux_period_count(); // 1..40

            $cache_key = $this->cache_key($url_id, $form_factor, $period_count);
            $cached = get_transient($cache_key);

            $from_cache = true;
            $fetched_at = 0;

            // Back-compat: older transients stored payload directly.
            if (is_array($cached) && isset($cached['payload']) && is_array($cached['payload'])) {
                $raw       = $cached['payload'];
                $fetched_at = isset($cached['fetched_at']) ? (int) $cached['fetched_at'] : 0;
            } else {
                $raw = $cached;
            }

            if (! is_array($raw)) {
                $from_cache = false;
                $fetched_at = time();

                $raw = $this->crux->query_url($api_key, (string) $row['url'], [
                    'form_factor'            => $form_factor,
                    'collection_period_count'=> $period_count,
                    'metrics'                => [
                        'largest_contentful_paint',
                        'cumulative_layout_shift',
                        'interaction_to_next_paint',
                    ],
                ]);

                if (is_wp_error($raw)) {
                    // Do not leak secrets; raw error messages from Google are fine (no API key included).
                    return SCIOVA_REST_Response::error(
                        $raw->get_error_code(),
                        $raw->get_error_message(),
                        502,
                        $raw->get_error_data()
                    );
                }

                set_transient(
                    $cache_key,
                    [
                        'fetched_at' => $fetched_at,
                        'payload'    => $raw,
                    ],
                    $this->cache_ttl
                );
            }

            $parsed = $this->parse_history_payload($raw);

            if (is_wp_error($parsed)) {
                return SCIOVA_REST_Response::error(
                    $parsed->get_error_code(),
                    $parsed->get_error_message(),
                    500
                );
            }

            $lcp = $parsed['metrics']['lcp_p75'];
            $cls = $parsed['metrics']['cls_p75'];
            $inp = $parsed['metrics']['inp_p75'];

            $ma5_lcp  = $this->trend->moving_average($lcp, 5);
            $ma10_lcp = $this->trend->moving_average($lcp, 10);

            $ma5_cls  = $this->trend->moving_average($cls, 5);
            $ma10_cls = $this->trend->moving_average($cls, 10);

            $ma5_inp  = $this->trend->moving_average($inp, 5);
            $ma10_inp = $this->trend->moving_average($inp, 10);

            $out = [
                'url_id'        => $url_id,
                'url'           => (string) $row['url'],
                'form_factor'   => $form_factor ?: 'ALL',
                'period_count'  => $period_count,
                'from_cache'    => $from_cache,
                'fetched_at'    => $fetched_at,
                'last_updated'  => $fetched_at ? wp_date('Y-m-d H:i', $fetched_at) : null,
                'cache_ttl_sec' => $this->cache_ttl,
                'periods'       => $parsed['periods'],
                'metrics'       => [
                    'lcp' => [
                        'p75'  => $lcp,
                        'ma5'  => $ma5_lcp,
                        'ma10' => $ma10_lcp,
                    ],
                    'cls' => [
                        'p75'  => $cls,
                        'ma5'  => $ma5_cls,
                        'ma10' => $ma10_cls,
                    ],
                    'inp' => [
                        'p75'  => $inp,
                        'ma5'  => $ma5_inp,
                        'ma10' => $ma10_inp,
                    ],
                ],
                'classification' => [
                    'ma5' => [
                        'lcp' => $this->trend->classify($ma5_lcp, 'lcp'),
                        'cls' => $this->trend->classify($ma5_cls, 'cls'),
                        'inp' => $this->trend->classify($ma5_inp, 'inp'),
                    ],
                    'ma10' => [
                        'lcp' => $this->trend->classify($ma10_lcp, 'lcp'),
                        'cls' => $this->trend->classify($ma10_cls, 'cls'),
                        'inp' => $this->trend->classify($ma10_inp, 'inp'),
                    ],
                ],
            ];

            return SCIOVA_REST_Response::success($out, 200);
        }

        /**
         * Build a stable transient cache key for a given query.
         *
         * @param int    $url_id
         * @param string $form_factor
         * @param int    $period_count
         * @return string
         */
        protected function cache_key(int $url_id, string $form_factor, int $period_count): string
        {
            $ff = $form_factor ? strtoupper($form_factor) : 'ALL';
            $pc = max(1, min(40, (int) $period_count));

            return 'sciova_crux_hist_' . md5($url_id . '|' . $ff . '|' . $pc);
        }

        /**
         * Parse CrUX History API response.
         *
         * @param array $payload
         * @return array|WP_Error
         */
        protected function parse_history_payload(array $payload)
        {
            if (! isset($payload['record']) || ! is_array($payload['record'])) {
                return new WP_Error('sciova_crux_bad_payload', 'CrUX history payload missing record.');
            }

            $record = $payload['record'];

            $periods = [];
            if (isset($record['collectionPeriods']) && is_array($record['collectionPeriods'])) {
                foreach ($record['collectionPeriods'] as $p) {
                    $periods[] = [
                        'start' => $this->date_obj_to_ymd($p['firstDate'] ?? null),
                        'end'   => $this->date_obj_to_ymd($p['lastDate'] ?? null),
                    ];
                }
            }

            $metrics = isset($record['metrics']) && is_array($record['metrics']) ? $record['metrics'] : [];

            $lcp = $this->extract_p75_timeseries($metrics, 'largest_contentful_paint', 'int');
            $cls = $this->extract_p75_timeseries($metrics, 'cumulative_layout_shift', 'float');
            $inp = $this->extract_p75_timeseries($metrics, 'interaction_to_next_paint', 'int');

            // Ensure arrays align to the period count length if periods exist.
            $n = count($periods);
            if ($n > 0) {
                $lcp = $this->pad_or_trim($lcp, $n);
                $cls = $this->pad_or_trim($cls, $n);
                $inp = $this->pad_or_trim($inp, $n);
            }

            return [
                'periods' => $periods,
                'metrics' => [
                    'lcp_p75' => $lcp,
                    'cls_p75' => $cls,
                    'inp_p75' => $inp,
                ],
            ];
        }

        /**
         * Extract p75s[] from percentilesTimeseries for a specific metric.
         *
         * @param array  $metrics
         * @param string $metric_key
         * @param string $type 'int'|'float'
         * @return array
         */
        protected function extract_p75_timeseries(array $metrics, string $metric_key, string $type = 'float'): array
        {
            if (! isset($metrics[$metric_key]) || ! is_array($metrics[$metric_key])) {
                return [];
            }

            $m = $metrics[$metric_key];

            if (! isset($m['percentilesTimeseries']['p75s']) || ! is_array($m['percentilesTimeseries']['p75s'])) {
                return [];
            }

            $out = [];
            foreach ($m['percentilesTimeseries']['p75s'] as $v) {
                if ($v === null) {
                    $out[] = null;
                    continue;
                }

                if (is_string($v) && strtolower(trim($v)) === 'nan') {
                    $out[] = null;
                    continue;
                }

                if ($type === 'int') {
                    $out[] = is_numeric($v) ? (int) $v : null;
                } else {
                    $out[] = is_numeric($v) ? (float) $v : null;
                }
            }

            return $out;
        }

        /**
         * Convert CrUX date object to YYYY-MM-DD.
         *
         * CrUX date object is { year, month, day }.
         *
         * @param array|null $d
         * @return string|null
         */
        protected function date_obj_to_ymd($d): ?string
        {
            if (! is_array($d)) {
                return null;
            }

            $y = isset($d['year']) ? (int) $d['year'] : 0;
            $m = isset($d['month']) ? (int) $d['month'] : 0;
            $day = isset($d['day']) ? (int) $d['day'] : 0;

            if ($y <= 0 || $m <= 0 || $day <= 0) {
                return null;
            }

            return sprintf('%04d-%02d-%02d', $y, $m, $day);
        }

        /**
         * Pad with nulls or trim to match length.
         *
         * @param array $arr
         * @param int   $n
         * @return array
         */
        protected function pad_or_trim(array $arr, int $n): array
        {
            $arr = array_values($arr);

            if (count($arr) > $n) {
                return array_slice($arr, 0, $n);
            }

            while (count($arr) < $n) {
                $arr[] = null;
            }

            return $arr;
        }
    }
}
