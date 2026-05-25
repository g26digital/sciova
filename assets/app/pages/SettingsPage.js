(function () {
  'use strict';
  if (!window.wp || !wp.element) return;

  window.SCIOVA = window.SCIOVA || {};
  SCIOVA.React = SCIOVA.React || {};

  var el = (SCIOVA.React.el) ? SCIOVA.React.el : wp.element.createElement;
  var useEffect = SCIOVA.React.useEffect || wp.element.useEffect;
  var useState = SCIOVA.React.useState || wp.element.useState;

  var settings = window.SCIOVA_SETTINGS || {};

  /**
   * Masks all but the last 4 chars of a secret. Returns '' for falsy values.
   * Example: "abcd1234efgh" -> "••••••••efgh"
   */
  function maskLast4(value) {
    var s = String(value || '');
    if (!s) return '';
    if (s.length <= 4) return '••••' + s; // still mask even if short
    return '••••••••' + s.slice(-4);
  }

  /**
   * Detects if the value appears to be a masked placeholder (not a real key).
   * We treat any value containing the bullet mask as masked.
   */
  function isMaskedValue(value) {
    var s = String(value || '');
    return s.indexOf('••••') !== -1;
  }

  function SettingsPage() {
    var _a = useState(true), loading = _a[0], setLoading = _a[1];
    var _b = useState(''), status = _b[0], setStatus = _b[1];

    var _c = useState(''), cruxKey = _c[0], setCruxKey = _c[1];
    var _d = useState(''), psiKey = _d[0], setPsiKey = _d[1];

    var _e = useState(false), cruxDirty = _e[0], setCruxDirty = _e[1];
    var _f = useState(false), psiDirty = _f[0], setPsiDirty = _f[1];

    // Test keys state
    var _t0 = useState(null), testResult = _t0[0], setTestResult = _t0[1];
    var _t1 = useState(false), testLoading = _t1[0], setTestLoading = _t1[1];

    // CrUX settings
    var _g = useState(''), formFactor = _g[0], setFormFactor = _g[1];
    var _h = useState(25), periodCount = _h[0], setPeriodCount = _h[1];
    var _i = useState(false), ffDirty = _i[0], setFfDirty = _i[1];
    var _j = useState(false), pcDirty = _j[0], setPcDirty = _j[1];

    // Safe helpers (avoid ReferenceError if moved under SCIOVA.core)
    var rest = (SCIOVA.core && SCIOVA.core.rest) ? SCIOVA.core.rest : function (p) { return p; };
    var unwrapSuccess = (SCIOVA.core && SCIOVA.core.unwrapSuccess) ? SCIOVA.core.unwrapSuccess : function (r) { return r; };

    var PageHeader =
      (SCIOVA.components && SCIOVA.components.PageHeader)
        ? SCIOVA.components.PageHeader
        : null;

    var headerRight = el('div', { className: 'g26-flex' },
          el('button', { type: 'button', className: 'button button-primary', onClick: save }, 'Save Settings')
        );

    useEffect(function () {
      setLoading(true);
      setStatus('');

      if (!window.SCIOVA_STORE || !SCIOVA_STORE.ensureSettings) {
        setStatus('Store not ready. SCIOVA_STORE.ensureSettings() missing.');
        setLoading(false);
        return;
      }

      SCIOVA_STORE.ensureSettings()
        .then(function (data) {
          var hasCrux = !!(data && data.has_crux_key);
          var hasPsi = !!(data && data.has_psi_key);

          setStatus('CrUX: ' + (hasCrux ? 'configured' : 'missing') + ' | PSI: ' + (hasPsi ? 'configured' : 'missing'));

          if (hasCrux) {
            setCruxKey(maskLast4(data.crux_api_key || ''));
            setCruxDirty(false);
          } else {
            setCruxKey('');
            setCruxDirty(false);
          }

          if (hasPsi) {
            setPsiKey(maskLast4(data.psi_api_key || ''));
            setPsiDirty(false);
          } else {
            setPsiKey('');
            setPsiDirty(false);
          }

          setFormFactor((data && typeof data.crux_form_factor === 'string') ? data.crux_form_factor : '');
          setPeriodCount((data && typeof data.crux_period_count === 'number') ? data.crux_period_count : 25);
          setFfDirty(false);
          setPcDirty(false);
        })
        .catch(function (err) {
          setStatus((SCIOVA.utils && SCIOVA.utils.getErrorMessage ? SCIOVA.utils.getErrorMessage(err) : '') || 'Failed to load settings.');
        })
        .finally(function () {
          setLoading(false);
        });
    }, []);

    function save() {
      var payload = {};
      var cruxTrim = (cruxKey || '').trim();
      var psiTrim = (psiKey || '').trim();

      // Keys only sent if user pasted a new unmasked value.
      if (cruxDirty && cruxTrim && !isMaskedValue(cruxTrim)) {
        payload.crux_api_key = cruxTrim;
      }
      if (psiDirty && psiTrim && !isMaskedValue(psiTrim)) {
        payload.psi_api_key = psiTrim;
      }

      if (ffDirty) {
        payload.crux_form_factor = (formFactor || '').trim();
      }
      if (pcDirty) {
        var pc = parseInt(String(periodCount), 10);
        if (!isFinite(pc)) pc = 25;
        payload.crux_period_count = pc;
      }

      if (!payload.crux_api_key && !payload.psi_api_key && !ffDirty && !pcDirty) {
        setStatus('Nothing to save. Paste a new key to update.');
        return;
      }

      setStatus('Saving…');

      wp.apiFetch({
        url: rest('/settings'),
        method: 'POST',
        data: payload
      })
        .then(function (res) {
          var data = unwrapSuccess(res, 'Save failed.');

          if (window.SCIOVA_STORE && SCIOVA_STORE.setSettings) {
            SCIOVA_STORE.setSettings(data);
          }

          // If CrUX key or CrUX settings changed, invalidate metrics cache.
          if (payload.crux_api_key || ffDirty || pcDirty) {
            if (SCIOVA_STORE && SCIOVA_STORE.getState) {
              SCIOVA_STORE.getState().metrics = {};
              SCIOVA_STORE.getState().metricsFetchedAt = {};
            }
          }

          var hasCrux = !!(data && data.has_crux_key);
          var hasPsi = !!(data && data.has_psi_key);

          setCruxKey(hasCrux ? maskLast4(data.crux_api_key || '') : '');
          setPsiKey(hasPsi ? maskLast4(data.psi_api_key || '') : '');

          setCruxDirty(false);
          setPsiDirty(false);
          setFfDirty(false);
          setPcDirty(false);

          var bothKeysNowSet = !!(data && data.has_crux_key && data.has_psi_key);
          if (bothKeysNowSet) {
            // Reload so App re-checks keysConfigured with fresh state
            setStatus('Saved. Redirecting to dashboard…');
            setTimeout(function () { window.location.reload(); }, 800);
          } else {
            setStatus('Saved. Keys stored.');
          }
        })
        .catch(function (err) {
          setStatus((SCIOVA.utils && SCIOVA.utils.getErrorMessage ? SCIOVA.utils.getErrorMessage(err) : '') || 'Save failed.');
        });
    }

    function testKeys() {
      setTestLoading(true);
      setTestResult(null);
      wp.apiFetch({ url: rest('/settings/test'), method: 'GET' })
        .then(function(res) {
          var data = unwrapSuccess(res, 'Test failed.');
          setTestResult(data);
        })
        .catch(function(err) {
          var msg = (SCIOVA.utils && SCIOVA.utils.getErrorMessage ? SCIOVA.utils.getErrorMessage(err) : '') || 'Test failed.';
          setTestResult({ error: msg });
        })
        .finally(function() { setTestLoading(false); });
    }

    // ---- Page Header Node (component or fallback) ----
    var headerNode = PageHeader
      ? el(PageHeader, {
          key: 'hdr',
          title: 'Settings',
          subtitle: 'Configure CrUX + API keys.',
          right: headerRight
        })
      : el('div', { key: 'hdr-fallback', className: 'g26-header' },
            el('div', { className: 'g26-flex-between' },
              el('div', null,
                el('h1', null, 'Settings'),
                el('small', null, 'Configure CrUX + API keys.')
              ),
              el('div', null, headerRight)
            ),
            el('div', { className: 'g26-divider' })
        );

    // NOTE: Return array (no wrapper div) so it matches your DOM contract:
    // .g26-pageHeader + rows
    return [
      // Header
      headerNode,

      // Rows 1 + 2 — side-by-side grid
      el('div', { key: 'settings-cards', className: 'g26-settings-grid' },

      // Row 1 — API Keys card
      el('div', { className: 'g26-card' },
        el('div', { className: 'g26-card__header' },
          el('h3', null, 'API Keys')
        ),

        el('div', { className: 'g26-card__body' },

          el('p', { className: 'description' },
            'Create an API key in Google Cloud Console...'
          ),

          el('div', { className: 'g26-settings-grid' },
            el('div', { className: 'g26-field' },
              el('label', null, 'CrUX API Key'),
              el('input', {
                type: 'text',
                className: 'g26-input',
                value: cruxKey,
                onChange: function (e) { setCruxKey(e.target.value); setCruxDirty(true); },
                placeholder: 'Paste CrUX API key'
              })
            ),

            el('div', { className: 'g26-field' },
              el('label', null, 'PSI API Key'),
              el('input', {
                type: 'text',
                className: 'g26-input',
                value: psiKey,
                onChange: function (e) { setPsiKey(e.target.value); setPsiDirty(true); },
                placeholder: 'Paste PSI API key'
              })
            )
          ),

          status ? el('small', null, status) : null,

          el('div', { style: { marginTop: '8px' } },
            el('button', {
              type: 'button',
              className: 'button',
              onClick: testKeys,
              disabled: testLoading
            }, testLoading ? 'Testing\u2026' : 'Test Keys')
          ),

          testResult
            ? (testResult.error
                ? el('div', { className: 'g26-error', style: { marginTop: '8px' } }, testResult.error)
                : el('div', { className: 'g26-test-result' },
                    testResult.crux
                      ? el('div', { className: 'g26-test-result__row' },
                          el('span', { className: 'g26-test-result__icon--' + (testResult.crux.ok ? 'ok' : 'fail') },
                            testResult.crux.ok ? '\u2713' : '\u2717'
                          ),
                          el('span', null, 'CrUX: ' + (testResult.crux.message || ''))
                        )
                      : null,
                    testResult.psi
                      ? el('div', { className: 'g26-test-result__row' },
                          el('span', { className: 'g26-test-result__icon--' + (testResult.psi.ok ? 'ok' : 'fail') },
                            testResult.psi.ok ? '\u2713' : '\u2717'
                          ),
                          el('span', null, 'PSI: ' + (testResult.psi.message || ''))
                        )
                      : null
                  )
              )
            : null
        )
      ),

      // Row 2 — CrUX Settings card
      el('div', { className: 'g26-card' },
        el('div', { className: 'g26-card__header' },
          el('h3', { className: 'g26-h3' }, 'CrUX Settings'),
        ),        

        el('div', { className: 'g26-card__body' },
          el('p', { className: 'description' }, 'Controls how CrUX metrics are queried and displayed.'),

          el('div', { className: 'g26-settings-grid' },
            el('div', { className: 'g26-field' },
              el('label', null, 'CrUX Form Factor'),
              el('select', {
                className: 'g26-input',
                value: formFactor,
                onChange: function (e) { setFormFactor(e.target.value); setFfDirty(true); }
              },
                el('option', { value: '' }, 'ALL'),
                el('option', { value: 'PHONE' }, 'PHONE'),
                el('option', { value: 'DESKTOP' }, 'DESKTOP'),
                el('option', { value: 'TABLET' }, 'TABLET')
              ),
              el('p', { className: 'description' }, 'Filter the CrUX dataset by device type.')
            ),

            el('div', { className: 'g26-field' },
              el('label', null, 'CrUX Period Count (1–40)'),
              el('input', {
                type: 'number',
                min: 1,
                max: 40,
                className: 'g26-input',
                value: periodCount,
                onChange: function (e) { setPeriodCount(e.target.value); setPcDirty(true); }
              }),
              el('p', { className: 'description' }, 'How many time periods to request for the trend chart.')
            )
          )
        )
      )

      ) // end .g26-settings-grid
    ];
  }

  SCIOVA.pages = SCIOVA.pages || {};
  SCIOVA.pages.SettingsPage = SettingsPage;
})();