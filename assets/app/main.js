(function () {
  'use strict';
  if (!window.wp || !wp.element) return;

  var el = (window.SCIOVA && SCIOVA.React && SCIOVA.React.el) ? SCIOVA.React.el : wp.element.createElement;

  window.SCIOVA = window.SCIOVA || {};

  // Overlay starts hidden (see dashboard.php).
  // showOverlay() is called by App once keys are confirmed configured.
  // hideOverlay() / overlayDone() work as before.
  var _overlayDone = 0;
  var _overlayTotal = 4; // URLs + TrendPanel + PsiPanel + NotesPanel
  var _overlayHidden = false;
  var _overlayShown = false;

  SCIOVA.showOverlay = function () {
    if (_overlayShown) return;
    _overlayShown = true;
    var overlay = document.getElementById('g26-loading-overlay');
    if (overlay) overlay.style.display = 'flex';
  };

  SCIOVA.hideOverlay = function () {
    if (_overlayHidden) return;
    _overlayHidden = true;
    var overlay = document.getElementById('g26-loading-overlay');
    if (overlay) overlay.style.display = 'none';
  };

  SCIOVA.overlayDone = function () {
    _overlayDone++;
    if (_overlayDone >= _overlayTotal) SCIOVA.hideOverlay();
  };

  document.addEventListener('DOMContentLoaded', function () {
    var node = document.getElementById('g26-app');
    if (!node) return;
    var App = (window.SCIOVA && SCIOVA.App) ? SCIOVA.App : null;
    if (!App) {
      SCIOVA.hideOverlay();
      return;
    }
    wp.element.render(el(App), node);

    // Safety net: force-hide overlay after 10s regardless of signal count.
    setTimeout(function () {
      SCIOVA.hideOverlay();
    }, 10000);
  });
})();
