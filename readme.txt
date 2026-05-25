=== Sciova ===
Contributors: g26digital
Tags: performance, core web vitals, CrUX, lcp, cls
Requires at least: 6.0
Tested up to: 7.0
Requires PHP: 8.0
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

CrUX-first WordPress performance plugin. Monitor Core Web Vitals with real field data and lab diagnostics via PageSpeed Insights — admin-only.

== Description ==

Sciova gives WordPress site owners, SEO managers, and developers a reliable tool to monitor Core Web Vitals trends using **Chrome UX Report (CrUX)** as the source of truth. Lab tools like PageSpeed Insights (PSI) are used as supporting diagnostics.

All operations are admin-only. There is no frontend impact, no injected scripts, and no effect on site visitors or SEO.

**Key Features:**

* Track up to 3 URLs (free tier).
* CrUX History charts for LCP, CLS, and INP — rendered with uPlot for minimal overhead.
* Interactive chart tooltips showing p75 value and reporting period on hover.
* Moving average overlay (MA5 or MA10) to smooth out week-to-week noise.
* Trend classification per metric: Improving, Regressing, Stable, or Insufficient Data.
* URL health indicator — colour-coded dot in the URL selector reflects overall trend health.
* Smart analysis text — plain-language summary of CWV status with actual p75 values and CWV thresholds.
* Copy report — one-click copy of the analysis text for sharing or pasting into docs.
* Lab diagnostics via PageSpeed Insights (mobile and desktop snapshots) with score badge.
* Notes panel — log deployments, theme changes, or any site events with datetime for correlation.
* Notes pagination — 5 notes per page, newest first.
* Settings page — manage your CrUX and PSI API keys with a built-in connection test.
* Loading overlay — dashboard waits for all data (URLs, CrUX, PSI, Notes) before revealing the UI.
* Async PSI fetch — adding a URL returns instantly; PSI data is fetched via WP-Cron in the background.
* Lightweight: no build step, no bundler, no frontend libraries loaded outside the admin screen.

**Future Enhancements:**

* Unlimited URL tracking (Pro)
* Automated lab diagnostics via GTmetrix / WebPageTest
* Export reports (CSV / PDF)
* AI-assisted analysis and automated correlation of plugin, theme, and code changes

== Installation ==

1. Upload the `sciova` folder to the `/wp-content/plugins/` directory.
2. Activate the plugin through the 'Plugins' menu in WordPress.
3. Navigate to **Sciova** in the admin sidebar.
4. Go to **Settings** and enter your CrUX API key (and optionally your PSI API key).
5. Use the **Test Keys** button to verify your keys are working.
6. Add the URLs you want to track from the dashboard.

**Requirements:**

* PHP 8.0+
* WordPress 6.0+
* REST API enabled
* A Google CrUX API key (free via Google Cloud Console)

== Frequently Asked Questions ==

= Is this plugin safe for live sites? =

Yes. All operations are admin-only. No scripts, styles, or markup are added to the frontend. It is fully safe for SEO and site visitors.

= How does CrUX integration work? =

The plugin uses the Chrome UX Report History API to fetch 28-day rolling period data for LCP, CLS, and INP per tracked URL. This real field data drives the trend charts and classification engine.

= How many URLs can I track? =

The free version supports up to 3 URLs. Limits are enforced both client-side and server-side.

= Do I need API keys? =

Yes. A CrUX API key is required to fetch field metrics. A PSI API key is optional but recommended for lab diagnostics (PageSpeed Insights). Both are available free via Google Cloud Console.

= What is the Notes panel for? =

The Notes panel lets you log site events (deployments, plugin updates, theme changes) with a date and time. This helps you correlate performance changes with real site changes over time.

= Does PSI run every time I load the dashboard? =

No. PSI data is cached via WordPress transients (3-hour TTL). A fresh PSI fetch is triggered asynchronously via WP-Cron only when a new URL is added. You can also trigger a manual refresh from the PSI card.

= What happens to my data if I deactivate the plugin? =

Your tracked URLs, notes, and settings are preserved in the database. Data is only removed if you uninstall the plugin entirely.

== Screenshots ==

1. Dashboard with CrUX trend charts (LCP, CLS, INP), moving average overlay, and trend classification.
2. Chart tooltip showing p75 value and reporting period on hover.
3. Analysis panel with plain-language CWV summary and Copy button.
4. PSI panel showing lab scores for mobile and desktop with score badge.
5. Notes panel with datetime logging and pagination.
6. Settings page with API key management and connection test.

== External Services ==

This plugin connects to the following third-party services:

**Chrome UX Report (CrUX) API** by Google
Used to fetch real-user performance field data (LCP, CLS, INP) for tracked URLs.
Only contacts Google when you actively request metrics from the dashboard.
Terms of Service: https://developers.google.com/terms
Privacy Policy: https://policies.google.com/privacy

**PageSpeed Insights API** by Google
Used to fetch lab performance diagnostics for tracked URLs.
Only contacts Google when a PSI API key is configured and a URL is added or refreshed.
Terms of Service: https://developers.google.com/terms
Privacy Policy: https://policies.google.com/privacy

No user data is sent to Geetwosix Digital or any third party other than Google.
All API calls are made server-side using your own API keys.

== Source Code ==

All plugin JavaScript (assets/app/) and PHP source files are included in the plugin package unminified and human-readable. No build step is used for the plugin's own code.

The full source code for this plugin is publicly available at:
https://github.com/g26digital/sciova

== Third Party Libraries ==

This plugin bundles the following third-party libraries:

**uPlot** (v1.6.31) by Leon Sorokin
Licensed under the MIT License (GPL-compatible).
Bundled as: assets/uPlot.iife.js (unminified IIFE build)
Source: https://github.com/leeoniya/uPlot
Release: https://github.com/leeoniya/uPlot/releases/tag/1.6.31

**Space Grotesk** by Florian Karsten
Licensed under the SIL Open Font License 1.1 (GPL-compatible).
https://github.com/floriankarsten/space-grotesk

**Plus Jakarta Sans** by Tokotype
Licensed under the SIL Open Font License 1.1 (GPL-compatible).
https://github.com/tokotype/PlusJakartaSans

== Changelog ==

= 1.0.0 =
* Initial release of Sciova.
* Admin-only dashboard — no frontend impact.
* Track up to 3 URLs (free tier).
* CrUX History charts for LCP, CLS, and INP via uPlot with interactive tooltips.
* Moving average overlay (MA5/MA10) to smooth week-to-week noise.
* Trend classification per metric: Improving, Regressing, Stable, or Insufficient Data.
* URL health dot — colour-coded indicator in the URL selector reflecting overall trend health.
* Smart analysis text with actual p75 values and CWV thresholds (LCP ≤2.5s, CLS ≤0.10, INP ≤200ms).
* Copy Report button — copies analysis text to clipboard.
* Lab diagnostics via PageSpeed Insights (mobile and desktop) with score badge, async via WP-Cron.
* Notes panel with datetime logging, pagination (5/page), and delete flash.
* Settings page with CrUX and PSI API key management and built-in connection test.
* Settings submenu in WP admin left nav.
* Loading overlay waits for all data (URLs, CrUX, PSI, Notes) with 10-second safety timeout.
* Mobile responsive layout.
* Deactivation clears pending PSI cron events; data preserved for reactivation.

== Upgrade Notice ==

= 1.0.0 =
Initial release.
