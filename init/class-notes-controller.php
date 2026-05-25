<?php
/**
 * Notes REST controller (MVP).
 *
 * Endpoints:
 * - GET    /sciova/v1/notes?url_id=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 * - POST   /sciova/v1/notes
 * - DELETE /sciova/v1/notes/{id}
 *
 * @package Sciova
 * @subpackage Init
 * @since 0.2.0
 */

if (! defined('ABSPATH')) {
    exit;
}

if (! class_exists('SCIOVA_Notes_Controller')) {

class SCIOVA_Notes_Controller
{
    /**
     * REST namespace.
     *
     * @var string
     */
    private string $namespace = 'sciova/v1';

    private SCIOVA_Notes_Repository $notes;
    private SCIOVA_Url_Repository $urls;

    public function __construct(SCIOVA_Notes_Repository $notes, SCIOVA_Url_Repository $urls)
    {
        $this->notes = $notes;
        $this->urls  = $urls;
    }

    /**
     * Register routes.
     *
     * @return void
     */
    public function register_routes(): void
    {
        register_rest_route($this->namespace, '/notes', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [$this, 'index'],
                'permission_callback' => [$this, 'permission'],
            ],
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [$this, 'create'],
                'permission_callback' => [$this, 'permission'],
            ],
        ]);

        register_rest_route($this->namespace, '/notes/(?P<id>\d+)', [
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => [$this, 'delete'],
            'permission_callback' => [$this, 'permission'],
        ]);
    }

    public function permission(): bool
    {
        return current_user_can('manage_options');
    }

    /**
     * GET /notes
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function index(WP_REST_Request $request): WP_REST_Response
    {
        $url_id = $request->get_param('url_id');
        $url_id = is_null($url_id) ? null : (int) $url_id;

        $from = (string) $request->get_param('from');
        $to   = (string) $request->get_param('to');

        $today = current_time('Y-m-d');
        if (! $this->is_ymd($to)) {
            $to = $today;
        }
        if (! $this->is_ymd($from)) {
            // Default: last 30 days.
            $from = gmdate('Y-m-d', strtotime($to . ' -30 days'));
        }

        if ($url_id) {
            // Validate URL exists.
            $row = $this->urls->find_by_id($url_id);
            if (! $row) {
                return SCIOVA_REST_Response::error('invalid_url_id', 'Invalid url_id.', 400);
            }
        }

        $items = $this->notes->list($url_id, $from, $to);

        return SCIOVA_REST_Response::success(['items' => $items], 200);
    }

    /**
     * POST /notes
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function create(WP_REST_Request $request): WP_REST_Response
    {
        $params = (array) $request->get_json_params();

        $content = isset($params['content']) ? wp_kses_post((string) $params['content']) : '';
        $content = trim($content);
        if ($content === '') {
            return SCIOVA_REST_Response::error('invalid_content', 'Note content is required.', 400);
        }

        $note_date = isset($params['note_date']) ? sanitize_text_field((string) $params['note_date']) : '';
        // Accept full datetime — extract date portion only (column is DATE type).
        if (strlen($note_date) > 10) {
            $note_date = substr($note_date, 0, 10);
        }
        if (! $this->is_ymd($note_date)) {
            return SCIOVA_REST_Response::error('invalid_note_date', 'note_date must be YYYY-MM-DD.', 400);
        }

        $url_id = null;
        if (isset($params['url_id']) && $params['url_id'] !== '' && $params['url_id'] !== null) {
            $url_id = (int) $params['url_id'];
            if ($url_id > 0) {
                $row = $this->urls->find_by_id($url_id);
                if (! $row) {
                    return SCIOVA_REST_Response::error('invalid_url_id', 'Invalid url_id.', 400);
                }
            } else {
                $url_id = null;
            }
        }

        $id = $this->notes->add($url_id, $note_date, $content);
        if (! $id) {
            return SCIOVA_REST_Response::error('db_error', 'Failed to save note.', 500);
        }

        return SCIOVA_REST_Response::success(['id' => $id], 201);
    }

    /**
     * DELETE /notes/{id}
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function delete(WP_REST_Request $request): WP_REST_Response
    {
        $id = (int) $request->get_param('id');
        if ($id <= 0) {
            return SCIOVA_REST_Response::error('invalid_id', 'Invalid note id.', 400);
        }

        $ok = $this->notes->delete($id);
        if (! $ok) {
            return SCIOVA_REST_Response::error('not_found', 'Note not found.', 404);
        }

        return SCIOVA_REST_Response::success(['deleted' => true], 200);
    }

    private function is_ymd(string $value): bool
    {
        return (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $value);
    }
}

}
