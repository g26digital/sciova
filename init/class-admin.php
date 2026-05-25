<?php

/**
 * Admin dashboard controller for Sciova.
 *
 * Registers the admin menu, renders the dashboard view, and enqueues
 * admin-only assets (React via wp.element; no build step).
 *
 * @package Sciova
 * @subpackage Init
 * @since 0.1.0
 */

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Class SCIOVA_Admin
 *
 * @since 0.1.0
 */
class SCIOVA_Admin
{

    /**
     * Admin page hook suffix.
     *
     * @var string|null
     */
    protected ?string $page_hook = null;

    /**
     * Constructor.
     *
     * Registers WordPress hooks for admin UI customization.
     *
     * @return void
     */
    public function __construct()
    {
        add_filter('admin_footer_text', [$this, 'footer_text']);
        add_filter('update_footer', [$this, 'update_footer'], 11);
        add_filter('plugin_action_links_' . plugin_basename(SCIOVA_PLUGIN_FILE),
            [$this, 'add_plugin_action_links']
        );
    }

    /**
     * Filter the left-side admin footer text.
     *
     * Only modifies footer text on Sciova admin screen.
     *
     * @param string $text Existing footer text.
     * @return string Modified or original footer text.
     */
    public function footer_text($text)
    {
        $screen = function_exists('get_current_screen') ? get_current_screen() : null;

        if (!$screen) {
            return $text;
        }

        if ($screen->id !== 'toplevel_page_sciova') {
            return $text;
        }

        return esc_html__('Sciova — Performance Dashboard', 'sciova-performance-intelligence');
    }

    /**
     * Filter the right-side admin footer text (WordPress version area).
     *
     * Only modifies footer text on Sciova admin screen.
     *
     * @param string $text Existing footer version text.
     * @return string Modified or original version text.
     */
    public function update_footer($text)
    {
        $screen = function_exists('get_current_screen') ? get_current_screen() : null;

        if (!$screen) {
            return $text;
        }

        if ($screen->id !== 'toplevel_page_sciova') {
            return $text;
        }

        if (defined('SCIOVA_VERSION')) {
            return sprintf(
                /* translators: %s: plugin version number */
                esc_html__('Version %s', 'sciova-performance-intelligence'),
                esc_html(SCIOVA_VERSION)
            );
        }

        return $text;
    }

    /**
     * Add custom action links on the Plugins page.
     *
     * Adds a "Dashboard" link beside Activate/Deactivate.
     *
     * @param array $links Existing plugin action links.
     * @return array Modified plugin action links.
     */
    public function add_plugin_action_links(array $links): array
    {

        $url = admin_url('admin.php?page=sciova');

        $dashboard_link = sprintf(
            '<a href="%s">%s</a>',
            esc_url($url),
            esc_html__('Dashboard', 'sciova-performance-intelligence')
        );

        // Place link before Deactivate
        array_unshift($links, $dashboard_link);

        return $links;
    }

    /**
     * Register all admin hooks.
     *
     * @return void
     */
    public static function register_hooks(): void
    {
        $instance = new self();
        add_action('admin_menu', [$instance, 'register_menu']);
        add_action('admin_enqueue_scripts', [$instance, 'enqueue_assets']);
    }

    /**
     * Register the Sciova admin menu.
     *
     * @return void
     */
    public function register_menu(): void
    {
        $this->page_hook = add_menu_page(
            __('Sciova', 'sciova-performance-intelligence'),
            __('Sciova', 'sciova-performance-intelligence'),
            'manage_options',
            'sciova',
            [$this, 'render_dashboard'],
            'data:image/svg+xml;base64,' . base64_encode( file_get_contents( SCIOVA_PATH . 'assets/img/sciova-icon.svg' ) ),
            60
        );

        // Remove the duplicate "Sciova" submenu WP auto-creates under the top-level item.
        remove_submenu_page('sciova', 'sciova');
    }

    /**
     * Render the admin dashboard container.
     *
     * App mounts into #g26-app.
     *
     * @return void
     */
    public function render_dashboard(): void
    {
        if (! current_user_can('manage_options')) {
            wp_die(esc_html__('Insufficient permissions.', 'sciova-performance-intelligence'));
        }

        $view = SCIOVA_PATH . 'views/dashboard.php';

        if (! file_exists($view)) {
            wp_die(esc_html__('Dashboard view not found.', 'sciova-performance-intelligence'));
        }

        require $view;
    }

    /**
     * Enqueue admin-only scripts and styles.
     *
     * Assets are loaded only on the Sciova admin page.
     *
     * @param string $hook Current admin page hook.
     * @return void
     */
    public function enqueue_assets(string $hook): void
    {
        if ($hook !== $this->page_hook) {
            return;
        }

        // Vendor libs
        wp_enqueue_script(
            'sciova-uplot',
            SCIOVA_URL . 'assets/uPlot.iife.js',
            [],
            SCIOVA_VERSION,
            true
        );

        // Bootstrap (WP core deps only)
        wp_enqueue_script(
            'sciova-app-bootstrap',
            SCIOVA_URL . 'assets/app/bootstrap.js',
            ['wp-element', 'wp-api-fetch'],
            SCIOVA_VERSION,
            true
        );

        // Utils should be available early and explicitly depended on
        wp_enqueue_script(
            'sciova-app-utils',
            SCIOVA_URL . 'assets/app/core/utils.js',
            ['sciova-app-bootstrap'],
            SCIOVA_VERSION,
            true
        );

        // Store should depend on utils (stabilizes shared helper availability)
        wp_enqueue_script(
            'sciova-app-store',
            SCIOVA_URL . 'assets/app/core/store.js',
            ['sciova-app-bootstrap', 'sciova-app-utils'],
            SCIOVA_VERSION,
            true
        );

        // Common components depend on store + utils
        wp_enqueue_script(
            'sciova-app-components',
            SCIOVA_URL . 'assets/app/components/common.js',
            ['sciova-app-bootstrap', 'sciova-app-store', 'sciova-app-utils'],
            SCIOVA_VERSION,
            true
        );

        wp_enqueue_script(
            'sciova-app-ui-templates',
            SCIOVA_URL . 'assets/app/ui/templates.js',
            ['sciova-app-bootstrap', 'sciova-app-utils', 'sciova-app-components'],
            SCIOVA_VERSION,
            true
        );

        // Panels
        wp_enqueue_script(
            'sciova-app-trend-panel',
            SCIOVA_URL . 'assets/app/panels/TrendPanel.js',
            ['sciova-app-bootstrap', 'sciova-app-store', 'sciova-app-utils', 'sciova-app-components', 'sciova-uplot'],
            SCIOVA_VERSION,
            true
        );

        wp_enqueue_script(
            'sciova-app-psi-panel',
            SCIOVA_URL . 'assets/app/panels/PsiPanel.js',
            ['sciova-app-bootstrap', 'sciova-app-store', 'sciova-app-utils', 'sciova-app-components'],
            SCIOVA_VERSION,
            true
        );

        wp_enqueue_script(
            'sciova-app-notes-panel',
            SCIOVA_URL . 'assets/app/panels/NotesPanel.js',
            ['sciova-app-bootstrap', 'sciova-app-store', 'sciova-app-utils', 'sciova-app-components'],
            SCIOVA_VERSION,
            true
        );

        // Pages depend on panels + utils
        wp_enqueue_script(
            'sciova-app-dashboard-page',
            SCIOVA_URL . 'assets/app/pages/DashboardPage.js',
            ['sciova-app-bootstrap', 'sciova-app-store', 'sciova-app-utils', 'sciova-app-components', 'sciova-app-trend-panel', 'sciova-app-psi-panel', 'sciova-app-notes-panel'],
            SCIOVA_VERSION,
            true
        );

        wp_enqueue_script(
            'sciova-app-settings-page',
            SCIOVA_URL . 'assets/app/pages/SettingsPage.js',
            ['sciova-app-bootstrap', 'sciova-app-store', 'sciova-app-utils', 'sciova-app-components'],
            SCIOVA_VERSION,
            true
        );

        // Root App depends on pages
        wp_enqueue_script(
            'sciova-app-root',
            SCIOVA_URL . 'assets/app/App.js',
            ['sciova-app-bootstrap', 'sciova-app-ui-templates', 'sciova-app-dashboard-page', 'sciova-app-settings-page'],
            SCIOVA_VERSION,
            true
        );

        // Main mount depends on root
        wp_enqueue_script(
            'sciova-app-main',
            SCIOVA_URL . 'assets/app/main.js',
            ['sciova-app-bootstrap', 'sciova-app-root'],
            SCIOVA_VERSION,
            true
        );

        wp_enqueue_style(
            'sciova-fonts',
            SCIOVA_URL . 'assets/fonts.css',
            [],
            SCIOVA_VERSION
        );

        wp_enqueue_style(
            'sciova-admin-css',
            SCIOVA_URL . 'assets/style.css',
            ['sciova-fonts'],
            SCIOVA_VERSION
        );

        wp_enqueue_style(
            'sciova-dashboard-inline',
            SCIOVA_URL . 'assets/dashboard-inline.css',
            ['sciova-admin-css'],
            SCIOVA_VERSION
        );

        // Pass REST API info to the JS app.
        wp_localize_script(
            'sciova-app-bootstrap',
            'SCIOVA_SETTINGS',
            [
                'restUrl' => rest_url('sciova/v1'),
                'nonce'   => wp_create_nonce('wp_rest'),
                'currentUserName' => wp_get_current_user()->display_name,
                'pluginVersion' => defined('SCIOVA_VERSION') ? SCIOVA_VERSION : '',
                'ratingUrl' => apply_filters('sciova_rating_url', ''),
                'footerLinks' => apply_filters('sciova_footer_links', []),
                'logoUrl' => SCIOVA_URL . 'assets/img/sciova-logo.svg',
                'limits'  => [
                    'maxUrlsFree' => 3,
                ],
            ]
        );
    }
}
