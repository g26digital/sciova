<?php

/**
 * Plugin activation handler.
 *
 * @package Sciova
 * @subpackage Init
 */

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Class SCIOVA_Activator
 *
 * Handles plugin activation logic.
 */
class SCIOVA_Activator
{

    /**
     * Runs on plugin activation.
     *
     * @return void
     */
    public static function activate(): void
    {
        SCIOVA_DB::create_tables();
    }
}
