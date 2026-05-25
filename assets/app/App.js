(function () {
  'use strict';

  if (!window.wp || !wp.element) return;

  window.SCIOVA = window.SCIOVA || {};
  SCIOVA.React = SCIOVA.React || {};

  var el = SCIOVA.React.el ? SCIOVA.React.el : wp.element.createElement;
  var useEffect = SCIOVA.React.useEffect || wp.element.useEffect;
  var useState = SCIOVA.React.useState || wp.element.useState;
  // Ensure router exists
  SCIOVA.router = SCIOVA.router || {};

  /**
   * Default hash router (dashboard/settings).
   * @returns {"dashboard"|"settings"}
   */
  SCIOVA.router.getRoute = SCIOVA.router.getRoute || function () {
    var hash = window.location.hash || '#dashboard';
    return (hash === '#settings') ? 'settings' : 'dashboard';
  };

  function App() {
    var _a = useState(SCIOVA.router.getRoute()), route = _a[0], setRoute = _a[1];
    var _b = useState(null), keysConfigured = _b[0], setKeysConfigured = _b[1]; // null = loading

    useEffect(function () {
      function onHashChange() {
        setRoute(SCIOVA.router.getRoute());
      }
      window.addEventListener('hashchange', onHashChange);
      return function () {
        window.removeEventListener('hashchange', onHashChange);
      };
    }, []);

    // Check API keys on mount. Force settings route + hide overlay if unconfigured.
    useEffect(function () {
      var store = window.SCIOVA_STORE;
      if (!store || typeof store.ensureSettings !== 'function') {
        setKeysConfigured(true); // can't check — let app proceed normally
        return;
      }

      store.ensureSettings()
        .then(function (s) {
          var configured = !!(s && s.has_crux_key && s.has_psi_key);
          setKeysConfigured(configured);
          if (!configured) {
            // No keys — hide loader, redirect to settings
            if (typeof SCIOVA.hideOverlay === 'function') SCIOVA.hideOverlay();
            setRoute('settings');
            window.location.hash = '#settings';
          }
          // Keys present — overlay stays visible, waits for 3 panel signals
        })
        .catch(function () {
          setKeysConfigured(true); // on error let app proceed, overlay already visible
        });
    }, []);

    // New unified parent template (Header + Tab Container)
    var AppTemplate =
      (window.SCIOVA && SCIOVA.UI && SCIOVA.UI.Shell && SCIOVA.UI.Shell.AppTemplate)
        ? SCIOVA.UI.Shell.AppTemplate
        : null;

    // Still checking keys — overlay stays visible (set in dashboard.php)
    if (keysConfigured === null) {
      return null;
    }

    var DashboardPage = (SCIOVA.pages && SCIOVA.pages.DashboardPage) ? SCIOVA.pages.DashboardPage : null;
    var SettingsPage = (SCIOVA.pages && SCIOVA.pages.SettingsPage) ? SCIOVA.pages.SettingsPage : null;

    var content =
      route === 'settings'
        ? (SettingsPage ? el(SettingsPage, null) : el('div', null, 'SettingsPage missing'))
        : (DashboardPage ? el(DashboardPage, { keysConfigured: keysConfigured }) : el('div', null, 'DashboardPage missing'));

    // Preferred render path: single parent template controls layout
    if (AppTemplate) {
      return el(AppTemplate, { route: route, keysConfigured: keysConfigured }, content);
    }

    // Fallback: render content only (no shell). Keep simple.
    return el('div', { className: 'g26-dashboard p0' }, content);
  }

  SCIOVA.App = App;

})();