(function () {
  'use strict';

  window.SCIOVA = window.SCIOVA || {};
  SCIOVA.utils = SCIOVA.utils || {};

  function safeJsonParse(raw, fallback) {
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  SCIOVA.utils.lsGet = function (key, fallback) {
    try {
      var raw = window.localStorage.getItem(String(key));
      if (raw === null || raw === undefined || raw === '') return fallback;
      return safeJsonParse(raw, fallback);
    } catch (e) { return fallback; }
  };

  SCIOVA.utils.lsSet = function (key, value) {
    try { window.localStorage.setItem(String(key), JSON.stringify(value)); } catch (e) {}
  };

  /**
   * Format a Date/timestamp/string as YYYY-MM-DD.
   */
  SCIOVA.utils.formatYmd = function (dateLike) {
    var dt = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
    if (isNaN(dt.getTime())) dt = new Date();
    var y = dt.getFullYear();
    var m = String(dt.getMonth() + 1).padStart(2, '0');
    var d = String(dt.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  };

  SCIOVA.utils.todayYmd = function () {
    return SCIOVA.utils.formatYmd(new Date());
  };

  SCIOVA.utils.daysAgoYmd = function (days) {
    var dt = new Date();
    dt.setDate(dt.getDate() - Number(days || 0));
    return SCIOVA.utils.formatYmd(dt);
  };

  /**
   * Format a Unix timestamp (seconds) as "YYYY-MM-DD HH:mm".
   */
  SCIOVA.utils.formatTs = function (tsSeconds) {
    if (!tsSeconds) return '';
    var dt = new Date(Number(tsSeconds) * 1000);
    if (isNaN(dt.getTime())) return '';
    var y  = dt.getFullYear();
    var mo = String(dt.getMonth() + 1).padStart(2, '0');
    var d  = String(dt.getDate()).padStart(2, '0');
    var h  = String(dt.getHours()).padStart(2, '0');
    var mi = String(dt.getMinutes()).padStart(2, '0');
    return y + '-' + mo + '-' + d + ' ' + h + ':' + mi;
  };

  /**
   * Format a datetime string (MySQL "YYYY-MM-DD HH:mm:ss" or ISO) as "YYYY-MM-DD HH:mm".
   */
  SCIOVA.utils.formatDatetime = function (str) {
    if (!str) return '';
    var dt = new Date(String(str).replace(' ', 'T'));
    if (isNaN(dt.getTime())) return String(str).slice(0, 16);
    var y  = dt.getFullYear();
    var mo = String(dt.getMonth() + 1).padStart(2, '0');
    var d  = String(dt.getDate()).padStart(2, '0');
    var h  = String(dt.getHours()).padStart(2, '0');
    var mi = String(dt.getMinutes()).padStart(2, '0');
    return y + '-' + mo + '-' + d + ' ' + h + ':' + mi;
  };

  SCIOVA.utils.getErrorMessage = function (err) {
    if (!err) return 'Request failed.';
    if (typeof err === 'string') return err;
    if (err && typeof err.message === 'string' && err.message.trim()) return err.message;
    if (err && err.error && typeof err.error.message === 'string' && err.error.message.trim()) return err.error.message;
    return 'Request failed.';
  };

  SCIOVA.utils.formatPeriodLabel = function (p) {
    if (!p) return '';
    var a = p.start || p.firstDate || '';
    var b = p.end || p.lastDate || '';
    if (a && b) return a + ' → ' + b;
    return b || a || '';
  };

  SCIOVA.utils.now = function () { return Date.now(); };

  SCIOVA.utils.isFresh = function (timestamp, ttlMs) {
    if (!timestamp) return false;
    return (Date.now() - Number(timestamp)) < Number(ttlMs || 0);
  };

  /**
   * Render a uPlot line chart into a container div.
   * Returns the uPlot instance (call .destroy() to clean up).
   *
   * @param {HTMLElement|null} container  — div to mount into
   * @param {Array<string>}    labels     — x-axis labels (period strings)
   * @param {Array<number|null>} series   — y-axis values (nulls allowed)
   * @param {string}           label      — series label (used for color keying)
   * @returns {uPlot|null}
   */
  /**
   * @param {HTMLElement} container
   * @param {string[]}    labels    - period label strings (YYYY-MM-DD → YYYY-MM-DD)
   * @param {Array}       rawSeries - p75 per-period values (nulls allowed)
   * @param {string}      label     - metric key: 'lcp' | 'cls' | 'inp'
   * @param {Array}       [maSeries] - optional MA series to overlay
   */
  SCIOVA.utils.renderLineChart = function (container, labels, rawSeries, label, maSeries) {
    if (!container || !window.uPlot) return null;

    var l = String(label || '').toLowerCase();
    var rawColor = l.indexOf('cls') !== -1 ? '#86efac'   // green-300
                 : l.indexOf('inp') !== -1 ? '#fdba74'   // orange-300
                 : '#93c5fd';                             // blue-300
    var maColor  = l.indexOf('cls') !== -1 ? '#16a34a'   // green-600
                 : l.indexOf('inp') !== -1 ? '#ea580c'   // orange-600
                 : '#1d4ed8';                             // blue-700

    var xs  = labels.map(function (_, i) { return i; });
    var ys  = rawSeries.map(function (v) { return v === null || v === undefined ? NaN : Number(v); });
    var mas = maSeries
      ? maSeries.map(function (v) { return v === null || v === undefined ? NaN : Number(v); })
      : null;

    var step = labels.length > 20 ? 4 : labels.length > 10 ? 2 : 1;

    // Tooltip div — one per chart instance, appended to body
    var tooltip = document.createElement('div');
    tooltip.className = 'g26-chart-tooltip';
    tooltip.style.display = 'none';
    tooltip.style.position = 'fixed';
    document.body.appendChild(tooltip);

    function fmtVal(v) {
      if (v === null || v === undefined || isNaN(v)) return '—';
      var l2 = String(label || '').toLowerCase();
      if (l2.indexOf('cls') !== -1) return Number(v).toFixed(3);
      return v >= 1000 ? (v / 1000).toFixed(2) + 's' : Math.round(v) + 'ms';
    }

    function showTooltip(u, idx) {
      if (idx === null || idx === undefined || idx < 0 || idx >= labels.length) {
        tooltip.style.display = 'none';
        return;
      }

      var p75Val = u.data[1][idx];
      var maVal  = mas ? u.data[2][idx] : null;
      var period = labels[idx] || '';

      var html = '<div class="g26-chart-tooltip__period">' + period + '</div>';
      html += '<div class="g26-chart-tooltip__row">';
      html += '<span class="g26-chart-tooltip__dot" style="background:' + rawColor + '"></span>';
      html += '<span>p75: <strong>' + fmtVal(p75Val) + '</strong></span>';
      html += '</div>';
      if (mas) {
        html += '<div class="g26-chart-tooltip__row">';
        html += '<span class="g26-chart-tooltip__dot" style="background:' + maColor + '"></span>';
        html += '<span>MA: <strong>' + fmtVal(maVal) + '</strong></span>';
        html += '</div>';
      }
      tooltip.innerHTML = html;
      tooltip.style.display = 'block';
    }

    // Drive tooltip entirely from mousemove — no setCursor hook needed.
    // Find nearest x-index by comparing mouse X to each data point's canvas X.
    function onDocMove(e) {
      if (!chart) { tooltip.style.display = 'none'; return; }

      var rect = container.getBoundingClientRect();
      var inside = e.clientX >= rect.left && e.clientX <= rect.right &&
                   e.clientY >= rect.top  && e.clientY <= rect.bottom;

      if (!inside) { tooltip.style.display = 'none'; return; }

      // chart.valToPos returns px relative to the plot area (inside axes).
      // chart.bbox gives the plot area in css pixels: {left, top, width, height}.
      // We need mouse position relative to the same origin.
      var bbox  = chart.bbox;                          // px (device pixels)
      var dpr   = window.devicePixelRatio || 1;
      var plotL = rect.left + bbox.left   / dpr;       // plot area left edge in viewport px
      var mouseRelX = e.clientX - plotL;               // mouse X relative to plot area

      var bestIdx = null;
      var bestDist = Infinity;
      for (var i = 0; i < xs.length; i++) {
        var cx = chart.valToPos(xs[i], 'x');           // also relative to plot area
        var dist = Math.abs(cx - mouseRelX);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      }

      // Show within half the point spacing (generous for sparse data)
      var halfGap = xs.length > 1 ? (chart.valToPos(xs[1], 'x') - chart.valToPos(xs[0], 'x')) / 2 : 40;
      if (bestIdx === null || bestDist > halfGap) {
        tooltip.style.display = 'none';
        return;
      }

      showTooltip(chart, bestIdx);

      // Position
      var tx = e.clientX + 14;
      var ty = e.clientY - 10;
      if (tx + 180 > window.innerWidth) tx = e.clientX - 174;
      tooltip.style.left = tx + 'px';
      tooltip.style.top  = ty + 'px';
    }
    document.addEventListener('mousemove', onDocMove);

    function buildOpts(width) {
      var seriesDefs = [
        {},
        {
          label:    'p75',
          stroke:   rawColor,
          width:    0,
          spanGaps: false,
          fill:     rawColor + 'aa',
          points:   { show: true, size: 6, fill: rawColor, stroke: rawColor }
        }
      ];

      if (mas) {
        seriesDefs.push({
          label:    'MA',
          stroke:   maColor,
          width:    2.5,
          spanGaps: true,
          fill:     false,
          points:   { show: false }
        });
      }

      return {
        width:  width,
        height: 280,
        cursor: { show: false },
        legend: { show: false },
        scales: {
          x: { time: false },
          y: {
            auto: true,
            range: function (_u, min, max) {
              var pad = (max - min) * 0.08 || 1;
              return [min - pad, max + pad];
            }
          }
        },
        axes: [
          {
            values: function (_u, vals) {
              return vals.map(function (v, i) {
                if (i % step !== 0) return '';
                return labels[v] !== undefined ? labels[v].slice(5) : '';
              });
            },
            size:  40,
            gap:   6,
            ticks: { show: true, size: 4 },
            grid:  { stroke: '#e5e7eb', width: 1 },
            font:  '11px Plus Jakarta Sans, sans-serif',
            stroke: '#9ca3af'
          },
          {
            size:  56,
            gap:   6,
            ticks: { show: true, size: 4 },
            grid:  { stroke: '#e5e7eb', width: 1 },
            font:  '11px Plus Jakarta Sans, sans-serif',
            stroke: '#9ca3af'
          }
        ],
        series: seriesDefs
      };
    }

    // Build data array: [xs, ys, mas?]
    var data = [xs, ys];
    if (mas) data.push(mas);

    var chart = null;
    var destroyed = false;

    function mount(w) {
      if (destroyed) return;
      if (chart) { chart.destroy(); chart = null; }
      container.innerHTML = '';
      chart = new window.uPlot(buildOpts(w), data, container);
    }

    var proxy = {
      destroy: function () {
        destroyed = true;
        document.removeEventListener('mousemove', onDocMove);
        if (ro) { ro.disconnect(); ro = null; }
        if (chart) { chart.destroy(); chart = null; }
        if (tooltip && tooltip.parentNode) { tooltip.parentNode.removeChild(tooltip); }
      }
    };

    // Use ResizeObserver — always remount on width change for correct data layout
    var ro = null;
    if (window.ResizeObserver) {
      var lastW = 0;
      ro = new ResizeObserver(function (entries) {
        var w = Math.floor(entries[0].contentRect.width);
        if (w > 0 && Math.abs(w - lastW) > 4) {
          lastW = w;
          mount(w);
        }
      });
      ro.observe(container);
      return proxy;
    }

    // Fallback: mount once with offsetWidth or a reasonable default
    var fallbackW = container.offsetWidth || 600;
    mount(fallbackW);
    return proxy;
  };

})();
