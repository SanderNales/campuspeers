/* Hash router, flow guards and click handling. No build step, no dependencies. */
(function () {
  var app = document.getElementById('app');
  var state = { query: '' };   // small UI state that survives re-renders
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* [pattern, view(match), event to log on entry, optional onEnter(match)] */
  var routes = [
    [/^\/consent$/, function () { return Views.consent(); }, 'view_consent'],
    [/^\/screening$/, function () { return Views.screening(); }, 'view_screening'],
    [/^\/?$/, function () { return Views.home(state); }, 'view_course_pick'],
    [/^\/help\/([\w-]+)$/, function (m) { return Views.help(m[1]); }, 'view_help', function (m) { onViewHelp(m[1]); }],
    [/^\/free\/([\w-]+)$/, function (m) { return Views.free(m[1]); }, 'view_free'],
    [/^\/pilot$/, function () { return Views.pilot(); }, 'view_fake_door'],
    [/^\/questions$/, function () { return Views.questions(); }, 'view_questions'],
    [/^\/debrief$/, function () { return Views.debrief(); }, 'view_debrief'],
    [/^\/results$/, function () { return Views.results(); }]
  ];

  function path() { return location.hash.replace(/^#/, '') || '/'; }
  function go(href) { if (location.hash === href) render(false); else location.hash = href; }
  function redirect(p) { location.replace('#' + p); }

  /* Where this respondent belongs right now. Forward flow only: consent > screening > course > help > outcome > questions > debrief. */
  function resume(r) {
    if (!r.consent_at) return '/consent';
    if (r.screened_out || r.q1 !== 'yes' || !r.q2 || !r.q2_year) return '/screening';
    if (r.completed) return '/debrief';
    if (r.option_chosen) return '/questions';
    return '/';
  }

  /* Returns a path to redirect to, or null if the respondent may view `p`. */
  function guard(p) {
    var r = Store.rec(), m;
    if (p === '/results') return null;
    var target = resume(r);
    if (p === '/consent') return r.consent_at ? target : null;
    if (p === '/screening') return (!r.consent_at || target !== '/screening') ? target : null;
    if (p === '/' || /^\/help\//.test(p)) return target === '/' ? null : target;
    if ((m = p.match(/^\/free\/([\w-]+)$/))) return (target === '/questions' && r.option_chosen === m[1] && !r.option_is_paid) ? null : target;
    if (p === '/pilot') return (target === '/questions' && r.option_is_paid && r.click_pay && r.variant === 'A' && !r.email_given) ? null : target;
    if (p === '/questions') return target === '/questions' ? null : target;
    if (p === '/debrief') return target === '/debrief' ? null : target;
    return null;
  }

  function onViewHelp(courseId) {
    var r = Store.rec();
    // restart the choice timer when the help screen is (re)opened for a course
    Store.update({ course: courseId, help_view_time: Store.now() });
  }

  function render(trackView) {
    var p = path(), view = null, ev = null, onEnter = null, m;
    var to = guard(p);
    if (to && to !== p) { redirect(to); return; }
    for (var i = 0; i < routes.length; i++) {
      if ((m = p.match(routes[i][0]))) { view = routes[i][1](m); ev = routes[i][2]; onEnter = routes[i][3] && function () { routes[i][3](m); }; break; }
    }
    view = view || Views.notFound();
    var brand = '<span class="brand">Campus<span>Peers</span></span>';
    var top = view.back
      ? '<a class="toplink" href="' + view.back.href + '">‹ ' + esc(view.back.label) + '</a>' + brand
      : brand;
    app.innerHTML = '<div class="topbar">' + top + '</div><div class="content">' + view.content + '</div>' +
      (view.footer ? '<div class="footer">' + view.footer + '</div>' : '');
    app.querySelector('.content').scrollTop = 0;
    if (trackView !== false) {
      if (onEnter) onEnter();
      if (ev) Store.track(ev, p.indexOf('/help/') === 0 ? { course: Store.rec().course } : {});
    }
    syncButtons();
  }

  /* Enable/disable Continue-type buttons and mark selected rows, based on the current inputs. */
  function syncButtons() {
    var box = document.getElementById('consent-box');
    if (box) document.getElementById('consent-btn').disabled = !box.checked;
    app.querySelectorAll('.choices').forEach(function (g) {
      g.querySelectorAll('.choice').forEach(function (l) { l.classList.toggle('selected', l.querySelector('input').checked); });
    });
    var next = app.querySelector('[data-action="answer-next"]');
    if (next) next.disabled = !app.querySelector('.choices input:checked');
    var q1 = app.querySelector('[data-action="screen-q1"]');
    if (q1) q1.disabled = !app.querySelector('.choices input:checked');
  }

  function checked(name) {
    return [].map.call(app.querySelectorAll('input[name="' + name + '"]:checked'), function (i) { return i.value; });
  }

  function download(name, rows) {
    if (!rows.length) { alert('Nothing to export yet.'); return; }
    var cols = [];
    rows.forEach(function (r) { Object.keys(r).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); }); });
    var csv = [cols.join(',')].concat(rows.map(function (r) {
      return cols.map(function (c) {
        var v = r[c]; if (Array.isArray(v)) v = v.join('; ');
        return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      }).join(',');
    })).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = name;
    a.click();
  }

  var actions = {
    'consent-continue': function () {
      if (!document.getElementById('consent-box').checked) return;
      Store.giveConsent();
      go('#/screening');
    },
    'screen-q1': function () {
      var v = checked('q1')[0];
      if (!v) return;
      var patch = { q1: v, screened_at: Store.now() };
      if (v === 'no') { patch.screened_out = true; Store.track('screened_out'); }
      Store.update(patch);
      render(false);
    },
    'screen-q2': function () {
      var prog = document.getElementById('programme').value.trim(), year = document.getElementById('year').value;
      if (!prog || !year) { document.getElementById('screenerr').textContent = 'Please fill in both fields.'; return; }
      Store.update({ q2: prog, q2_year: year });
      Store.track('answer_screening');
      go('#/');
    },
    'select-course': function (el) { Store.update({ course: el.dataset.id }); render(false); },
    'to-help': function () { var c = Store.rec().course; if (c) go('#/help/' + c); },
    'choose-option': function (el) {
      var r = Store.rec(), id = el.dataset.id, paid = id === PAID_OPTION.id && r.variant === 'A';
      var t0 = r.help_view_time ? Date.parse(r.help_view_time) : NaN;
      Store.update({
        option_chosen: id, option_is_paid: paid, chosen_at: Store.now(),
        ms_to_choice: isNaN(t0) ? null : Date.now() - t0, click_pay: paid
      });
      Store.track('select_option', { option: id, paid: paid });
      if (paid) { Store.track('click_pay', { option: id }); go('#/pilot'); }
      else go('#/free/' + id);
    },
    'notify': function () {
      var input = document.getElementById('email'), err = document.getElementById('emailerr');
      var email = input.value.trim();
      if (!EMAIL.test(email)) { input.classList.add('error'); err.textContent = 'Please enter a valid email address.'; input.focus(); return; }
      Store.update({ email: email, email_given: true });
      Store.track('submit_email');
      go('#/questions');
    },
    'skip-email': function () { Store.track('skip_email'); go('#/questions'); },
    'answer-next': function (el) {
      var step = el.dataset.step, vals = checked(step);
      if (!vals.length) return;
      var patch = {};
      patch[step] = step === 'q4' ? Number(vals[0]) : step === 'q5' ? vals[0] : vals;
      Store.track('answer_' + step, { answer: patch[step] });
      if (step === 'q6') { patch.completed = true; patch.completed_at = Store.now(); }
      Store.update(patch);
      if (step === 'q6') go('#/debrief'); else render(false);
    },
    'go': function (el) { go(el.dataset.href); },
    'new-visitor': function (el) { Store.startVisitor(el.dataset.v); state = { query: '' }; go('#/consent'); },
    'export': function (el) {
      if (el.dataset.what === 'events') download('campuspeers-events.csv', Store.events());
      else download('campuspeers-respondents.csv', Store.responses());
    },
    'reset': function () { Store.reset(); render(false); }
  };

  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (el && !el.disabled && actions[el.dataset.action]) actions[el.dataset.action](el);
  });

  app.addEventListener('change', function (e) {
    var t = e.target;
    if (t.type === 'checkbox' && t.name === 'q6') {            // "Did nothing" excludes the other answers
      var ex = QUESTIONS.q6.exclusive;
      app.querySelectorAll('input[name="q6"]').forEach(function (i) {
        if (t.value === ex && t.checked && i !== t) i.checked = false;
        else if (t.value !== ex && t.checked && i.value === ex) i.checked = false;
      });
    }
    syncButtons();
  });

  // Live search on the course screen: re-render and keep the cursor in the field.
  app.addEventListener('input', function (e) {
    if (e.target.id === 'search') {
      state.query = e.target.value;
      var c = Store.rec().course, q = state.query.trim().toLowerCase();
      var visible = COURSES.some(function (x) { return x.id === c && (x.name + ' ' + x.topics).toLowerCase().indexOf(q) !== -1; });
      if (!visible) Store.update({ course: null });
      render(false);
      var s = document.getElementById('search');
      s.focus(); s.setSelectionRange(s.value.length, s.value.length);
    } else if (e.target.id === 'email') {
      e.target.classList.remove('error');
      document.getElementById('emailerr').textContent = '';
    }
  });
  app.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'email') { var b = app.querySelector('.footer .btn'); if (b) b.click(); }
  });

  window.addEventListener('hashchange', function () { render(); });
  Store.init();
  render();
})();
