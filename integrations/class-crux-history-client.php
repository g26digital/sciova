<?php
/**
 * CrUX History API client.
 *
 * Calls Google's CrUX History API (records:queryHistoryRecord) using a stored API key.
 *
 * Endpoint:
 * POST https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord?key=API_KEY
 *
 * Request body:
 * - url OR origin (we use URL-level for tracked URLs)
 * - formFactor: PHONE|DESKTOP|TABLET (or omit for all)
 * - metrics: array of metric names (optional)
 * - collectionPeriodCount: 1..40 (optional, default 25)
 *
 * @package Sciova
 * @subpackage Integrations
 * @since 0.2.0
 */

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Class SCIOVA_CrUX_History_Client
 *
 * @since 0.2.0
 */
class SCIOVA_CrUX_History_Client
{
    /**
     * Base endpoint for CrUX History API.
     *
     * @var string
     */
    protected $base_url = 'https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord';

    /**
     * Timeout for HTTP requests (seconds).
     *
     * @var int
     */
    protected $timeout = 45;

    /**
     * Query CrUX History API for a URL.
     *
     * @param string $api_key API key for Chrome UX Report API.
     * @param string $url     URL to query.
     * @param array  $args    Optional args:
     *                        - 'form_factor' (string) PHONE|DESKTOP|TABLET (omit for all)
     *                        - 'metrics' (array) list of metric names (optional)
     *                        - 'collection_period_count' (int) 1..40
     * @return array|\WP_Error Decoded JSON as associative array, or WP_Error on failure.
     */
    public function query_url(string $api_key, string $url, array $args = [])
    {
        $api_key = trim($api_key);
        $url     = trim($url);

        if ($api_key === '') {
            return new WP_Error('sciova_crux_missing_key', 'CrUX API key is missing.');
        }

        if ($url === '' || ! filter_var($url, FILTER_VALIDATE_URL)) {
            return new WP_Error('sciova_crux_invalid_url', 'Invalid URL.');
        }

        $endpoint = add_query_arg('key', rawurlencode($api_key), $this->base_url);

        $body = [
            'url' => $url,
        ];

        if (! empty($args['form_factor'])) {
            $ff = strtoupper((string) $args['form_factor']);
            if (in_array($ff, ['PHONE', 'DESKTOP', 'TABLET'], true)) {
                $body['formFactor'] = $ff;
            }
        }

        if (! empty($args['metrics']) && is_array($args['metrics'])) {
            $metrics = array_values(array_filter(array_map('strval', $args['metrics'])));
            if (! empty($metrics)) {
                $body['metrics'] = $metrics;
            }
        }

        if (isset($args['collection_period_count'])) {
            $c = (int) $args['collection_period_count'];
            // Per docs: 1..40, default 25.
            if ($c >= 1 && $c <= 40) {
                $body['collectionPeriodCount'] = $c;
            }
        }

        $res = wp_remote_post($endpoint, [
            'timeout' => $this->timeout,
            'headers' => [
                'Accept'       => 'application/json',
                'Content-Type' => 'application/json',
            ],
            'body'    => wp_json_encode($body),
        ]);

        if (is_wp_error($res)) {
            return $res;
        }

        $code = (int) wp_remote_retrieve_response_code($res);
        $raw  = (string) wp_remote_retrieve_body($res);

        $data = json_decode($raw, true);

        if ($code >= 200 && $code < 300) {
            if (is_array($data)) {
                return $data;
            }
            return new WP_Error('sciova_crux_invalid_json', 'CrUX API returned invalid JSON.');
        }

        // Normalize errors without leaking the API key.
        $message = 'CrUX API request failed.';
        if (is_array($data) && isset($data['error']['message']) && is_string($data['error']['message'])) {
            $message = $data['error']['message'];
        }

        // Use status code in error data for debugging.
        return new WP_Error('sciova_crux_http_error', $message, [
            'status' => $code,
        ]);
    }
}
