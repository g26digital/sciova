(function () {
  'use strict';
  if (!window.wp || !wp.element) return;

  window.SCIOVA = window.SCIOVA || {};
  SCIOVA.React = SCIOVA.React || {};

  var el = (SCIOVA.React.el) ? SCIOVA.React.el : wp.element.createElement;
  var useEffect = SCIOVA.React.useEffect || wp.element.useEffect;
  var useState = SCIOVA.React.useState || wp.element.useState;

  function fmtTs(tsSeconds) {
    return (SCIOVA.utils && SCIOVA.utils.formatTs) ? SCIOVA.utils.formatTs(tsSeconds) : '';
  }

  // Google CWV thresholds → good / needs-improvement / poor
  function scoreClass(metric, value) {
    if (value === null || value === undefined) return '';
    var v = Number(value);
    if (metric === 'performance') {
      return v >= 90 ? 'good' : v >= 50 ? 'needs-improvement' : 'poor';
    }
    if (metric === 'fcp') { // ms
      return v <= 1800 ? 'good' : v <= 3000 ? 'needs-improvement' : 'poor';
    }
    if (metric === 'lcp') { // ms
      return v <= 2500 ? 'good' : v <= 4000 ? 'needs-improvement' : 'poor';
    }
    if (metric === 'cls') {
      return v <= 0.1 ? 'good' : v <= 0.25 ? 'needs-improvement' : 'poor';
    }
    return '';
  }

  function PsiMetric(label, value, displayValue, metric) {
    var cls = scoreClass(metric, value);
    return el('div', { className: 'g26-psi-metric g26-psi-metric--' + cls },
      el('div', { className: 'g26-psi-metric__indicator' }),
      el('div', { className: 'g26-psi-metric__body' },
        el('div', { className: 'g26-psi-metric__label' }, label),
        el('div', { className: 'g26-psi-metric__value' }, displayValue)
      )
    );
  }

  function PsiPanel(props) {
    var selectedUrl = (props && props.selectedUrl) ? props.selectedUrl : null;

    var _a = useState(false),    loading       = _a[0], setLoading       = _a[1];
    var _b = useState(''),       error         = _b[0], setError         = _b[1];
    var _c = useState(null),     psi           = _c[0], setPsi           = _c[1];
    var _d = useState(false),    missingPsiKey = _d[0], setMissingPsiKey = _d[1];
    var _t = useState('mobile'), tab           = _t[0], setTab           = _t[1];

    var summary = psi
      ? (tab === 'desktop' && psi.desktop ? psi.desktop : (psi.mobile || psi.summary || null))
      : null;
    var store = (SCIOVA && SCIOVA.store) ? SCIOVA.store : window.SCIOVA_STORE;

    function refresh() {
      if (!selectedUrl || !selectedUrl.id) return;
      if (!store || typeof store.refreshPsi !== 'function') {
        setError('PSI refresh is unavailable (store not ready).');
        return;
      }
      setError('');
      setLoading(true);
      store.refreshPsi(selectedUrl.id)
        .then(function (data) { setPsi(data || null); })
        .catch(function (err) {
          setError((SCIOVA.utils && SCIOVA.utils.getErrorMessage)
            ? SCIOVA.utils.getErrorMessage(err)
            : (err && err.message ? err.message : 'Failed to refresh PSI.'));
        })
        .finally(function () { setLoading(false); });
    }

    useEffect(function () {
      if (!selectedUrl || !selectedUrl.id) {
        setLoading(false);
        setPsi(null);
        setMissingPsiKey(false);
        setError('');
        if (typeof props.onReady === 'function') props.onReady();
        return;
      }

      setLoading(true);
      setError('');
      setPsi(null);
      setMissingPsiKey(false);

      if (!store || typeof store.ensureSettings !== 'function') {
        setError('Settings are unavailable (store not ready).');
        setLoading(false);
        if (typeof props.onReady === 'function') props.onReady();
        return;
      }

      store.ensureSettings()
        .then(function (s) {
          if (!s || !s.has_psi_key) {
            setMissingPsiKey(true);
            setLoading(false);
            return null;
          }
          if (typeof store.ensurePsi !== 'function') {
            throw new Error('PSI endpoint is unavailable (ensurePsi missing).');
          }
          return store.ensurePsi(selectedUrl.id).then(function (data) {
            setPsi(data || null);
            return data;
          });
        })
        .catch(function (err) {
          setError((SCIOVA.utils && SCIOVA.utils.getErrorMessage)
            ? SCIOVA.utils.getErrorMessage(err)
            : (err && err.message ? err.message : 'Failed to load PSI.'));
        })
        .finally(function () {
          setLoading(false);
          if (typeof props.onReady === 'function') props.onReady();
        });

    }, [selectedUrl ? selectedUrl.id : null]);

    var scoreVal = summary && summary.performance_score != null
      ? Math.round(Number(summary.performance_score))
      : null;

    return el('div', { className: 'g26-card' },

      el('div', { className: 'g26-card__header' },
        el('div', null,
          el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            el('h3', null, 'PageSpeed Insights'),
            scoreVal != null
              ? el('span', {
                  className: 'g26-score-badge g26-score-badge--' + scoreClass('performance', scoreVal)
                }, scoreVal)
              : null
          ),
          el('small', null, 'Performance + FCP/LCP/CLS')
        ),
        el('div', { className: 'g26-card__actions' },
          el('div', { className: 'g26-trend-tabs' },
            el('button', {
              type: 'button',
              className: 'g26-trend-tab' + (tab === 'mobile' ? ' is-active' : ''),
              onClick: function () { setTab('mobile'); }
            }, 'Mobile'),
            el('button', {
              type: 'button',
              className: 'g26-trend-tab' + (tab === 'desktop' ? ' is-active' : ''),
              onClick: function () { setTab('desktop'); }
            }, 'Desktop')
          ),
          el('button', {
            className: 'button',
            onClick: refresh,
            disabled: loading || missingPsiKey || !selectedUrl || !selectedUrl.id
          }, loading ? 'Refreshing…' : 'Refresh')
        )
      ),

      el('div', { className: 'g26-card__body' },

        (!selectedUrl || !selectedUrl.id)
          ? el('div', { className: 'g26-empty' }, el('small', null, 'Select a tracked URL.'))
          : null,

        missingPsiKey
          ? el('div', { className: 'g26-empty' }, el('small', null, 'No PSI key configured.'))
          : null,

        error ? el('div', { className: 'g26-error' }, error) : null,

        summary
          ? el('div', { className: 'g26-psi-grid' },
              PsiMetric(
                'Performance',
                summary.performance_score != null ? Math.round(Number(summary.performance_score)) : null,
                summary.performance_score != null ? Math.round(Number(summary.performance_score)) : '—',
                'performance'
              ),
              PsiMetric(
                'FCP',
                summary.fcp_ms,
                summary.fcp_ms != null ? (Number(summary.fcp_ms) / 1000).toFixed(2) + 's' : '—',
                'fcp'
              ),
              PsiMetric(
                'LCP',
                summary.lcp_ms,
                summary.lcp_ms != null ? (Number(summary.lcp_ms) / 1000).toFixed(2) + 's' : '—',
                'lcp'
              ),
              PsiMetric(
                'CLS',
                summary.cls,
                summary.cls != null ? Number(summary.cls).toFixed(3) : '—',
                'cls'
              )
            )
          : null,

        (loading && !summary)
          ? el('p', null, 'Loading…')
          : null
      )
    );
  }

  SCIOVA.panels = SCIOVA.panels || {};
  SCIOVA.panels.PsiPanel = PsiPanel;
})();
