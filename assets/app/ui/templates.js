(function () {
  'use strict';
  if (!window.wp || !wp.element) return;

  window.SCIOVA = window.SCIOVA || {};
  SCIOVA.React = SCIOVA.React || {};

  var el = SCIOVA.React.el || wp.element.createElement;

  function HeaderNav(props) {
    var route = props && props.route ? props.route : 'dashboard';
    var keysConfigured = props && props.keysConfigured !== false; // treat null/undefined as enabled

    var dashAttrs = {
      className: 'g26-nav__link' + (route === 'dashboard' ? ' is-active' : '') + (!keysConfigured ? ' is-disabled' : ''),
      href: keysConfigured ? '#dashboard' : undefined,
      onClick: !keysConfigured ? function (e) { e.preventDefault(); } : undefined,
      title: !keysConfigured ? 'Configure your API keys in Settings first' : undefined,
      'aria-disabled': !keysConfigured ? 'true' : undefined
    };

    return el('header', { className: 'g26-nav' },
      el('div', { className: 'g26-nav__inner' },

        el('div', { className: 'g26-nav__brand' },
          (window.SCIOVA_SETTINGS && window.SCIOVA_SETTINGS.logoUrl)
            ? el('img', {
                src: window.SCIOVA_SETTINGS.logoUrl,
                alt: 'Sciova',
                className: 'g26-nav__logo',
                height: 40
              })
            : el('div', { className: 'g26-nav__title' }, 'Sciova')
        ),

        el('nav', { className: 'g26-nav__actions' },
          el('a', dashAttrs, 'Dashboard'),

          el('a', {
            className: 'g26-nav__link' + (route === 'settings' ? ' is-active' : ''),
            href: '#settings'
          }, 'Settings')
        )
      )
    );
  }

  function AppTemplate(props) {
    return el('div', null,
      el(HeaderNav, { route: props && props.route ? props.route : 'dashboard' }),
      el('main', { className: 'g26-dashboard' },
        (props && props.children) ? props.children : null
      )
    );
  }

  SCIOVA.UI = SCIOVA.UI || {};
  SCIOVA.UI.Shell = SCIOVA.UI.Shell || {};

  SCIOVA.UI.Shell.HeaderNav = HeaderNav;
  SCIOVA.UI.Shell.AppTemplate = AppTemplate;
})();