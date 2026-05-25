<?php

/**
 * Freemium policy rules for Sciova.
 *
 * Central place for free-tier boundaries and feature gates.
 * This class defines what is allowed in the baseline (free) experience.
 *
 * IMPORTANT:
 * - This is not a security boundary against server owners.
 * - It is a product boundary and future licensing hook point.
 *
 * @package Sciova
 */

if (! defined('ABSPATH')) {
    exit;
}

if (! class_exists('SCIOVA_Freemium_Policy')) {

    final class SCIOVA_Freemium_Policy
    {
        /**
         * Maximum tracked URLs for the free tier.
         *
         * @var int
         */
        private const MAX_URLS = 3;

        /**
         * Allowed moving average windows in baseline (free).
         *
         * @var int[]
         */
        private const ALLOWED_MA_WINDOWS = [5, 10];

        /**
         * Get max tracked URLs.
         *
         * @return int
         */
        public function max_urls(): int
        {
            return self::MAX_URLS;
        }

        /**
         * Check if adding another URL is allowed.
         *
         * @param int $current_count
         * @return bool
         */
        public function can_add_url(int $current_count): bool
        {
            return $current_count < self::MAX_URLS;
        }

        /**
         * Get remaining URL slots.
         *
         * @param int $current_count
         * @return int
         */
        public function remaining_slots(int $current_count): int
        {
            return max(0, self::MAX_URLS - $current_count);
        }

        /**
         * Get allowed MA windows.
         *
         * Central source of truth for MA options.
         * Future licensing can extend this.
         *
         * @return int[]
         */
        public function get_allowed_ma_windows(): array
        {
            $windows = self::ALLOWED_MA_WINDOWS;

            /**
             * Filter: override MA windows.
             * Used later for licensing or enterprise extensions.
             *
             * @param int[] $windows
             */
            $windows = apply_filters('sciova_allowed_ma_windows', $windows);

            $windows = array_values(array_unique(array_map('intval', $windows)));
            sort($windows);

            return $windows;
        }

        /**
         * Check if MA window is allowed.
         *
         * @param int $window
         * @return bool
         */
        public function is_ma_window_allowed(int $window): bool
        {
            return in_array($window, $this->get_allowed_ma_windows(), true);
        }
    }
}
