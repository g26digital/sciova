<?php

/**
 * URL repository.
 *
 * Data access layer for tracked URLs.
 *
 * @package Sciova
 * @subpackage Core
 */

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Class SCIOVA_Url_Repository
 *
 * Repository for CRUD operations on tracked URLs.
 *
 * Notes:
 * - URLs are stored in the `{prefix}sciova_urls` table.
 * - For consistency and duplicate prevention, normalize URLs before inserting.
 *
 * @since 0.1.0
 */
class SCIOVA_Url_Repository
{
    /**
     * Base table name (without WP prefix).
     *
     * @since 0.1.0
     * @var string
     */
    private const TABLE = 'sciova_urls';

    /**
     * Get the fully-qualified table name (with WP prefix).
     *
     * @since 0.1.0
     *
     * @return string Fully-qualified table name.
     */
    private function table(): string
    {
        global $wpdb;
        return $wpdb->prefix . self::TABLE;
    }


    /**
     * Find a tracked URL row by ID.
     *
     * @param int $id URL row ID.
     * @return array|null Associative row or null if not found.
     */
    public function find_by_id(int $id): ?array
    {
        global $wpdb;

        $id = (int) $id;
        if ($id <= 0) {
            return null;
        }

        $table = esc_sql( $this->table() );

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
        $row = $wpdb->get_row(
            $wpdb->prepare("SELECT id, url, created_at FROM {$table} WHERE id = %d LIMIT 1", $id), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $table sanitised via esc_sql(), derived from $wpdb->prefix constant.
            ARRAY_A
        );

        return is_array($row) ? $row : null;
    }

    /**
     * Get all tracked URLs.
     *
     * @since 0.1.0
     *
     * @return array<int, object> List of URL rows (id, url, created_at).
     */
    public function get_all(): array
    {
        global $wpdb;

        $table = esc_sql( $this->table() );
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
        return $wpdb->get_results(
            "SELECT id, url, created_at FROM {$table} ORDER BY created_at DESC" // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared,WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $table sanitised via esc_sql(), derived from $wpdb->prefix constant.
        );
    }

    /**
     * Count all tracked URLs.
     *
     * @since 0.1.0
     *
     * @return int Total number of tracked URLs.
     */
    public function count_all(): int
    {
        global $wpdb;

        $table = esc_sql( $this->table() );
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
        return (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$table}" // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared,WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $table sanitised via esc_sql(), derived from $wpdb->prefix constant.
        );
    }

    /**
     * Add a new URL to track.
     *
     * IMPORTANT:
     * - Call {@see normalize_url()} before storing to enforce consistent format.
     *
     * @since 0.1.0
     *
     * @param string $url Normalized URL to insert.
     * @return int Insert ID (0 if insert failed).
     */
    public function add(string $url): int
    {
        global $wpdb;

        $now = current_time('mysql');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
        $wpdb->insert(
            $this->table(),
            [
                'url'        => $url,
                'created_at' => $now,
            ],
            ['%s', '%s']
        );

        return (int) $wpdb->insert_id;
    }

    /**
     * Normalize a URL for consistent storage and duplicate prevention.
     *
     * Rules (MVP):
     * - Trim whitespace
     * - Ensure scheme (https://) if missing
     * - Validate URL format
     * - Lowercase scheme + host
     * - Strip fragments
     * - Remove trailing slash (except root "/")
     * - Keep query string (current behavior)
     *
     * NOTE:
     * For a canonical-page tracking mode, you may want to drop query strings.
     *
     * @since 0.1.0
     *
     * @param string $url Raw URL input.
     * @return string Normalized URL, or empty string if invalid.
     */
    public function normalize_url(string $url): string
    {
        $url = trim($url);

        if ($url === '') {
            return '';
        }

        // Force scheme if missing (MVP-friendly default: https).
        if (! preg_match('#^https?://#i', $url)) {
            $url = 'https://' . $url;
        }

        // Validate.
        if (! filter_var($url, FILTER_VALIDATE_URL)) {
            return '';
        }

        // Parse and rebuild to enforce normalization.
        $parts = wp_parse_url($url);
        if (empty($parts['host'])) {
            return '';
        }

        $scheme = ! empty($parts['scheme']) ? strtolower((string) $parts['scheme']) : 'https';
        $host   = strtolower((string) $parts['host']);
        $path   = ! empty($parts['path']) ? (string) $parts['path'] : '/';

        // Remove trailing slash (but keep "/" as "/").
        if ($path !== '/') {
            $path = rtrim($path, '/');
        }

        $normalized = $scheme . '://' . $host . $path;

        // Keep query string if present.
        if (! empty($parts['query'])) {
            $normalized .= '?' . (string) $parts['query'];
        }

        return $normalized;
    }

    /**
     * Check if a URL already exists (by exact URL string).
     *
     * IMPORTANT:
     * - For best results, pass a normalized URL.
     *
     * @since 0.1.0
     *
     * @param string $url URL to check (preferably normalized).
     * @return bool True if the URL exists, otherwise false.
     */
    public function exists(string $url): bool
    {
        global $wpdb;

        $table = esc_sql( $this->table() );
        $sql   = $wpdb->prepare(
            "SELECT COUNT(1) FROM {$table} WHERE url = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $table sanitised via esc_sql(), derived from $wpdb->prefix constant.
            $url
        );

        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared,WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
        return (int) $wpdb->get_var($sql) > 0;
    }

    /**
     * Delete a tracked URL by ID.
     *
     * @since 0.1.0
     *
     * @param int $id URL row ID.
     * @return bool True if deleted, false otherwise.
     */
    public function delete_url(int $id): bool
    {
        global $wpdb;

        // Remove any notes associated with this URL before deleting it.
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
        $wpdb->delete($wpdb->prefix . 'sciova_notes', ['url_id' => $id], ['%d']);

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
        $deleted = $wpdb->delete($this->table(), ['id' => $id], ['%d']);

        return $deleted !== false && $deleted > 0;
    }
}
