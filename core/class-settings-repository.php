<?php
/**
 * Settings repository for Sciova.
 *
 * Centralizes access to plugin options (API keys + Step 5 settings).
 *
 * Important:
 * - We NEVER expose raw API keys to the browser.
 * - Controllers may need raw keys server-side to call Google APIs.
 *
 * @package Sciova
 * @subpackage Core
 * @since 0.2.0
 */

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Class SCIOVA_Settings_Repository
 *
 * @since 0.2.0
 */
class SCIOVA_Settings_Repository
{
    /**
     * Option name for CrUX API key.
     *
     * @var string
     */
    const OPTION_CRUX_API_KEY = 'sciova_crux_api_key';

    /**
     * Option name for PSI API key.
     *
     * @var string
     */
    const OPTION_PSI_API_KEY = 'sciova_psi_api_key';

    /**
     * Option name for CrUX form factor (PHONE|DESKTOP|TABLET|'' for ALL).
     *
     * @var string
     */
    const OPTION_CRUX_FORM_FACTOR = 'sciova_crux_form_factor';

    /**
     * Option name for CrUX period count (collectionPeriodCount, 1..40).
     *
     * @var string
     */
    const OPTION_CRUX_PERIOD_COUNT = 'sciova_crux_period_count';

    /**
     * Default CrUX period count for MVP.
     *
     * @var int
     */
    const DEFAULT_CRUX_PERIOD_COUNT = 25;

    /**
     * Default form factor (empty means ALL).
     *
     * @var string
     */
    const DEFAULT_CRUX_FORM_FACTOR = '';

    /**
     * Option name for default MA window.
     *
     * @var string
     */
    const OPTION_DEFAULT_MA_WINDOW = 'sciova_default_ma_window';

    /**
     * Get settings payload for the Settings UI.
     *
     * Keys are masked (last 4) for display.
     *
     * @return array
     */
    public function get_settings(): array
    {
        $crux = (string) get_option(self::OPTION_CRUX_API_KEY, '');
        $psi  = (string) get_option(self::OPTION_PSI_API_KEY, '');

        return [
            'has_crux_key' => $crux !== '',
            'has_psi_key'  => $psi !== '',
            'crux_api_key' => $this->mask_key($crux),
            'psi_api_key'  => $this->mask_key($psi),

            // Step 5 settings.
            'crux_form_factor'  => $this->get_crux_form_factor(),
            'crux_period_count' => $this->get_crux_period_count(),
        ];
    }

    /**
     * Get raw CrUX API key (server-side only).
     *
     * @return string
     */
    public function get_crux_api_key_raw(): string
    {
        return (string) get_option(self::OPTION_CRUX_API_KEY, '');
    }

    /**
     * Get raw PSI API key (server-side only).
     *
     * @return string
     */
    public function get_psi_api_key_raw(): string
    {
        return (string) get_option(self::OPTION_PSI_API_KEY, '');
    }

    /**
     * Update CrUX API key.
     *
     * @param string $key
     * @return bool
     */
    public function set_crux_api_key(string $key): bool
    {
        $key = trim($key);
        if ($key === '') {
            return false;
        }
        return (bool) update_option(self::OPTION_CRUX_API_KEY, $key, false);
    }

    /**
     * Update PSI API key.
     *
     * @param string $key
     * @return bool
     */
    public function set_psi_api_key(string $key): bool
    {
        $key = trim($key);
        if ($key === '') {
            return false;
        }
        return (bool) update_option(self::OPTION_PSI_API_KEY, $key, false);
    }

    /**
     * Get CrUX form factor.
     *
     * Empty string means ALL form factors.
     *
     * @return string One of: '', 'PHONE', 'DESKTOP', 'TABLET'
     */
    public function get_crux_form_factor(): string
    {
        $ff = (string) get_option(self::OPTION_CRUX_FORM_FACTOR, self::DEFAULT_CRUX_FORM_FACTOR);
        $ff = strtoupper(trim($ff));

        if ($ff === '' || in_array($ff, ['PHONE', 'DESKTOP', 'TABLET'], true)) {
            return $ff;
        }

        return self::DEFAULT_CRUX_FORM_FACTOR;
    }

    /**
     * Set CrUX form factor.
     *
     * @param string $ff One of: '', 'PHONE', 'DESKTOP', 'TABLET'
     * @return bool
     */
    public function set_crux_form_factor(string $ff): bool
    {
        $ff = strtoupper(trim($ff));

        if ($ff !== '' && ! in_array($ff, ['PHONE', 'DESKTOP', 'TABLET'], true)) {
            return false;
        }

        return (bool) update_option(self::OPTION_CRUX_FORM_FACTOR, $ff, false);
    }

    /**
     * Get CrUX period count (collectionPeriodCount).
     *
     * @return int 1..40
     */
    public function get_crux_period_count(): int
    {
        $pc = (int) get_option(self::OPTION_CRUX_PERIOD_COUNT, self::DEFAULT_CRUX_PERIOD_COUNT);

        if ($pc < 1) {
            $pc = 1;
        }
        if ($pc > 40) {
            $pc = 40;
        }

        return $pc;
    }

    /**
     * Set CrUX period count (collectionPeriodCount).
     *
     * @param int $pc 1..40
     * @return bool
     */
    public function set_crux_period_count(int $pc): bool
    {
        $pc = (int) $pc;

        if ($pc < 1 || $pc > 40) {
            return false;
        }

        return (bool) update_option(self::OPTION_CRUX_PERIOD_COUNT, $pc, false);
    }

    /**
     * Mask a key for UI display (last 4 chars).
     *
     * @param string $key Raw key.
     * @return string Masked key.
     */
    public function mask_key(string $key): string
    {
        $key = trim($key);

        if ($key === '') {
            return '';
        }

        $last4 = substr($key, -4);

        // Use bullet characters; UI should treat this as display-only.
        return '••••••••' . $last4;
    }

    /**
     * Get default MA window (validated against policy).
     *
     * @return int
     */
    public function get_default_ma_window(): int
    {
        $policy = new SCIOVA_Freemium_Policy();
        $allowed = $policy->get_allowed_ma_windows();

        $fallback = (int) $allowed[0];
        $stored = (int) get_option(self::OPTION_DEFAULT_MA_WINDOW, $fallback);

        if (! in_array($stored, $allowed, true)) {
            return $fallback;
        }

        return $stored;
    }

    /**
     * Set default MA window (sanitized).
     *
     * @param int $value
     * @return bool
     */
    public function set_default_ma_window(int $value): bool
    {
        $policy = new SCIOVA_Freemium_Policy();

        if (! $policy->is_ma_window_allowed($value)) {
            return false;
        }

        return update_option(self::OPTION_DEFAULT_MA_WINDOW, $value, true);
    }    
}
