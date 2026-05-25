<?php

/**
 * PSI repository (free basics) for Sciova.
 *
 * Responsibilities:
 * - Fetch PSI JSON via SCIOVA_PSI_Client
 * - Parse and extract ONLY freemium fields:
 *   - Performance score
 *   - FCP, LCP, CLS
 * - Cache per URL in a transient
 *
 * @package Sciova
 * @subpackage Core
 * @since 0.3.0
 */

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Class SCIOVA_PSI_Repository
 */
class SCIOVA_PSI_Repository
{
    /**
     * URL repository.
     *
     * @var SCIOVA_Url_Repository
     */
    protected SCIOVA_Url_Repository $urls;

    /**
     * Settings repository.
     *
     * @var SCIOVA_Settings_Repository
     */
    protected SCIOVA_Settings_Repository $settings;

    /**
     * PSI client.
     *
     * @var SCIOVA_PSI_Client
     */
    protected SCIOVA_PSI_Client $client;

    /**
     * Cache TTL (seconds).
     *
     * PSI can be rate-limited; caching is essential.
     *
     * @var int
     */
    protected int $cache_ttl = 3 * HOUR_IN_SECONDS;

    /**
     * Constructor.
     *
     * @param SCIOVA_Url_Repository      $urls
     * @param SCIOVA_Settings_Repository $settings
     * @param SCIOVA_PSI_Client          $client
     */
    public function __construct(SCIOVA_Url_Repository $urls, SCIOVA_Settings_Repository $settings, SCIOVA_PSI_Client $client)
    {
        $this->urls     = $urls;
        $this->settings = $settings;
        $this->client   = $client;
    }

    /**
     * Get PSI summary for a tracked URL id.
     *
     * @param int  $url_id
     * @param bool $force_refresh
     * @return array|WP_Error
     */
    public function get_summary(int $url_id, bool $force_refresh = false)
    {
        if ($url_id <= 0) {
            return new WP_Error('invalid_url_id', 'Invalid url_id.');
        }

        $row = $this->urls->find_by_id($url_id);
        if (! $row) {
            return new WP_Error('not_found', 'URL not found.');
        }

        $psi_key = $this->settings->get_psi_api_key_raw();
        if (! $psi_key) {
            return new WP_Error('missing_psi_key', 'PSI API key is not configured.');
        }

        $cache_key = $this->cache_key($url_id);

        if (! $force_refresh) {
            $cached = get_transient($cache_key);
            // Accept cache entries that have at least one of mobile/desktop or legacy summary.
            if (is_array($cached) && (isset($cached['mobile']) || isset($cached['desktop']) || isset($cached['summary']))) {
                $out = $cached;
                $out['from_cache'] = true;
                $out['url_id']     = $url_id;
                $out['url']        = (string) $row['url'];
                return $out;
            }
        }

        // Fetch both strategies.
        $raw_mobile  = $this->client->fetch((string) $row['url'], 'mobile');
        $raw_desktop = $this->client->fetch((string) $row['url'], 'desktop');

        if (! $raw_mobile && ! $raw_desktop) {
            return new WP_Error('psi_fetch_failed', 'Failed to fetch PSI results.');
        }

        $summary_mobile  = $raw_mobile  ? $this->extract_summary($raw_mobile)  : null;
        $summary_desktop = $raw_desktop ? $this->extract_summary($raw_desktop) : null;

        // Fall back gracefully if one strategy errors.
        if (is_wp_error($summary_mobile))  { $summary_mobile  = null; }
        if (is_wp_error($summary_desktop)) { $summary_desktop = null; }

        if (! $summary_mobile && ! $summary_desktop) {
            return new WP_Error('psi_fetch_failed', 'Failed to parse PSI results.');
        }

        // Back-compat: keep top-level 'summary' pointing to mobile (or desktop fallback).
        $summary_primary = $summary_mobile ?: $summary_desktop;

        $data = [
            'url_id'        => $url_id,
            'url'           => (string) $row['url'],
            'from_cache'    => false,
            'fetched_at'    => time(),
            'cache_ttl_sec' => $this->cache_ttl,
            'summary'       => $summary_primary,
            'mobile'        => $summary_mobile,
            'desktop'       => $summary_desktop,
        ];

        set_transient($cache_key, $data, $this->cache_ttl);

        return $data;
    }

    /**
     * Refresh PSI cache for the given url_id.
     *
     * Used after POST /urls (auto-run PSI for newly added URLs).
     *
     * @param int $url_id
     * @return void
     */
    public function refresh(int $url_id): void
    {
        $this->get_summary($url_id, true);
    }

    /**
     * Build transient cache key.
     *
     * @param int $url_id
     * @return string
     */
    protected function cache_key(int $url_id): string
    {
        return 'sciova_psi_' . md5((string) $url_id);
    }

    /**
     * Extract freemium PSI summary fields from the PSI response.
     *
     * @param array $payload
     * @return array|WP_Error
     */
    protected function extract_summary(array $payload)
    {
        $lhr = $payload['lighthouseResult'] ?? null;
        if (! is_array($lhr)) {
            return new WP_Error('psi_bad_payload', 'PSI payload missing lighthouseResult.');
        }

        $categories = $lhr['categories'] ?? [];
        $perf       = is_array($categories) && isset($categories['performance']) ? $categories['performance'] : null;

        $score = null;
        if (is_array($perf) && isset($perf['score'])) {
            $score = round(((float) $perf['score']) * 100);
        }

        $audits = $lhr['audits'] ?? [];
        if (! is_array($audits)) {
            $audits = [];
        }

        $fcp = $this->audit_numeric($audits, 'first-contentful-paint');
        $lcp = $this->audit_numeric($audits, 'largest-contentful-paint');
        $cls = $this->audit_numeric($audits, 'cumulative-layout-shift');

        return [
            'performance_score' => $score,
            'fcp_ms'            => $fcp,
            'lcp_ms'            => $lcp,
            'cls'               => $cls,
        ];
    }

    /**
     * Read numericValue from an audit.
     *
     * @param array  $audits
     * @param string $key
     * @return float|null
     */
    protected function audit_numeric(array $audits, string $key): ?float
    {
        if (! isset($audits[$key]) || ! is_array($audits[$key])) {
            return null;
        }

        $v = $audits[$key]['numericValue'] ?? null;
        if ($v === null) {
            return null;
        }

        return (float) $v;
    }
}
