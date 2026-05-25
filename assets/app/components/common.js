(function () {
  'use strict';
  if (!window.wp || !wp.element) return;
  window.SCIOVA = window.SCIOVA || {};
  SCIOVA.React = SCIOVA.React || {};
  var el = (SCIOVA.React.el) ? SCIOVA.React.el : wp.element.createElement;
  var useEffect = SCIOVA.React.useEffect || wp.element.useEffect;
  var useRef = SCIOVA.React.useRef || wp.element.useRef;
  var useState = SCIOVA.React.useState || wp.element.useState;

  var settings = window.SCIOVA_SETTINGS || {};
  var store = (SCIOVA.store) ? SCIOVA.store : window.SCIOVA_STORE;
  var getErr = (SCIOVA.utils && SCIOVA.utils.getErrorMessage) ? SCIOVA.utils.getErrorMessage :
    (SCIOVA.core && SCIOVA.core.getErrorMessage) ? SCIOVA.core.getErrorMessage :
    function () { return 'Request failed.'; };


    // -----------------------------
    // UI Components
    // -----------------------------

    function AddUrlModal(props) {
    var _a = useState(''), query = _a[0], setQuery = _a[1];
    var _b = useState([]), results = _b[0], setResults = _b[1];
    var _c = useState(false), searching = _c[0], setSearching = _c[1];
    var _d = useState(''), error = _d[0], setError = _d[1];
    var _f = useState(null), selected = _f[0], setSelected = _f[1];
    var suppressSearchRef = useRef(false);

    var store = (SCIOVA && SCIOVA.store) ? SCIOVA.store : window.SCIOVA_STORE;

    function getErr(err, fallback) {
        if (SCIOVA.utils && SCIOVA.utils.getErrorMessage) return SCIOVA.utils.getErrorMessage(err) || (fallback || 'Request failed.');
        return (err && err.message) ? err.message : (fallback || 'Request failed.');
    }

    useEffect(function () {
        var q = String(query || '').trim();
        setError('');

        // Suppress re-search when query was set by selecting a result
        if (suppressSearchRef.current) {
          suppressSearchRef.current = false;
          return;
        }

        if (q.length < 2) {
        setResults([]);
        setSearching(false);
        return;
        }

        if (!store || typeof store.searchSite !== 'function') {
        setError('Search is unavailable (store.searchSite missing).');
        setResults([]);
        setSearching(false);
        return;
        }

        var cancelled = false;
        setSearching(true);

        var t = setTimeout(function () {
        Promise.resolve(store.searchSite(q))
            .then(function (items) {
            if (cancelled) return;
            setResults(Array.isArray(items) ? items : []);
            })
            .catch(function (err) {
            if (cancelled) return;
            setError(getErr(err, 'Search failed.'));
            setResults([]);
            })
            .finally(function () {
            if (cancelled) return;
            setSearching(false);
            });
        }, 200);

        return function () {
        cancelled = true;
        clearTimeout(t);
        };
    }, [query]);

    function addSelected() {
        setError('');

        if (props && props.isAtLimit) {
        setError('Free plan limit reached. Remove one to add another.');
        return;
        }

        var url = '';
        if (selected && selected.url) {
          url = String(selected.url);
        } else {
          setError('Select a page from the search results.');
          return;
        }

        if (!props || typeof props.onAdd !== 'function') {
        setError('onAdd handler missing.');
        return;
        }

        Promise.resolve(props.onAdd(url))
        .then(function () {
            if (props && typeof props.onClose === 'function') props.onClose();
        })
        .catch(function (err) {
            setError(getErr(err, 'Failed to add URL.'));
        });
    }

    // If you have a UI Modal component, you can plug it in here later.
    // For now, use a robust CSS modal overlay.
    return el('div', {
  className: 'g26-modalBackdrop',
  onClick: function (e) {
    if (e && e.target === e.currentTarget) {
      if (props && typeof props.onClose === 'function') props.onClose();
    }
  }
},
  el('div', { className: 'g26-modal' },

    el('div', { className: 'g26-card' },

      el('div', { className: 'g26-card__header' },
        el('h3', null, 'Add tracked URL'),
        el('div', { className: 'g26-card__actions' },
          el('button', {
            className: 'button',
            onClick: function () { if (props && props.onClose) props.onClose(); },
            'aria-label': 'Close'
          }, 'Close')
        )
      ),

      el('div', { className: 'g26-card__body' },

        // Search (kept, but minimal)
        el('div', { className: 'g26-field' },
          el('label', null, 'Search from site'),
          el('input', {
            type: 'search',
            className: 'g26-input',
            value: query,
            onChange: function (e) { setQuery(e.target.value); },
            placeholder: 'Type at least 2 characters…'
          })
        ),

        searching ? el('small', null, 'Searching…') : null,
        error ? el('div', { className: 'g26-error' }, error) : null,

        (results && results.length)
          ? el('div', null,
              results.slice(0, 12).map(function (item) {
                var active = selected &&
                  String(selected.id) === String(item.id) &&
                  String(selected.type) === String(item.type);

                return el('button', {
                  key: String(item.type) + ':' + String(item.id),
                  type: 'button',
                  className: 'button' + (active ? ' button-primary' : ''),
                  style: { display: 'block', width: '100%', textAlign: 'left', marginTop: '8px' },
                  onClick: function () {
                    suppressSearchRef.current = true;
                    setSelected(item);
                    setQuery(item.url || query);
                  }
                },
                  (item.title || item.url || '(Untitled)') +
                  (item.type ? (' — ' + item.type) : '')
                );
              })
            )
          : (String(query || '').trim().length >= 2 && !searching)
            ? el('small', null, 'No results.')
            : null,

        el('div', { className: 'g26-flex-between' },
          el('button', {
            className: 'button',
            onClick: function () { if (props && props.onClose) props.onClose(); }
          }, 'Cancel'),
          el('button', {
            className: 'button button-primary',
            onClick: addSelected,
            disabled: !!(props && props.isAtLimit)
          }, 'Add')
        )
      )
    )
  )
);
    }    

  SCIOVA.components = SCIOVA.components || {};
  /**
   * PageHeader
   * DOM: .g26-pageHeader -> (h1 + optional subtitle + optional right)
   */
  SCIOVA.components.PageHeader = function PageHeader(props) {
  var title       = props && props.title       ? props.title       : '';
  var subtitle    = props && props.subtitle    ? props.subtitle    : '';
  var right       = props && props.right       ? props.right       : null;
  var selectedUrl = props && props.selectedUrl ? props.selectedUrl : null;

  return el('div', { className: 'g26-header' },

    el('div', { className: 'g26-flex-between' },

      el('div', null,
        el('h1', null, title),
        subtitle ? el('small', null, subtitle) : null,
        selectedUrl
          ? el('div', { className: 'g26-header__url' },
              el('span', { className: 'g26-header__url-label' }, 'URL: '),
              el('a', {
                href: selectedUrl.url || '#',
                target: '_blank',
                rel: 'noopener noreferrer',
                className: 'g26-header__url-link',
                title: selectedUrl.url || ''
              }, selectedUrl.url || ('URL #' + selectedUrl.id))
            )
          : null
      ),

      right
        ? el('div', { className: 'g26-field--inline' }, right)
        : null
    ),
  );
};

  if (typeof AddUrlModal === 'function') SCIOVA.components.AddUrlModal = AddUrlModal;

  /**
   * UrlDropdown — custom interactive URL selector with per-item delete.
   *
   * Props: urls, selectedId, onSelect, onDelete
   */
  function UrlDropdown(props) {
    var _a = useState(false), open = _a[0], setOpen = _a[1];
    var containerRef = useRef(null);

    // Close on outside click
    useEffect(function () {
      if (!open) return;
      function onOutside(e) {
        if (containerRef.current && !containerRef.current.contains(e.target)) {
          setOpen(false);
        }
      }
      document.addEventListener('mousedown', onOutside);
      return function () { document.removeEventListener('mousedown', onOutside); };
    }, [open]);

    var urls = Array.isArray(props.urls) ? props.urls : [];
    var selectedUrl = null;
    for (var i = 0; i < urls.length; i++) {
      if (String(urls[i].id) === String(props.selectedId)) { selectedUrl = urls[i]; break; }
    }
    var triggerLabel = selectedUrl
      ? (selectedUrl.title || selectedUrl.url || 'URL #' + selectedUrl.id)
      : (urls.length === 0 ? 'No URLs tracked' : 'Select a URL');

    var selectedHealth = props.urlHealth && selectedUrl ? props.urlHealth[String(selectedUrl.id)] : null;

    return el('div', { className: 'g26-url-dropdown', ref: containerRef },

      el('button', {
        type: 'button',
        className: 'g26-url-dropdown__trigger button',
        onClick: function () { setOpen(!open); },
        disabled: urls.length === 0,
        title: selectedUrl ? (selectedUrl.url || triggerLabel) : triggerLabel
      },
        selectedHealth ? el('span', { className: 'g26-url-health-dot g26-url-health-dot--' + selectedHealth, style: { marginRight: '4px' } }) : null,
        el('span', { className: 'g26-url-dropdown__label' }, triggerLabel),
        el('span', { className: 'g26-url-dropdown__chevron' }, open ? '▲' : '▼')
      ),

      open ? el('div', { className: 'g26-url-dropdown__menu' },
        urls.map(function (u) {
          var isActive = String(u.id) === String(props.selectedId);
          var itemLabel = u.title || u.url || ('URL #' + u.id);
          var health = props.urlHealth && props.urlHealth[String(u.id)];
          return el('div', {
            key: String(u.id),
            className: 'g26-url-dropdown__item' + (isActive ? ' is-active' : '')
          },
            el('button', {
              type: 'button',
              className: 'g26-url-dropdown__item-label',
              style: { display: 'flex', alignItems: 'center', gap: '6px' },
              onClick: function () {
                if (typeof props.onSelect === 'function') props.onSelect(u.id);
                setOpen(false);
              }
            },
              health ? el('span', { className: 'g26-url-health-dot g26-url-health-dot--' + health }) : null,
              itemLabel
            ),
            el('button', {
              type: 'button',
              className: 'g26-url-dropdown__item-delete',
              title: 'Remove URL',
              onClick: function (e) {
                e.stopPropagation();
                if (confirm('Remove "' + (u.url || 'this URL') + '"?')) {
                  if (typeof props.onDelete === 'function') props.onDelete(u.id);
                  setOpen(false);
                }
              }
            }, '×')
          );
        })
      ) : null
    );
  }

  SCIOVA.components.UrlDropdown = UrlDropdown;
})();
