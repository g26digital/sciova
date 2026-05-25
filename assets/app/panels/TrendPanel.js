(function () {
  'use strict';
  if (!window.wp || !wp.element) return;
  window.SCIOVA = window.SCIOVA || {};
  SCIOVA.React = SCIOVA.React || {};
  var el = (SCIOVA.React.el) ? SCIOVA.React.el : wp.element.createElement;
  var useEffect = SCIOVA.React.useEffect || wp.element.useEffect;
  var useRef = SCIOVA.React.useRef || wp.element.useRef;
  var useState = SCIOVA.React.useState || wp.element.useState;

  var TABS = [
    { key: 'lcp', label: 'LCP' },
    { key: 'cls', label: 'CLS' },
    { key: 'inp', label: 'INP' }
  ];

  function TrendPanel(props) {
    var selectedUrl = props.selectedUrl;

    var _a = useState(true),  loading = _a[0], setLoading = _a[1];
    var _b = useState(''),    error   = _b[0], setError   = _b[1];
    var _c = useState(null),  metrics = _c[0], setMetrics = _c[1];
    var _c2 = useState(false), missingCruxKey = _c2[0], setMissingCruxKey = _c2[1];

    var _d = useState(props.maWindow ? 'ma' + props.maWindow : SCIOVA.utils.lsGet('sciova_ma_window', 'ma5')),
        maKey = _d[0], setMaKey = _d[1];

    // Active metric tab — persisted to localStorage
    var _t = useState(SCIOVA.utils.lsGet('sciova_trend_tab', 'lcp')),
        activeTab = _t[0], setActiveTab = _t[1];

    // Single chart container + instance
    var chartDivRef  = useRef(null);
    var chartInstRef = useRef(null);

    function cleanupChart() {
      if (chartInstRef.current) {
        chartInstRef.current.destroy();
        chartInstRef.current = null;
      }
    }

    // Sync maKey when parent changes maWindow
    useEffect(function () {
      if (props.maWindow) setMaKey('ma' + props.maWindow);
    }, [props.maWindow]);

    useEffect(function () {
      SCIOVA.utils.lsSet('sciova_ma_window', maKey);
    }, [maKey]);

    useEffect(function () {
      SCIOVA.utils.lsSet('sciova_trend_tab', activeTab);
    }, [activeTab]);

    // Fetch metrics when selected URL changes
    useEffect(function () {
      cleanupChart();

      if (!selectedUrl || !selectedUrl.id) {
        setLoading(false);
        setMetrics(null);
        if (typeof props.onReady === 'function') props.onReady();
        return;
      }

      setLoading(true);
      setError('');
      setMetrics(null);
      setMissingCruxKey(false);

      SCIOVA_STORE.ensureSettings()
        .then(function (s) {
          if (!s || !s.has_crux_key) {
            setMissingCruxKey(true);
            setLoading(false);
            return null;
          }
          return SCIOVA_STORE.ensureMetrics(selectedUrl.id)
            .then(function (data) {
              setMetrics(data || null);
              if (data && typeof props.onClassificationChange === 'function') {
                var maK = props.maWindow ? 'ma' + props.maWindow : SCIOVA.utils.lsGet('sciova_ma_window', 'ma5');
                if (data.classification && data.classification[maK]) {
                  props.onClassificationChange(data.classification[maK], selectedUrl.id);
                }
              }
            });
        })
        .catch(function (err) {
          setError(SCIOVA.utils.getErrorMessage(err) || 'Failed to load trend.');
        })
        .finally(function () {
          setLoading(false);
          if (typeof props.onReady === 'function') props.onReady();
        });

    }, [selectedUrl ? selectedUrl.id : null]);

    // Render chart whenever metrics, maKey, or activeTab changes
    useEffect(function () {
      cleanupChart();

      if (!metrics || !metrics.metrics) return;
      if (!chartDivRef.current) return;

      var labels = metrics.periods.map(SCIOVA.utils.formatPeriodLabel);
      var metricData = metrics.metrics[activeTab];
      var rawSeries = (metricData && metricData.p75)   ? metricData.p75   : [];
      var maSeries  = (metricData && metricData[maKey]) ? metricData[maKey] : null;

      chartInstRef.current = SCIOVA.utils.renderLineChart(
        chartDivRef.current, labels, rawSeries, activeTab, maSeries
      );

      return function () { cleanupChart(); };

    }, [metrics, maKey, activeTab]);

    // Notify parent of analysis text + periods
    useEffect(function () {
      if (typeof props.onAnalysisChange === 'function') {
        props.onAnalysisChange(buildAnalysisText(metrics, maKey));
      }
      if (typeof props.onPeriodsChange === 'function') {
        props.onPeriodsChange(
          (metrics && Array.isArray(metrics.periods)) ? metrics.periods : []
        );
      }
    }, [metrics, maKey]);

    // ── Render ──────────────────────────────────────────────

    if (!selectedUrl) {
      return el('div', { className: 'g26-empty' },
        el('small', null, 'Select a URL to view CrUX history.')
      );
    }

    if (missingCruxKey) {
      return el('div', { className: 'g26-empty' },
        el('small', null, 'No CrUX API key configured.')
      );
    }

    if (error) {
      return el('div', { className: 'g26-error' }, error);
    }

    if (loading && !metrics) {
      return el('p', null, 'Loading…');
    }

    if (!metrics) return null;

    // Feature 3: empty state when no data
    var hasData = metrics && metrics.metrics && (
      (metrics.metrics.lcp && metrics.metrics.lcp.p75 && metrics.metrics.lcp.p75.some(function(v){ return v !== null; })) ||
      (metrics.metrics.cls && metrics.metrics.cls.p75 && metrics.metrics.cls.p75.some(function(v){ return v !== null; })) ||
      (metrics.metrics.inp && metrics.metrics.inp.p75 && metrics.metrics.inp.p75.some(function(v){ return v !== null; }))
    );

    if (!hasData) {
      return el('div', { className: 'g26-empty' },
        el('p', null, 'No CrUX data available for this URL.'),
        el('small', null, 'This URL may have insufficient real-world traffic in Chrome, or data may not yet be available. CrUX data typically requires a URL to be visited by a meaningful number of Chrome users.')
      );
    }

    return el('div', { style: { minWidth: 0, overflow: 'hidden' } },

      // Feature 1: last updated meta
      el('div', { className: 'g26-crux-meta' },
        metrics.last_updated ? 'Updated ' + metrics.last_updated : null,
        metrics.from_cache ? ' (cached)' : ' (live)'
      ),

      // Tab bar
      el('div', { className: 'g26-trend-tabs' },
        TABS.map(function (tab) {
          var isActive = activeTab === tab.key;
          var classification = metrics.classification && metrics.classification[maKey]
            ? metrics.classification[maKey][tab.key]
            : null;

          return el('button', {
            key: tab.key,
            type: 'button',
            className: 'g26-trend-tab' + (isActive ? ' is-active' : ''),
            onClick: function () { setActiveTab(tab.key); }
          },
            tab.label,
            classification && classification !== 'insufficient-data'
              ? el('span', {
                  className: 'g26-trend-tab__badge g26-trend-tab__badge--' + classification
                }, classification)
              : null
          );
        })
      ),

      // Chart area
      el('div', { className: 'g26-box g26-trend-chart-box' },
        el('div', { ref: chartDivRef, style: { width: '100%' } })
      )
    );
  }

  // CWV good/needs-improvement/poor thresholds (p75, ms or score)
  var CWV_THRESHOLDS = {
    lcp: { good: 2500, poor: 4000, unit: 'ms', label: 'LCP' },
    cls: { good: 0.10, poor: 0.25, unit: '',   label: 'CLS' },
    inp: { good: 200,  poor: 500,  unit: 'ms', label: 'INP' }
  };

  function cwvRating(metric, value) {
    var t = CWV_THRESHOLDS[metric];
    if (!t || value === null || value === undefined) return null;
    if (value <= t.good) return 'good';
    if (value <= t.poor) return 'needs improvement';
    return 'poor';
  }

  function fmtValue(metric, value) {
    var t = CWV_THRESHOLDS[metric];
    if (!t) return String(value);
    if (t.unit === 'ms') return (value >= 1000 ? (value / 1000).toFixed(2) + 's' : Math.round(value) + 'ms');
    return Number(value).toFixed(3);
  }

  function buildAnalysisText(metrics, maKey) {
    if (!metrics || !metrics.metrics || !metrics.classification) return 'Not enough data yet.';
    var cls = metrics.classification[maKey];
    if (!cls) return 'Not enough data yet.';

    var parts = [];

    ['lcp', 'cls', 'inp'].forEach(function (key) {
      var trend = cls[key];
      if (!trend || trend === 'insufficient-data') return;

      var metricData = metrics.metrics[key];
      var p75Series = metricData && Array.isArray(metricData.p75) ? metricData.p75 : [];
      // Filter out nulls
      var valid = p75Series.filter(function (v) { return v !== null && v !== undefined; });
      if (!valid.length) return;

      var latest = valid[valid.length - 1];
      var earliest = valid[0];
      var rating = cwvRating(key, latest);
      var t = CWV_THRESHOLDS[key];

      var sentence = t.label + ' is currently ' + fmtValue(key, latest);

      if (rating === 'good') {
        sentence += ' — within the good threshold (' + fmtValue(key, t.good) + ')';
        if (trend === 'improving') sentence += ' and continuing to improve.';
        else if (trend === 'regressing') sentence += ', though the trend is starting to worsen — keep an eye on it.';
        else sentence += ' and holding steady.';
      } else if (rating === 'needs improvement') {
        sentence += ' — in the needs-improvement range';
        if (trend === 'improving') sentence += '. The trend is moving in the right direction; aim for below ' + fmtValue(key, t.good) + '.';
        else if (trend === 'regressing') sentence += ' and getting worse. Investigate recent changes before it reaches the poor threshold (' + fmtValue(key, t.poor) + ').';
        else sentence += '. No movement detected — consider optimizing to reach the good threshold (' + fmtValue(key, t.good) + ').';
      } else {
        // poor
        sentence += ' — above the poor threshold (' + fmtValue(key, t.poor) + ')';
        if (trend === 'improving') sentence += '. It\'s improving but still needs significant work to reach good (' + fmtValue(key, t.good) + ').';
        else if (trend === 'regressing') sentence += ' and continuing to worsen. This needs immediate attention.';
        else sentence += ' and stalled. Prioritize this metric.';
      }

      // Delta insight if we have enough data
      if (valid.length >= 4) {
        var delta = latest - earliest;
        var pct = Math.abs(Math.round((delta / (earliest || 1)) * 100));
        if (pct >= 5) {
          sentence += ' (';
          sentence += delta > 0 ? '+' : '-';
          sentence += pct + '% over ' + valid.length + ' periods)';
        }
      }

      parts.push(sentence);
    });

    return parts.length ? parts.join('\n\n') : 'Not enough data yet.';
  }

  SCIOVA.panels = SCIOVA.panels || {};
  SCIOVA.panels.TrendPanel = TrendPanel;
})();
