(function () {
  'use strict';
  if (!window.wp || !wp.element) return;

  window.SCIOVA = window.SCIOVA || {};
  SCIOVA.React = SCIOVA.React || {};

  var el = (SCIOVA.React.el) ? SCIOVA.React.el : wp.element.createElement;
  var useEffect = SCIOVA.React.useEffect || wp.element.useEffect;
  var useMemo = SCIOVA.React.useMemo || wp.element.useMemo;
  var useState = SCIOVA.React.useState || wp.element.useState;

  var settings = window.SCIOVA_SETTINGS || {};
  var core = SCIOVA.core || {};
  var rest = core.rest || function () { throw new Error('SCIOVA.core.rest is missing'); };
  var unwrapSuccess = core.unwrapSuccess || function () { throw new Error('SCIOVA.core.unwrapSuccess is missing'); };

  var store = (SCIOVA.store) ? SCIOVA.store : window.SCIOVA_STORE;

  var AddUrlModal = (SCIOVA.components && SCIOVA.components.AddUrlModal) ? SCIOVA.components.AddUrlModal : null;
  var PageHeader = (SCIOVA.components && SCIOVA.components.PageHeader) ? SCIOVA.components.PageHeader : null;
  var UrlDropdown = (SCIOVA.components && SCIOVA.components.UrlDropdown) ? SCIOVA.components.UrlDropdown : null;

  function DashboardPage(props) {
    // keysConfigured: null = still checking, false = no keys, true = ready
    var keysConfigured = (props && typeof props.keysConfigured !== 'undefined') ? props.keysConfigured : true;

    // No keys yet — skip all loading, show setup prompt
    if (keysConfigured === false) {
      return el('div', { className: 'g26-setup-notice' },
        el('div', { className: 'g26-setup-notice__inner' },
          el('h2', null, 'Almost there!'),
          el('p', null, 'To start tracking performance, add your API keys in Settings.'),
          el('a', { href: '#settings', className: 'button button-primary' }, 'Go to Settings')
        )
      );
    }

    var panels = (SCIOVA.panels) ? SCIOVA.panels : {};
    var TrendPanel = panels.TrendPanel || null;
    var PsiPanel = panels.PsiPanel || null;
    var NotesPanel = panels.NotesPanel || null;

    var _a = useState([]), urls = _a[0], setUrls = _a[1];
    var _b = useState(null), selectedId = _b[0], setSelectedId = _b[1];

    var _d = useState(''), loadError = _d[0], setLoadError = _d[1];

    // MA window moved to card header (5 or 10)
    var _e0 = useState(5), maWindow = _e0[0], setMaWindow = _e0[1];
    var _e1 = useState(''), analysisText = _e1[0], setAnalysisText = _e1[1];
    var _e2 = useState([]), cruxPeriods = _e2[0], setCruxPeriods = _e2[1];
    var _h0 = useState({}), urlHealth = _h0[0], setUrlHealth = _h0[1];
    var _cp = useState(false), copied = _cp[0], setCopied = _cp[1];
    // Settings (capabilities + preferences)
    var _s0 = useState(null), settingsState = _s0[0], setSettingsState = _s0[1];
    var _s1 = useState(true), settingsLoading = _s1[0], setSettingsLoading = _s1[1];
    // Notes correlated with the selected URL (last 30 days)
    var _n0 = useState([]), correlatedNotes = _n0[0], setCorrelatedNotes = _n0[1];

    var selectedUrl = useMemo(function () {
      if (!selectedId) return null;
      for (var i = 0; i < urls.length; i++) {
        if (Number(urls[i].id) === Number(selectedId)) return urls[i];
      }
      return null;
    }, [urls, selectedId]);

    function fetchUrls(force) {
      setLoadError('');

      if (!store || typeof store.ensureUrls !== 'function') {
        setLoadError('Store is not ready (ensureUrls missing). Check script load order.');
        if (typeof SCIOVA.overlayDone === 'function') SCIOVA.overlayDone();
        return Promise.resolve([]);
      }

      var p = force ? (store.invalidateUrls && store.invalidateUrls(), store.ensureUrls()) : store.ensureUrls();

      return p.then(function (list) {
        list = Array.isArray(list) ? list : [];
        setUrls(list);
        if (!selectedId && list.length > 0) setSelectedId(list[0].id);
        return list;
      })
      .catch(function (err) {
        var msg = (SCIOVA.utils && SCIOVA.utils.getErrorMessage)
          ? SCIOVA.utils.getErrorMessage(err)
          : (err && err.message ? err.message : 'Failed to load URLs.');
        setLoadError(msg || 'Failed to load URLs.');
      })
      .finally(function () {
        if (typeof SCIOVA.overlayDone === 'function') SCIOVA.overlayDone();
      });
    }

    function addUrl(url) {
      return wp.apiFetch({
        url: rest('/urls'),
        method: 'POST',
        data: { url: url }
      }).then(function (res) {
        unwrapSuccess(res, 'Failed to add URL.');
        if (store && store.invalidateUrls) store.invalidateUrls();
        return fetchUrls(true);
      });
    }

    function deleteUrl(id) {
      return wp.apiFetch({
        url: rest('/urls/' + encodeURIComponent(id)),
        method: 'DELETE'
      }).then(function (res) {
        unwrapSuccess(res, 'Failed to remove URL.');
        if (store && store.invalidateUrls) store.invalidateUrls();
        return fetchUrls(true).then(function (list) {
          if (String(selectedId) === String(id)) {
            setSelectedId(list && list.length > 0 ? list[0].id : null);
          }
        });
      }).catch(function (err) {
        setLoadError((SCIOVA.utils && SCIOVA.utils.getErrorMessage ? SCIOVA.utils.getErrorMessage(err) : '') || 'Failed to remove URL.');
      });
    }

    useEffect(function () { fetchUrls(false); }, []);

    useEffect(function () {
      if (!store || typeof store.ensureSettings !== 'function') {
        setSettingsLoading(false);
        return;
      }

      store.ensureSettings()
        .then(function (s) {
          setSettingsState(s || null);
          setSettingsLoading(false);

          // Initialize MA once
          if (s &&
              s.preferences &&
              typeof s.preferences.default_ma_window !== 'undefined') {

            var initial = parseInt(String(s.preferences.default_ma_window), 10);
            if (isFinite(initial)) {
              setMaWindow(initial);
            }
          }
        })
        .catch(function () {
          setSettingsLoading(false);
        });
    }, []);

    // Fetch correlated notes (last 30 days) whenever selected URL changes
    useEffect(function () {
      if (!selectedId || !store || typeof store.ensureNotes !== 'function') {
        setCorrelatedNotes([]);
        return;
      }
      var from = SCIOVA.utils.daysAgoYmd(30);
      var to = SCIOVA.utils.todayYmd();
      store.ensureNotes(selectedId, from, to)
        .then(function (items) { setCorrelatedNotes(Array.isArray(items) ? items : []); })
        .catch(function () { setCorrelatedNotes([]); });
    }, [selectedId]);

    var max = (settings.limits && settings.limits.maxUrlsFree) ? settings.limits.maxUrlsFree : 3;
    var isAtLimit = urls.length >= max;

    var _e = useState(false), isAddOpen = _e[0], setAddOpen = _e[1];

    // Page header right controls (URL dropdown + Add)
    var headerRight = el('div', { className: 'g26-field--inline' },
      UrlDropdown
        ? el(UrlDropdown, {
            urls: urls,
            selectedId: selectedId,
            onSelect: setSelectedId,
            onDelete: deleteUrl,
            urlHealth: urlHealth
          })
        : el('span', null, selectedUrl ? (selectedUrl.url || 'Selected') : 'No URL'),
      el('button', {
        type: 'button',
        className: 'button button-primary',
        onClick: function () { setAddOpen(true); }
      }, '+ Add')
    );

    // MA selector moved to CrUX card header actions
    function onMaChange(e) {
      var v = parseInt(String(e && e.target ? e.target.value : ''), 10);
      if (!isFinite(v)) return;

      setMaWindow(v);

      // Persist preference
      wp.apiFetch({
        url: rest('/settings'),
        method: 'POST',
        data: { default_ma_window: v }
      }).then(function (res) {
        try {
          var data = unwrapSuccess(res, 'Failed to save MA preference.');
          setSettingsState(data);
        } catch (err) {}
      });
    }

    function onClassificationChange(cls, urlId) {
      if (!cls || !urlId) return;
      var ratings = [cls.lcp, cls.cls, cls.inp].filter(function(r){ return r && r !== 'insufficient-data'; });
      var health = ratings.indexOf('regressing') >= 0 ? 'regressing' :
                   ratings.indexOf('stable') >= 0 ? 'stable' :
                   ratings.indexOf('improving') >= 0 ? 'improving' : null;
      if (health) {
        setUrlHealth(function(prev) {
          var next = Object.assign({}, prev);
          next[String(urlId)] = health;
          return next;
        });
      }
    }

    function copyReport() {
      var text = 'Sciova \u2014 Performance Report\n';
      text += 'URL: ' + (selectedUrl ? (selectedUrl.url || '') : 'N/A') + '\n';
      text += 'Date: ' + new Date().toLocaleDateString() + '\n\n';
      if (analysisText) text += analysisText + '\n';
      try {
        navigator.clipboard.writeText(text).then(function() {
          setCopied(true);
          setTimeout(function() { setCopied(false); }, 2000);
        });
      } catch(e) {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(function() { setCopied(false); }, 2000);
      }
    }

    var allowedMa = (
      settingsState &&
      settingsState.capabilities &&
      Array.isArray(settingsState.capabilities.ma_windows) &&
      settingsState.capabilities.ma_windows.length > 0
    )
      ? settingsState.capabilities.ma_windows
      : [5, 10]; // fallback: free tier always has MA5 + MA10

    var maSelectNode = [
      el('label', { key: 'ma-lbl' }, 'Moving average'),
      el('select', {
          key: 'ma-sel',
          className: 'g26-select',
          value: String(maWindow || ''),
          onChange: onMaChange,
          disabled: false
        },
        allowedMa.map(function (w) {
          return el('option', { key: String(w), value: String(w) }, 'MA ' + w);
        })
      )
    ];

    // ---- Build page nodes (NO wrapper div; matches Settings behavior) ----
    var pageNodes = [];

    if (loadError) pageNodes.push(el('p', { key: 'error', className: 'g26-error' }, loadError));

    // Page header
    pageNodes.push(
      PageHeader
        ? el(PageHeader, {
            key: 'hdr',
            title: 'Dashboard',
            subtitle: 'Monitor CrUX trends, PSI snapshots, and deployment notes.',
            right: headerRight,
            selectedUrl: selectedUrl
          })
        : el('div', { key: 'hdr-fallback', className: 'g26-header' },
            el('div', { className: 'g26-flex-between' },
              el('div', null,
                el('h1', null, 'Dashboard'),
                el('small', null, 'Monitor CrUX trends, PSI snapshots, and deployment notes.')
              ),
              el('div', null, headerRight)
            ),
            el('div', { className: 'g26-divider' })
          )
    );

    // Row 1 — CrUX card (MA select in header actions)
    pageNodes.push(
      el('div', { key: 'row1', className: 'g26-row' },
        el('div', { className: 'g26-card' },

          el('div', { className: 'g26-card__header' },
            el('div', null,
              el('h3', null, 'CrUX History'),
              el('small', null, 'Moving average trend over time')
            ),
            el('div', { className: 'g26-card__actions' }, maSelectNode)
          ),

          el('div', { className: 'g26-card__body' },
            el('div', { className: 'g26-grid' },
              el('div', { style: { minWidth: 0, overflow: 'hidden' } },
                TrendPanel
                  ? el(TrendPanel, {
                      selectedUrl: selectedUrl,
                      maWindow: maWindow,
                      hideMaSelect: true,
                      onAnalysisChange: setAnalysisText,
                      onPeriodsChange: setCruxPeriods,
                      onClassificationChange: onClassificationChange,
                      onReady: function () { if (typeof SCIOVA.overlayDone === 'function') SCIOVA.overlayDone(); }
                    })
                  : el('div', { className: 'g26-empty' }, 'CrUX panel missing')
              ),
              el('div', null,
                el('div', { className: 'g26-box' },
                  el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' } },
                    el('h4', null, 'Analysis'),
                    el('button', {
                      type: 'button',
                      className: 'button',
                      style: { fontSize: '11px', padding: '2px 8px' },
                      onClick: copyReport
                    }, copied ? '\u2713 Copied!' : 'Copy')
                  ),
                  analysisText
                    ? analysisText.split('\n\n').map(function (para, i) {
                        return el('p', { key: i, className: 'g26-analysis__trend' }, para);
                      })
                    : el('p', { className: 'g26-analysis__trend' }, 'No analysis available yet.'),
                  correlatedNotes.length > 0
                    ? el('div', { className: 'g26-analysis__notes' },
                        el('small', { className: 'g26-muted' }, 'Notes in the last 30 days'),
                        correlatedNotes.slice(0, 5).map(function (n) {
                          return el('div', { key: String(n.id), className: 'g26-analysis__note' },
                            el('small', null,
                              (n.note_date || '') + (n.note_date ? ' — ' : '') + (n.content || '')
                            )
                          );
                        })
                      )
                    : null
                )
              )
            )
          )
        )
      )
    );

    // Row 2 — PSI + Notes
    pageNodes.push(
      el('div', { key: 'row2', className: 'g26-row g26-row--split' },
        el('div', null,
          PsiPanel ? el(PsiPanel, { selectedUrl: selectedUrl, onReady: function () { if (typeof SCIOVA.overlayDone === 'function') SCIOVA.overlayDone(); } }) : el('p', null, 'PsiPanel missing')
        ),
        el('div', null,
          NotesPanel ? el(NotesPanel, { selectedUrl: selectedUrl, cruxPeriods: cruxPeriods, onReady: function () { if (typeof SCIOVA.overlayDone === 'function') SCIOVA.overlayDone(); } }) : el('p', null, 'NotesPanel missing')
        )
      )
    );

    // Modal (optional) — sibling, no wrapper div needed
var AddUrlModalLive =
  (SCIOVA.components && SCIOVA.components.AddUrlModal)
    ? SCIOVA.components.AddUrlModal
    : null;

if (isAddOpen) {
  pageNodes.push(
    AddUrlModalLive
      ? el(AddUrlModalLive, {
          key: 'modal',
          onClose: function () { setAddOpen(false); },
          onAdd: addUrl,
          isAtLimit: isAtLimit
        })
      : el('div', { key: 'modal-missing', className: 'g26-empty' },
          el('small', null, 'AddUrlModal is not available. Check common.js load order / export.')
        )
  );
}

    return pageNodes;
  }

  SCIOVA.pages = SCIOVA.pages || {};
  SCIOVA.pages.DashboardPage = DashboardPage;
})();