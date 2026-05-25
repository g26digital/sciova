<?php

/**
 * PageSpeed Insights API client.
 *
 * @package Sciova
 * @subpackage Integrations
 */

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Class SCIOVA_PSI_Client
 *
 * Handles PSI API calls and returns JSON results for analysis.
 */
class SCIOVA_PSI_Client
{

    /**
     * Fetch PSI results for a given URL and strategy.
     *
     * Reads the API key fresh on each call so key updates take effect
     * without requiring a page reload or re-instantiation.
     *
     * @param string $url      Target URL.
     * @param string $strategy 'mobile' or 'desktop'.
     * @return array|false
     */
    public function fetch(string $url, string $strategy = 'mobile')
    {
        $api_key = (string) get_option('sciova_psi_api_key', '');

        if (empty($api_key)) {
            return false;
        }

        $strategy = in_array($strategy, ['mobile', 'desktop'], true) ? $strategy : 'mobile';

        $endpoint = sprintf(
            'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=%s&strategy=%s',
            urlencode($url),
            $strategy
        );

        $response = wp_remote_get($endpoint, array(
            'timeout' => 45,
            'headers' => array('X-Goog-Api-Key' => $api_key),
        ));
        if (is_wp_error($response)) {
            return false;
        }

        $data = json_decode(wp_remote_retrieve_body($response), true);

        return ! empty($data) ? $data : false;
    }
}
