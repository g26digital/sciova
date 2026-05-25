(function () {
  'use strict';
  if (!window.wp || !wp.element) return;

  window.SCIOVA = window.SCIOVA || {};
  SCIOVA.React = SCIOVA.React || {};

  var el = (SCIOVA.React.el) ? SCIOVA.React.el : wp.element.createElement;
  var useEffect = SCIOVA.React.useEffect || wp.element.useEffect;
  var useRef = SCIOVA.React.useRef || wp.element.useRef;
  var useState = SCIOVA.React.useState || wp.element.useState;

  var PAGE_SIZE = 5;

  function nowLocalDatetime() {
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function datetimeLocalToYmd(dt) {
    return dt ? String(dt).slice(0, 10) : '';
  }

  function NotesPanel(props) {
    var selectedUrl = (props && props.selectedUrl) ? props.selectedUrl : null;
    var selectedId = selectedUrl ? selectedUrl.id : null;

    var store = (SCIOVA && SCIOVA.store) ? SCIOVA.store : window.SCIOVA_STORE;
    var utils = (SCIOVA && SCIOVA.utils) ? SCIOVA.utils : null;

    function ymdToday() {
      try { return utils && utils.todayYmd ? utils.todayYmd() : new Date().toISOString().slice(0, 10); } catch (e) { return new Date().toISOString().slice(0, 10); }
    }
    function ymdDaysAgo(days) {
      try { return utils && utils.daysAgoYmd ? utils.daysAgoYmd(days) : ymdToday(); } catch (e) { return ymdToday(); }
    }

    var _a = useState(ymdDaysAgo(30)), fromDate = _a[0], setFromDate = _a[1];
    var _b = useState(ymdToday()), toDate = _b[0], setToDate = _b[1];
    var _c = useState(nowLocalDatetime()), noteDateTime = _c[0], setNoteDateTime = _c[1];
    var _d = useState(''), noteText = _d[0], setNoteText = _d[1];
    var _e = useState(false), siteWide = _e[0], setSiteWide = _e[1];
    var _f = useState([]), notes = _f[0], setNotes = _f[1];
    var _g = useState(false), loading = _g[0], setLoading = _g[1];
    var _h = useState(''), error = _h[0], setError = _h[1];
    var _i = useState(false), isModalOpen = _i[0], setModalOpen = _i[1];
    var _j = useState(1), page = _j[0], setPage = _j[1];
    // Modal-level success message (for add)
    var _k = useState(''), modalSuccess = _k[0], setModalSuccess = _k[1];
    // Per-note delete flash: { [id]: message }
    var _l = useState({}), deleteFlash = _l[0], setDeleteFlash = _l[1];

    function getErr(err, fallback) {
      if (utils && utils.getErrorMessage) return utils.getErrorMessage(err) || (fallback || 'Request failed.');
      return (err && err.message) ? err.message : (fallback || 'Request failed.');
    }

    function fmtWhen(n) {
      var ts = n && n.created_at ? n.created_at : '';
      if (ts && utils && utils.formatDatetime) return utils.formatDatetime(ts);
      var when = n && n.note_date ? n.note_date : '';
      if (when && ts) {
        var timePart = String(ts).split(' ')[1] || '';
        return when + (timePart ? (' ' + timePart) : '');
      }
      return when || '';
    }

    function refresh(overrideFrom, overrideTo) {
      setError('');
      setLoading(true);

      if (!store || typeof store.ensureNotes !== 'function') {
        setError('Notes are unavailable (store not ready).');
        setLoading(false);
        setNotes([]);
        return Promise.resolve([]);
      }

      var from = overrideFrom || fromDate;
      var to   = overrideTo   || toDate;

      return store.ensureNotes(selectedId, from, to)
        .then(function (items) {
          var arr = Array.isArray(items) ? items : [];
          setNotes(arr);
          setPage(1);
          return arr;
        })
        .catch(function (err) {
          setError(getErr(err, 'Failed to load notes.'));
          setNotes([]);
          return [];
        })
        .finally(function () {
          setLoading(false);
        });
    }

    var readyFiredRef = useRef(false);

    function signalReady() {
      if (!readyFiredRef.current) {
        readyFiredRef.current = true;
        if (typeof props.onReady === 'function') props.onReady();
      }
    }

    useEffect(function () {
      refresh().then(signalReady, signalReady);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId, fromDate, toDate]);

    function openModal() {
      setNoteDateTime(nowLocalDatetime());
      setNoteText('');
      setError('');
      setModalSuccess('');
      setModalOpen(true);
    }

    function onAdd() {
      setError('');
      setModalSuccess('');

      var text = (noteText || '').trim();
      if (!text) { setError('Please enter a note.'); return; }
      if (!store || typeof store.addNote !== 'function') { setError('Add note is unavailable.'); return; }

      var noteDate = datetimeLocalToYmd(noteDateTime || nowLocalDatetime());
      var payload = { note_date: noteDate, content: text };
      if (!siteWide && selectedId) payload.url_id = selectedId;

      setLoading(true);
      store.addNote(payload)
        .then(function () {
          setNoteText('');
          setModalSuccess('Note added successfully.');
          // Expand filter window if needed
          var effectiveFrom = noteDate < fromDate ? noteDate : fromDate;
          var effectiveTo   = noteDate > toDate   ? noteDate : toDate;
          if (effectiveFrom !== fromDate) setFromDate(effectiveFrom);
          if (effectiveTo   !== toDate)   setToDate(effectiveTo);
          refresh(effectiveFrom, effectiveTo);
          // Auto-close modal after 2s
          setTimeout(function () { setModalOpen(false); setModalSuccess(''); }, 2000);
        })
        .catch(function (err) {
          setError(getErr(err, 'Failed to add note.'));
        })
        .finally(function () {
          setLoading(false);
        });
    }

    function onDelete(id) {
      if (!confirm('Delete this note?')) return;
      if (!store || typeof store.deleteNote !== 'function') return;

      setLoading(true);
      store.deleteNote(id)
        .then(function () {
          // Flash the deleted note's row briefly before it disappears
          setDeleteFlash(function (prev) {
            var next = Object.assign({}, prev);
            next[id] = 'Deleted.';
            return next;
          });
          setTimeout(function () {
            setDeleteFlash(function (prev) {
              var next = Object.assign({}, prev);
              delete next[id];
              return next;
            });
            refresh();
          }, 800);
        })
        .catch(function (err) {
          setError(getErr(err, 'Failed to delete note.'));
          setLoading(false);
        });
    }

    // Pagination
    var totalPages = Math.max(1, Math.ceil(notes.length / PAGE_SIZE));
    var safePage = Math.min(page, totalPages);
    var pageNotes = notes.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    return el('div', { className: 'g26-card' },

      el('div', { className: 'g26-card__header' },
        el('div', null,
          el('h3', null, 'Notes'),
          el('small', null, 'Log deployments and site changes to explain performance shifts.')
        ),
        el('div', { className: 'g26-card__actions' },
          el('button', {
            className: 'button button-primary',
            onClick: openModal,
            disabled: loading
          }, 'Add Note')
        )
      ),

      el('div', { className: 'g26-card__body' },

        error ? el('div', { className: 'g26-error' }, error) : null,

        el('div', { className: 'g26-field--inline' },
          el('label', null, 'From'),
          el('input', { type: 'date', className: 'g26-input', value: fromDate, onChange: function (e) { setFromDate(e.target.value); } }),
          el('label', null, 'To'),
          el('input', { type: 'date', className: 'g26-input', value: toDate, onChange: function (e) { setToDate(e.target.value); } })
        ),

        loading && !notes.length ? el('p', null, 'Loading…') : null,

        (!notes || !notes.length) && !loading
          ? el('div', { className: 'g26-empty' }, el('small', null, 'No notes yet.'))
          : null,

        pageNotes.length
          ? pageNotes.map(function (n) {
              var isDeleting = !!deleteFlash[n.id];
              return el('div', {
                key: n.id,
                className: 'g26-box' + (isDeleting ? ' g26-box--deleting' : '')
              },
                el('small', { className: 'g26-muted' }, fmtWhen(n)),
                isDeleting
                  ? el('div', { className: 'g26-note-deleted-flash' }, 'Note deleted.')
                  : el('div', { style: { marginTop: '4px' } }, n.content || ''),
                !isDeleting
                  ? el('div', { className: 'g26-flex-between', style: { marginTop: '8px' } },
                      el('span', null),
                      el('button', { className: 'button button-small', onClick: function () { onDelete(n.id); } }, 'Delete')
                    )
                  : null
              );
            })
          : null,

        notes.length > PAGE_SIZE
          ? el('div', { className: 'g26-notes-pagination' },
              el('button', { className: 'button', disabled: safePage <= 1, onClick: function () { setPage(safePage - 1); } }, '← Prev'),
              el('span', null, 'Page ' + safePage + ' of ' + totalPages),
              el('button', { className: 'button', disabled: safePage >= totalPages, onClick: function () { setPage(safePage + 1); } }, 'Next →')
            )
          : null
      ),

      isModalOpen ? el('div', {
        className: 'g26-modalBackdrop',
        onClick: function (e) { if (e && e.target === e.currentTarget) setModalOpen(false); }
      },
        el('div', { className: 'g26-modal' },
          el('div', { className: 'g26-card' },

            el('div', { className: 'g26-card__header' },
              el('h3', null, 'Add note'),
              el('div', { className: 'g26-card__actions' },
                el('button', { className: 'button', onClick: function () { setModalOpen(false); }, 'aria-label': 'Close' }, 'Close')
              )
            ),

            el('div', { className: 'g26-card__body' },

              modalSuccess
                ? el('div', { className: 'g26-note-add-success' }, modalSuccess)
                : null,

              !modalSuccess ? el('div', { className: 'g26-field' },
                el('label', null, 'Date & Time'),
                el('input', {
                  type: 'datetime-local',
                  className: 'g26-input',
                  value: noteDateTime,
                  onChange: function (e) { setNoteDateTime(e.target.value); }
                })
              ) : null,

              !modalSuccess ? el('div', { className: 'g26-field' },
                el('label', null,
                  el('input', {
                    type: 'checkbox',
                    checked: siteWide || !selectedId,
                    onChange: function (e) { setSiteWide(!!e.target.checked); }
                  }),
                  ' Site-wide'
                )
              ) : null,

              !modalSuccess ? el('div', { className: 'g26-field' },
                el('label', null, 'Note'),
                el('textarea', {
                  className: 'g26-input',
                  rows: 4,
                  placeholder: 'e.g., Deployed caching changes…',
                  value: noteText,
                  onChange: function (e) { setNoteText(e.target.value); }
                })
              ) : null,

              error ? el('div', { className: 'g26-error' }, error) : null,

              !modalSuccess
                ? el('div', { className: 'g26-flex-between' },
                    el('button', { className: 'button', onClick: function () { setModalOpen(false); } }, 'Cancel'),
                    el('button', {
                      className: 'button button-primary',
                      onClick: onAdd,
                      disabled: loading
                    }, loading ? 'Saving…' : 'Add')
                  )
                : null
            )
          )
        )
      ) : null
    );
  }

  SCIOVA.panels = SCIOVA.panels || {};
  SCIOVA.panels.NotesPanel = NotesPanel;
})();
