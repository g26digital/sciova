# Sciova
WordPress plugin for monitoring Core Web Vitals trends using real Chrome UX Report (CrUX) field data and PageSpeed Insights lab diagnostics.

**WordPress.org Plugin:** https://wordpress.org/plugins/sciova-performance-intelligence/ (pending approval)

## Features

- Track Core Web Vitals (LCP, CLS, INP) with real Chrome UX Report field data
- Historical trend analysis with moving averages
- PageSpeed Insights lab diagnostics integration
- URL health monitoring and regression detection
- Notes panel for correlating performance changes with site updates
- Admin-only — zero frontend impact

## Installation

1. Download the latest release or clone this repository
2. Upload to /wp-content/plugins/ directory
3. Activate through the WordPress admin
4. Go to Sciova > Settings and add your CrUX API key
5. Start tracking URLs from the dashboard

## Requirements

- WordPress 6.0+
- PHP 8.0+
- Google CrUX API key (free via Google Cloud Console)

## Source Code

All JavaScript and PHP source files are unminified and human-readable. No build tools or compilation steps are used.

The plugin uses vanilla JavaScript and WordPress REST API — no frontend frameworks or bundlers required.

## Third-Party Libraries

**uPlot** v1.6.31 by Leon Sorokin
License: MIT
Source: https://github.com/leeoniya/uPlot/releases/tag/1.6.31
Bundled as: assets/uplot.js (unminified)

**Space Grotesk** by Florian Karsten
License: SIL Open Font License 1.1
Source: https://github.com/floriankarsten/space-grotesk

**Plus Jakarta Sans** by Tokotype
License: SIL Open Font License 1.1
Source: https://github.com/tokotype/PlusJakartaSans

## License
GPL v2 or later — see LICENSE

## Support
For bug reports and feature requests, please use the GitHub Issues page.
For general support, visit the WordPress.org support forum.