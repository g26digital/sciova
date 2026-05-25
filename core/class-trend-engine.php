<?php
/**
 * Trend analysis engine.
 *
 * Implements moving-average (MA) computation and simple, configurable
 * trend classification over CrUX History API period series.
 *
 * Notes:
 * - CrUX History API values are already "period values" (weekly-updated 28-day rolling windows),
 *   so our MA here is a *period MA* (e.g., 5-period MA / 10-period MA).
 * - Lower is better for all numeric metrics we use in MVP (LCP, INP, CLS).
 *
 * @package Sciova
 * @subpackage Core
 * @since 0.2.0
 */

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Class SCIOVA_Trend_Engine
 *
 * @since 0.2.0
 */
class SCIOVA_Trend_Engine
{
    /**
     * Compute a simple moving average over a timeseries.
     *
     * The returned array is the same length as the input; indices that don't have
     * enough prior values will be `null`.
     *
     * Missing values (`null`, empty, "NaN") are treated as gaps and will yield `null`
     * for any window that includes a missing entry.
     *
     * @param array $values Array of numeric values (oldest -> newest). May include null/"NaN".
     * @param int   $window Window size (e.g., 5 or 10).
     * @return array Array of floats|null, same length as $values.
     */
    public function moving_average(array $values, int $window): array
    {
        $window = max(1, (int) $window);
        $out    = [];

        // Normalize.
        $norm = array_map(function ($v) {
            if ($v === null) {
                return null;
            }
            if (is_string($v) && strtolower(trim($v)) === 'nan') {
                return null;
            }
            if ($v === '') {
                return null;
            }
            return is_numeric($v) ? (float) $v : null;
        }, $values);

        $count = count($norm);

        for ($i = 0; $i < $count; $i++) {
            if ($i < ($window - 1)) {
                $out[] = null;
                continue;
            }

            $sum   = 0.0;
            $valid = true;

            for ($j = $i - ($window - 1); $j <= $i; $j++) {
                if ($norm[$j] === null) {
                    $valid = false;
                    break;
                }
                $sum += (float) $norm[$j];
            }

            $out[] = $valid ? ($sum / $window) : null;
        }

        return $out;
    }

    /**
     * Classify a trend over a (possibly) sparse series.
     *
     * Strategy:
     * - Compare the mean of the first 4 non-null values (baseline) against
     *   the mean of the last 4 non-null values (recent). Using a small window
     *   rather than single endpoints avoids outlier-flipping on sparse CrUX data.
     * - For "ms" metrics (LCP/INP), use relative threshold (default 5%).
     * - For CLS, use absolute threshold (default 0.02).
     *
     * @param array  $series Series values (floats|null), oldest -> newest.
     * @param string $metric One of: 'lcp'|'inp'|'cls' (used to choose thresholding mode).
     * @param array  $opts   Optional overrides:
     *                       - 'relative_threshold' (float, e.g., 0.05)
     *                       - 'cls_absolute_threshold' (float, e.g., 0.02)
     *                       - 'window' (int, number of values to average at each end, default 4)
     * @return string 'improving'|'regressing'|'stable'|'insufficient-data'
     */
    public function classify(array $series, string $metric, array $opts = []): string
    {
        $non_null = array_values(array_filter($series, function ($v) {
            return $v !== null && is_numeric($v);
        }));

        if (count($non_null) < 2) {
            return 'insufficient-data';
        }

        $win = isset($opts['window']) ? max(1, (int) $opts['window']) : 4;

        // Baseline = mean of first $win non-null values.
        $early  = array_slice($non_null, 0, $win);
        $first  = array_sum($early) / count($early);

        // Recent = mean of last $win non-null values.
        $recent = array_slice($non_null, -$win);
        $last   = array_sum($recent) / count($recent);

        $metric   = strtolower($metric);
        $relative = isset($opts['relative_threshold']) ? (float) $opts['relative_threshold'] : 0.05;
        $cls_abs  = isset($opts['cls_absolute_threshold']) ? (float) $opts['cls_absolute_threshold'] : 0.02;

        if ($metric === 'cls') {
            $delta = $last - $first;
            if ($delta <= (-1.0 * $cls_abs)) {
                return 'improving';
            }
            if ($delta >= $cls_abs) {
                return 'regressing';
            }
            return 'stable';
        }

        // For ms-like metrics (LCP, INP). Lower is better.
        if ($first <= 0.0) {
            $delta = $last - $first;
            if ($delta < 0.0) {
                return 'improving';
            }
            if ($delta > 0.0) {
                return 'regressing';
            }
            return 'stable';
        }

        $pct = ($last - $first) / $first; // positive = worse, negative = better

        if ($pct <= (-1.0 * $relative)) {
            return 'improving';
        }
        if ($pct >= $relative) {
            return 'regressing';
        }
        return 'stable';
    }

    /**
     * @param array $series
     * @return float|null
     */
    protected function first_non_null(array $series): ?float
    {
        foreach ($series as $v) {
            if ($v === null) {
                continue;
            }
            if (is_numeric($v)) {
                return (float) $v;
            }
        }
        return null;
    }

    /**
     * @param array $series
     * @return float|null
     */
    protected function last_non_null(array $series): ?float
    {
        for ($i = count($series) - 1; $i >= 0; $i--) {
            $v = $series[$i];
            if ($v === null) {
                continue;
            }
            if (is_numeric($v)) {
                return (float) $v;
            }
        }
        return null;
    }

    /**
     * @param array $series
     * @return int
     */
    protected function count_non_null(array $series): int
    {
        $c = 0;
        foreach ($series as $v) {
            if ($v !== null && is_numeric($v)) {
                $c++;
            }
        }
        return $c;
    }
}
