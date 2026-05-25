(function () {
  'use strict';

  var SCIOVA_DEBUG = false;

  function dlog() { if (SCIOVA_DEBUG && console && console.log) console.log.apply(console, arguments); }

  if (!window.wp || !wp.element || !wp.apiFetch) return;

  window.SCIOVA = window.SCIOVA || {};
  SCIOVA.React = SCIOVA.React || {};
  SCIOVA.core = SCIOVA.core || {};

  // wp.element bindings for non-module scripts
  SCIOVA.React.el = wp.element.createElement;
  SCIOVA.React.useEffect = wp.element.useEffect;
  SCIOVA.React.useMemo = wp.element.useMemo;
  SCIOVA.React.useRef = wp.element.useRef;
  SCIOVA.React.useState = wp.element.useState;

  // Configure nonce for REST requests
  var settings = window.SCIOVA_SETTINGS || {};

  if (settings && settings.nonce && wp.apiFetch.createNonceMiddleware) {
    wp.apiFetch.use(wp.apiFetch.createNonceMiddleware(settings.nonce));
  }

  /**
   * Build a REST endpoint URL (relative path).
   * @param {string} path
   * @returns {string}
   */
  function rest(path) {
    var base = (settings && settings.restUrl) ? String(settings.restUrl) : '';
    base = base.replace(/\/$/, '');
    return base + path;
  }

  /**
   * Unwrap {success:true,data} and throw on {success:false,...}
   * @param {*} res
   * @param {string} fallbackMessage
   * @returns {*}
   */
  function unwrapSuccess(res, fallbackMessage) {
    if (!res || res.success !== true) {
      var msg = fallbackMessage || 'Request failed.';
      if (res && res.error && typeof res.error.message === 'string' && res.error.message.trim()) msg = res.error.message;
      else if (res && typeof res.message === 'string' && res.message.trim()) msg = res.message;
      throw new Error(msg);
    }
    return res.data;
  }

  SCIOVA.core.dlog = dlog;

  SCIOVA.core.rest = rest;
  SCIOVA.core.unwrapSuccess = unwrapSuccess;

})();