<?php

/**
 * Plugin Name: Sciova
 * Plugin URI:  https://geetwosix.digital/sciova
 * Description: CrUX-first WordPress performance intelligence and governance plugin.
 * Version:     1.0.0
 * Author:      Geetwosix Digital
 * Author URI:  https://geetwosix.digital
 * License:     GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: sciova-performance-intelligence
 *
 * @package Sciova
 */

if (! defined('ABSPATH')) {
    exit;
}

// Load Composer dependencies if available.
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require_once __DIR__ . '/vendor/autoload.php';
}

// Plugin constants.
define('SCIOVA_VERSION', '1.0.0');
define('SCIOVA_PATH', plugin_dir_path(__FILE__));
define('SCIOVA_URL', plugin_dir_url(__FILE__));
define('SCIOVA_PLUGIN_FILE', __FILE__);


/**
 * Autoloader for Sciova classes.
 *
 * Converts class names to file paths based on our folder structure:
 * - init/
 * - core/
 * - integrations/crux/
 * - integrations/psi/
 *
 * Example:
 * SCIOVA_Admin       -> init/class-admin.php
 * SCIOVA_Trend_Engine -> core/class-trend-engine.php
 *
 * @param string $class Class name.
 * @return void
 */
spl_autoload_register(function ($class) {

    if (strpos($class, 'SCIOVA_') !== 0) {
        return;
    }

    $file_base = strtolower(str_replace('SCIOVA_', '', $class));
    $file_base = str_replace('_', '-', $file_base);

    $paths = array(
        SCIOVA_PATH . "init/class-{$file_base}.php",
        SCIOVA_PATH . "core/class-{$file_base}.php",
        SCIOVA_PATH . "integrations/class-{$file_base}.php",
    );

    foreach ($paths as $file) {
        if (file_exists($file)) {
            require_once $file;
            return;
        }
    }
});

// Activation and deactivation hooks.
register_activation_hook(__FILE__, array('SCIOVA_Activator', 'activate'));
register_deactivation_hook(__FILE__, array('SCIOVA_Deactivator', 'deactivate'));

// Run the plugin loader.
$sciova_loader = new SCIOVA_Loader();
$sciova_loader->run();