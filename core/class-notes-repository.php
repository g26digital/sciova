<?php
/**
 * Notes repository (MVP).
 *
 * Stores site-wide notes or URL-specific notes keyed by date.
 *
 * @package Sciova
 * @subpackage Core
 * @since 0.2.0
 */

if (! defined('ABSPATH')) {
    exit;
}

class SCIOVA_Notes_Repository
{
    /**
     * Table name.
     *
     * @return string
     */
    protected function table(): string
    {
        global $wpdb;
        return $wpdb->prefix . 'sciova_notes';
    }

    /**
     * List notes in a date range.
     *
     * If $url_id is provided, returns both:
     * - notes for that url_id
     * - site-wide notes (url_id IS NULL)
     *
     * If $url_id is null, returns site-wide notes only.
     *
     * @param int|null $url_id
     * @param string   $from_ymd YYYY-MM-DD
     * @param string   $to_ymd   YYYY-MM-DD
     * @return array<int, array<string, mixed>>
     */
    public function list(?int $url_id, string $from_ymd, string $to_ymd): array
    {
        global $wpdb;

        $table = esc_sql( $this->table() );

        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $table sanitised via esc_sql(), derived from $wpdb->prefix constant.
        if ($url_id) {
            $sql = $wpdb->prepare(
                "SELECT id, url_id, note_date, content, created_at, updated_at
                 FROM {$table}
                 WHERE note_date BETWEEN %s AND %s
                   AND (url_id = %d OR url_id IS NULL)
                 ORDER BY note_date DESC, id DESC",
                $from_ymd,
                $to_ymd,
                $url_id
            );
        } else {
            $sql = $wpdb->prepare(
                "SELECT id, url_id, note_date, content, created_at, updated_at
                 FROM {$table}
                 WHERE note_date BETWEEN %s AND %s
                   AND url_id IS NULL
                 ORDER BY note_date DESC, id DESC",
                $from_ymd,
                $to_ymd
            );
        }
        // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared

        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared,WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
        $rows = $wpdb->get_results($sql, ARRAY_A);

        return is_array($rows) ? $rows : [];
    }

    /**
     * Insert a new note.
     *
     * @param int|null $url_id
     * @param string   $note_date_ymd YYYY-MM-DD
     * @param string   $content
     * @return int Inserted ID
     */
    
    public function add(?int $url_id, string $note_date_ymd, string $content): int
    {
        global $wpdb;

        $table = esc_sql( $this->table() );
        $now   = current_time('mysql');

        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $table sanitised via esc_sql(), derived from $wpdb->prefix constant.
        if ($url_id) {
            $sql = $wpdb->prepare(
                "INSERT INTO {$table} (url_id, note_date, content, created_at, updated_at)
                 VALUES (%d, %s, %s, %s, %s)",
                $url_id,
                $note_date_ymd,
                $content,
                $now,
                $now
            );
        } else {
            $sql = $wpdb->prepare(
                "INSERT INTO {$table} (url_id, note_date, content, created_at, updated_at)
                 VALUES (NULL, %s, %s, %s, %s)",
                $note_date_ymd,
                $content,
                $now,
                $now
            );
        }
        // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared

        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared,WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
        $ok = $wpdb->query($sql);
        if (! $ok) {
            return 0;
        }

        return (int) $wpdb->insert_id;
    }


    /**
     * Delete a note by ID.
     *
     * @param int $id
     * @return bool
     */
    public function delete(int $id): bool
    {
        global $wpdb;

        $table = $this->table();

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
        $deleted = $wpdb->delete($table, ['id' => $id], ['%d']);

        return (bool) $deleted;
    }
}
