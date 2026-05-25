(function () {
  'use strict';
  if (!window.wp || !wp.apiFetch) return;
  window.SCIOVA = window.SCIOVA || {};
  SCIOVA.core = SCIOVA.core || {};
  var dlog = SCIOVA.core.dlog || function(){};
  var rest = SCIOVA.core.rest || function(p){ return p; };
  var unwrapSuccess = SCIOVA.core.unwrapSuccess || function(r){ return r; };

window.SCIOVA_STORE = (function () {
        var state = {
            urls: [],
            urlsFetchedAt: 0,
            settings: null,
            settingsFetchedAt: 0,
            metrics: {},        // key: urlId|maWindow (cache result payload)
            metricsFetchedAt: {}, // key: urlId|metrics -> timestamp
            psi: {},            // key: urlId|psi
            psiFetchedAt: {},   // key: urlId|psi -> timestamp
            siteSearch: {},      // key: query -> results
            siteSearchFetchedAt: {}, // key: query -> timestamp
            notes: {},           // key: urlId|range -> notes
            notesFetchedAt: {}   // key: urlId|range -> timestamp
        };

        // TTLs (ms): keeps UX snappy while still eventually refreshing.
        var TTL_URLS     = 24 * 60 * 60 * 1000; // 24 h — refreshes if tab left open overnight
        var TTL_SETTINGS = 24 * 60 * 60 * 1000; // 24 h — explicit invalidation on save
        var TTL_METRICS = 10 * 60 * 1000;   // 10 minutes (server caches longer anyway)
        var TTL_PSI = 10 * 60 * 1000;       // 10 minutes

        function now() {
            return Date.now();
        }

        function isFresh(fetchedAt, ttl) {
            return fetchedAt && (now() - fetchedAt) < ttl;
        }

        function invalidateUrls() {
            state.urlsFetchedAt = 0;
        }

        function invalidateSettings() {
            state.settingsFetchedAt = 0;
        }

        function invalidateMetrics(urlId) {
            var keys = Object.keys(state.metrics || {});
            for (var i = 0; i < keys.length; i++) {
                if (keys[i].indexOf(String(urlId) + '|') === 0) {
                    delete state.metrics[keys[i]];
                    delete state.metricsFetchedAt[keys[i]];
                }
            }
        }

        function invalidatePsi(urlId) {
            var key = String(urlId) + '|psi';
            delete state.psi[key];
            delete state.psiFetchedAt[key];
        }

        function ensureUrls() {
            if (isFresh(state.urlsFetchedAt, TTL_URLS) && Array.isArray(state.urls)) {
                dlog('[SCIOVA_STORE] URLs cache hit');
                return Promise.resolve(state.urls);
            }

            dlog('[SCIOVA_STORE] URLs cache miss -> fetching');
            return wp.apiFetch({ url: rest('/urls'), method: 'GET' })
                .then(function (res) {
                    var data = unwrapSuccess(res, 'Failed to load URLs.');
                    var list = (data && Array.isArray(data.items)) ? data.items : [];
                    state.urls = list;
                    state.urlsFetchedAt = now();
                    return list;
                });
        }

        function ensureSettings() {
            if (isFresh(state.settingsFetchedAt, TTL_SETTINGS) && state.settings) {
                dlog('[SCIOVA_STORE] Settings cache hit');
                return Promise.resolve(state.settings);
            }

            dlog('[SCIOVA_STORE] Settings cache miss -> fetching');
            return wp.apiFetch({ url: rest('/settings'), method: 'GET' })
                .then(function (res) {
                    var data = unwrapSuccess(res, 'Failed to load settings.');
                    state.settings = data || null;
                    state.settingsFetchedAt = now();
                    return state.settings;
                });
        }

        /**
         * Fetch CrUX metrics for a URL.
         *
         * Backend contract (Step 5 MVP):
         * GET /metrics?url_id=123 => { success:true, data:{ periods, raw, ma:{5,10}, classification:{5,10}, last_updated } }
         *
         * @param {number} urlId
         * @returns {Promise<Object>}
         */
        function ensureMetrics(urlId) {
            var key = String(urlId) + '|metrics';
            var fetchedAt = state.metricsFetchedAt[key] || 0;

            if (state.metrics[key] && isFresh(fetchedAt, TTL_METRICS)) {
                dlog('[SCIOVA_STORE] Metrics cache hit', key);
                return Promise.resolve(state.metrics[key]);
            }

            dlog('[SCIOVA_STORE] Metrics cache miss -> fetching', key);
            return wp.apiFetch({ url: rest('/metrics?url_id=' + encodeURIComponent(String(urlId))), method: 'GET' })
                .then(function (res) {
                    var data = unwrapSuccess(res, 'Failed to load metrics.');
                    state.metrics[key] = data || null;
                    state.metricsFetchedAt[key] = now();
                    return state.metrics[key];
                });
        }

        /**
         * Fetch PSI summary for a URL.
         * GET /psi?url_id=123
         *
         * @param {number} urlId
         * @returns {Promise<Object>}
         */
        function ensurePsi(urlId) {
            var key = String(urlId) + '|psi';
            var fetchedAt = state.psiFetchedAt[key] || 0;

            if (state.psi[key] && isFresh(fetchedAt, TTL_PSI)) {
                dlog('[SCIOVA_STORE] PSI cache hit', key);
                return Promise.resolve(state.psi[key]);
            }

            dlog('[SCIOVA_STORE] PSI cache miss -> fetching', key);
            return wp.apiFetch({ url: rest('/psi?url_id=' + encodeURIComponent(String(urlId))), method: 'GET' })
                .then(function (res) {
                    var data = unwrapSuccess(res, 'Failed to load PSI.');
                    state.psi[key] = data || null;
                    state.psiFetchedAt[key] = now();
                    return state.psi[key];
                });
        }

        function refreshPsi(urlId) {
            var key = String(urlId) + '|psi';
            dlog('[SCIOVA_STORE] PSI refresh -> fetching', key);
            // Force refresh: bypass both client and server caches (server supports refresh=1)
            return wp.apiFetch({ url: rest('/psi?url_id=' + encodeURIComponent(String(urlId)) + '&refresh=1'), method: 'GET' })
                .then(function (res) {
                    var data = unwrapSuccess(res, 'Failed to refresh PSI.');
                    state.psi[key] = data || null;
                    state.psiFetchedAt[key] = now();
                    return state.psi[key];
                });
        }

        function searchSite(query) {
            var q = String(query || '').trim();
            if (!q) {
                return Promise.resolve([]);
            }
            var key = q.toLowerCase();
            var fetchedAt = state.siteSearchFetchedAt[key] || 0;

            // Short cache to avoid hammering WP query while typing.
            if (Array.isArray(state.siteSearch[key]) && isFresh(fetchedAt, 30 * 1000)) {
                return Promise.resolve(state.siteSearch[key]);
            }

            return wp.apiFetch({ url: rest('/site-search?q=' + encodeURIComponent(q)), method: 'GET' })
                .then(function (res) {
                    var data = unwrapSuccess(res, 'Failed to search site content.');
                    var items = (data && Array.isArray(data.items)) ? data.items : [];
                    state.siteSearch[key] = items;
                    state.siteSearchFetchedAt[key] = now();
                    return items;
                });
        }

        function ensureNotes(urlId, fromDate, toDate) {
            var uid = (urlId === null || typeof urlId === 'undefined') ? 'site' : String(urlId);
            var from = String(fromDate || '');
            var to = String(toDate || '');
            var rangeKey = uid + '|' + from + '|' + to;
            var fetchedAt = state.notesFetchedAt[rangeKey] || 0;

            if (Array.isArray(state.notes[rangeKey]) && isFresh(fetchedAt, 30 * 1000)) {
                return Promise.resolve(state.notes[rangeKey]);
            }

            var qs = 'from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to);
            if (uid !== 'site') {
                qs = 'url_id=' + encodeURIComponent(uid) + '&' + qs;
            }

            return wp.apiFetch({ url: rest('/notes?' + qs), method: 'GET' })
                .then(function (res) {
                    var data = unwrapSuccess(res, 'Failed to load notes.');
                    var items = (data && Array.isArray(data.items)) ? data.items : [];
                    state.notes[rangeKey] = items;
                    state.notesFetchedAt[rangeKey] = now();
                    return items;
                });
        }

        function addNote(payload) {
            return wp.apiFetch({ url: rest('/notes'), method: 'POST', data: payload })
                .then(function (res) {
                    var data = unwrapSuccess(res, 'Failed to add note.');
                    // Invalidate all notes caches (simple + safe for MVP).
                    state.notes = {};
                    state.notesFetchedAt = {};
                    return data;
                });
        }

        function deleteNote(noteId) {
            return wp.apiFetch({ url: rest('/notes/' + encodeURIComponent(noteId)), method: 'DELETE' })
                .then(function (res) {
                    var data = unwrapSuccess(res, 'Failed to delete note.');
                    state.notes = {};
                    state.notesFetchedAt = {};
                    return data;
                });
        }

        function testKeys() {
            return wp.apiFetch({ url: rest('/settings/test'), method: 'GET' });
        }

        function setSettings(next) {
            state.settings = next || null;
            state.settingsFetchedAt = now();
        }

        function setUrls(next) {
            state.urls = Array.isArray(next) ? next : [];
            state.urlsFetchedAt = now();
        }

        function getState() {
            return state;
        }

        return {
            getState: getState,
            ensureUrls: ensureUrls,
            ensureSettings: ensureSettings,
            ensureMetrics: ensureMetrics,
            ensurePsi: ensurePsi,
            refreshPsi: refreshPsi,
            searchSite: searchSite,
            ensureNotes: ensureNotes,
            addNote: addNote,
            deleteNote: deleteNote,
            invalidateUrls: invalidateUrls,
            invalidateSettings: invalidateSettings,
            invalidateMetrics: invalidateMetrics,
            invalidatePsi: invalidatePsi,
            setSettings: setSettings,
            setUrls: setUrls,
            testKeys: testKeys
        };
    })()
  SCIOVA.store = window.SCIOVA_STORE;
})();
