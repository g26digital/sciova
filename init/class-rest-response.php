<?php

/**
 * REST response helper for Sciova.
 *
 * Ensures consistent JSON payloads + status codes across controllers.
 *
 * @package Sciova
 */

if (! defined('ABSPATH')) {
    exit;
}

if (! class_exists('SCIOVA_REST_Response')) {

    /**
     * Class SCIOVA_REST_Response
     *
     * @since 0.1.0
     */
    final class SCIOVA_REST_Response
    {

        /**
         * Build a success REST response.
         *
         * Shape:
         * {
         *   "success": true,
         *   "data": ...
         * }
         *
         * @since 0.1.0
         *
         * @param mixed $data   Payload data.
         * @param int   $status HTTP status code.
         * @return WP_REST_Response
         */
        public static function success($data, int $status = 200): WP_REST_Response
        {
            $response = new WP_REST_Response(
                array(
                    'success' => true,
                    'data'    => $data,
                ),
                $status
            );

            return $response;
        }

        /**
         * Build an error REST response.
         *
         * Shape:
         * {
         *   "success": false,
         *   "error": {
         *     "code": "some_code",
         *     "message": "Human readable message",
         *     "data": {... optional ...}
         *   }
         * }
         *
         * @since 0.1.0
         *
         * @param string $code    Machine-readable error code (e.g. "missing_key").
         * @param string $message Human-readable message (MUST NOT include secrets).
         * @param int    $status  HTTP status code.
         * @param array  $data    Optional structured error data for the UI.
         * @return WP_REST_Response
         */
        public static function error(string $code, string $message, int $status = 400, array $data = array()): WP_REST_Response
        {
            $response = new WP_REST_Response(
                array(
                    'success' => false,
                    'error'   => array(
                        'code'    => $code,
                        'message' => $message,
                        'data'    => (object) $data,
                    ),
                ),
                $status
            );

            return $response;
        }
    }
}
