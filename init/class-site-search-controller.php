<?php
/**
 * Site search REST controller.
 *
 * Helps users add tracked URLs by selecting from existing content
 * (pages, posts, and public CPTs with show_in_rest enabled).
 *
 * Endpoint:
 * - GET /sciova/v1/site-search?q=...
 *
 * @package Sciova
 * @subpackage Init
 * @since 0.2.0
 */

if (! defined('ABSPATH')) {
    exit;
}

class SCIOVA_Site_Search_Controller
{
    /**
     * REST namespace.
     *
     * @var string
     */
    private string $namespace = 'sciova/v1';

    /**
     * Register routes.
     *
     * @return void
     */
    public function register_routes(): void
    {
        register_rest_route($this->namespace, '/site-search', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [$this, 'search'],
            'permission_callback' => function () {
                return current_user_can('manage_options');
            },
            'args'                => [
                'q' => [
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ],
            ],
        ]);
    }

    /**
     * GET /site-search?q=...
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function search(WP_REST_Request $request): WP_REST_Response
    {
        $q = trim((string) $request->get_param('q'));
        if (strlen($q) < 2) {
            return SCIOVA_REST_Response::success(['items' => []], 200);
        }

        // Only query public post types that are exposed in REST (typical for pages/posts/CPTs).
        $types = get_post_types(['public' => true, 'show_in_rest' => true], 'objects');
        $post_types = [];
        $type_labels = [];
        foreach ($types as $name => $obj) {
            $post_types[] = $name;
            $type_labels[$name] = isset($obj->labels->singular_name) ? $obj->labels->singular_name : $name;
        }

        $args = [
            'post_type'      => $post_types,
            'post_status'    => 'publish',
            's'              => $q,
            'posts_per_page' => 20,
            'orderby'        => 'relevance',
            'no_found_rows'  => true,
        ];

        $query = new WP_Query($args);

        $items = [];
        if ($query->have_posts()) {
            foreach ($query->posts as $post) {
                $pt = (string) $post->post_type;
                $items[] = [
                    'id'      => (int) $post->ID,
                    'title'   => get_the_title($post),
                    'type'    => $pt,
                    'subtype' => $type_labels[$pt] ?? $pt,
                    'url'     => get_permalink($post),
                ];
            }
        }

        return SCIOVA_REST_Response::success(['items' => $items], 200);
    }
}
