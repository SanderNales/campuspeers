/* One function per screen. Each returns { back, content, footer } as HTML strings.
   Clicks are wired through data-action attributes, handled in app.js.
   Only Views.help differs between version A and B. */

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function courseById(id) { return COURSES.filter(function (c) { return c.id === id; })[0]; }

var ICON = {
  search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2f5be7" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  check: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2f5be7" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  info: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2f5be7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
};

/* Radio / checkbox rows. `selected` is a value or an array of values. */
function choices(name, type, items, selected) {
  var sel = [].concat(selected == null ? [] : selected).map(String);
  return '<div class="choices" data-name="' + name + '">' + items.map(function (it) {
    var value = typeof it === 'object' ? it.value : it, label = typeof it === 'object' ? it.label : it;
    var on = sel.indexOf(String(value)) !== -1;
    return '<label class="choice' + (on ? ' selected' : '') + '"><input type="' + type + '" name="' + name + '" value="' + esc(value) + '"' +
      (on ? ' checked' : '') + '><span>' + esc(label) + '</span></label>';
  }).join('') + '</div>';
}

var Views = {};

/* 0 – Consent */
Views.consent = function () {
  var c = COPY.consent;
  return {
    back: null,
    content: '<h1>' + esc(c.title) + '</h1><p class="muted">' + esc(c.intro) + '</p>' +
      c.sections.map(function (s) { return '<div class="label">' + esc(s[0]) + '</div><p>' + esc(s[1]) + '</p>'; }).join('') +
      '<label class="choice consent"><input type="checkbox" id="consent-box"><span>' + esc(c.checkbox) + '</span></label>',
    footer: '<button class="btn" id="consent-btn" data-action="consent-continue" disabled>' + esc(c.button) + '</button>'
  };
};

/* 1 – Screening: Q1 (difficult course?), then Q2 (programme + year). "No" ends the study. */
Views.screening = function () {
  var r = Store.rec(), s = COPY.screening;
  if (r.screened_out) {
    return { back: null, content: '<div class="hero-icon">' + ICON.check + '</div><h1 class="center">' + esc(s.endTitle) + '</h1><p class="center muted">' + esc(s.endText) + '</p>', footer: '' };
  }
  if (r.q1 !== 'yes') {
    return {
      back: null,
      content: '<h1>' + esc(s.q1) + '</h1>' + choices('q1', 'radio', [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], r.q1),
      footer: '<button class="btn" data-action="screen-q1" disabled>Continue</button>'
    };
  }
  return {
    back: null,
    content: '<h1>' + esc(s.q2Programme) + '</h1>' +
      '<input class="input" id="programme" type="text" autocomplete="off" placeholder="e.g. Computer Science" value="' + esc(r.q2 || '') + '">' +
      '<div class="label">' + esc(s.q2Year) + '</div>' +
      '<select class="input" id="year"><option value="">Select…</option>' + YEARS.map(function (y) {
        return '<option' + (r.q2_year === y ? ' selected' : '') + '>' + esc(y) + '</option>'; }).join('') + '</select>' +
      '<div class="errmsg" id="screenerr"></div>',
    footer: '<button class="btn" data-action="screen-q2">Continue</button>'
  };
};

/* 2 – Pick your course (same in A and B). No mention of tutors or prices. */
Views.home = function (state) {
  var r = Store.rec(), q = (state.query || '').trim().toLowerCase();
  var list = COURSES.filter(function (c) { return !q || (c.name + ' ' + c.topics).toLowerCase().indexOf(q) !== -1; });
  var cards = list.map(function (c) {
    return '<button class="card' + (r.course === c.id ? ' selected' : '') + '" data-action="select-course" data-id="' + c.id + '">' +
      '<span><b>' + esc(c.name) + '</b><span class="sub">' + esc(c.topics) + '</span></span></button>';
  }).join('');
  return {
    back: null,
    content:
      '<h1>Which course are you stuck on?</h1>' +
      '<div class="search">' + ICON.search + '<input class="input" id="search" type="search" placeholder="Search your course" value="' + esc(state.query || '') + '" autocomplete="off"></div>' +
      '<div class="label">Courses this quarter</div>' +
      '<div id="courselist">' + (cards || '<div class="empty">No course found. Try another name.</div>') + '</div>',
    footer: '<button class="btn" data-action="to-help"' + (r.course && courseById(r.course) ? '' : ' disabled') + '>Continue</button>'
  };
};

/* 3 – THE HELP SCREEN. The only screen that differs: version A has one extra (paid) card at a fixed position. */
Views.help = function (id) {
  var c = courseById(id);
  if (!c) return Views.notFound();
  var options = FREE_OPTIONS.map(function (o) {
    return { id: o.id, title: o.title, price: o.price, when: o.when || c[o.whenKey], note: o.note, button: 'Choose this' };
  });
  if (Store.variant() === 'A') options.splice(PAID_OPTION.position, 0, PAID_OPTION);

  var cards = options.map(function (o) {
    return '<div class="card opt"><div class="opt-top"><span><b>' + esc(o.title) + '</b>' +
      '<span class="sub">' + esc(o.when) + '</span>' + (o.note ? '<span class="sub">' + esc(o.note) + '</span>' : '') + '</span>' +
      '<span class="badge neutral">' + esc(o.price) + '</span></div>' +
      '<button class="btn small ghost" data-action="choose-option" data-id="' + o.id + '">' + esc(o.button) + '</button></div>';
  }).join('');
  return {
    back: { label: 'Courses', href: '#/' },
    content: '<h1>Stuck on ' + esc(c.name) + '? Exam in ' + CONFIG.examInDays + ' days.</h1>' + cards,
    footer: ''
  };
};

/* 3b – Short confirmation after a free option (same in A and B) */
Views.free = function (optId) {
  var o = FREE_OPTIONS.filter(function (f) { return f.id === optId; })[0];
  if (!o) return Views.notFound();
  return {
    back: null,
    content: '<div class="hero-icon">' + ICON.check + '</div><h1 class="center">' + esc(COPY.free.title) + '</h1>' +
      '<p class="center muted">' + esc(COPY.free.text) + '</p>' +
      '<div class="summary"><b>' + esc(o.title) + '</b></div>',
    footer: '<button class="btn" data-action="go" data-href="#/questions">' + esc(COPY.free.button) + '</button>'
  };
};

/* 4 – Fake door, reached only by tapping the paid card (A only). Honest copy. */
Views.pilot = function () {
  var p = COPY.pilot;
  return {
    back: null,
    content:
      '<div class="hero-icon">' + ICON.info + '</div>' +
      '<h1 class="center">' + esc(p.title) + '</h1>' +
      '<p class="center muted">' + esc(p.lead) + '</p>' +
      '<p>' + esc(p.emailIntro) + '</p>' +
      '<input class="input" id="email" type="email" inputmode="email" autocomplete="email" placeholder="' + esc(p.placeholder) + '">' +
      '<div class="errmsg" id="emailerr"></div>',
    footer: '<button class="btn" data-action="notify">' + esc(p.button) + '</button>' +
      '<button class="btn ghost" style="margin-top:8px" data-action="skip-email">' + esc(p.skip) + '</button>'
  };
};

/* 5 – Closing questions, one at a time (Q4, Q5, Q6) so later answer options cannot influence earlier answers. */
Views.questions = function () {
  var r = Store.rec();
  var step = r.q4 == null ? 'q4' : r.q5 == null ? 'q5' : 'q6';
  var n = { q4: 1, q5: 2, q6: 3 }[step], q = QUESTIONS[step];
  var body;
  if (step === 'q4') body = choices('q4', 'radio', q.options.map(function (l, i) { return { value: i + 1, label: l }; }));
  else if (step === 'q5') body = choices('q5', 'radio', q.options);
  else body = choices('q6', 'checkbox', q.options);
  return {
    back: null,
    content: '<div class="label">Question ' + n + ' of 3</div><h1>' + esc(q.text) + '</h1>' + body,
    footer: '<button class="btn" data-action="answer-next" data-step="' + step + '" disabled>' + (step === 'q6' ? 'Finish' : 'Next') + '</button>'
  };
};

/* 6 – Debrief */
Views.debrief = function () {
  var d = COPY.debrief, r = Store.rec();
  return {
    back: null,
    content: '<div class="hero-icon">' + ICON.check + '</div><h1 class="center">' + esc(d.title) + '</h1>' +
      d.paragraphs.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
      '<div class="summary">Your participation code: <b>' + esc(r.session) + '</b></div>',
    footer: ''
  };
};

/* Team-only: numbers per version. Reached only by typing #/results. */
Views.results = function () {
  var all = Store.responses(), S = CONFIG.smart;
  var OPTS = FREE_OPTIONS.map(function (o) { return { id: o.id, label: o.title, free: true }; });
  OPTS.splice(PAID_OPTION.position, 0, { id: PAID_OPTION.id, label: 'Paid peer-tutor card', free: false });

  function stats(v) {
    var rs = all.filter(function (r) { return r.variant === v; });
    var choosers = rs.filter(function (r) { return r.option_chosen; });
    function count(list, key, val) { return list.filter(function (r) { return r[key] === val; }).length; }
    var q4 = rs.filter(function (r) { return r.q4 != null; }), q5 = rs.filter(function (r) { return r.q5 != null; }), q6 = rs.filter(function (r) { return r.q6; });
    return {
      started: rs.length, out: count(rs, 'screened_out', true), done: count(rs, 'completed', true),
      N: choosers.length, free: choosers.filter(function (r) { return !r.option_is_paid; }).length,
      pay: count(rs, 'click_pay', true), email: count(rs, 'email_given', true),
      opt: function (id) { return count(choosers, 'option_chosen', id); },
      q4: q4, q5: q5, q6: q6
    };
  }
  var D = { A: stats('A'), B: stats('B') };
  function pct(k, n) { return n ? Math.round(100 * k / n) : null; }
  function kn(k, n) { return '<b>' + k + '</b> of ' + n + (n ? ' <span class="pct">(' + pct(k, n) + '%)</span>' : ''); }

  var warn = ['A', 'B'].filter(function (v) { return D[v].done < S.minPerVersion; });
  var warning = warn.length
    ? '<div class="warn">Fewer than ' + S.minPerVersion + ' completed respondents in version ' + warn.join(' and ') + ' (A: ' + D.A.done + ', B: ' + D.B.done + '). Do not draw conclusions yet.</div>' : '';

  var counts = '<table><tr><th></th><th>A</th><th>B</th></tr>' +
    ['started', 'out', 'done'].map(function (k, i) {
      return '<tr><td>' + ['Started (passed consent)', 'Screened out', 'Completed'][i] + '</td><td>' + D.A[k] + '</td><td>' + D.B[k] + '</td></tr>';
    }).join('') + '</table>';

  var optRows = OPTS.map(function (o) {
    return '<tr><td>' + esc(o.label) + '</td><td>' + kn(D.A.opt(o.id), D.A.N) + '</td><td>' +
      (o.free ? kn(D.B.opt(o.id), D.B.N) : '<span class="muted">not shown</span>') + '</td></tr>';
  }).join('') + '<tr class="hit"><td>Any free option</td><td>' + kn(D.A.free, D.A.N) + '</td><td>' + kn(D.B.free, D.B.N) + '</td></tr>';
  var choice = '<div class="label">Option chosen (N = respondents who chose an option)</div><table><tr><th></th><th>A (N=' + D.A.N + ')</th><th>B (N=' + D.B.N + ')</th></tr>' + optRows + '</table>' +
    '<p class="muted small">Free-option share: A ' + (pct(D.A.free, D.A.N) == null ? '–' : pct(D.A.free, D.A.N) + '%') + ' vs B ' + (pct(D.B.free, D.B.N) == null ? '–' : pct(D.B.free, D.B.N) + '%') +
    '. B is 100% by construction; what matters is how much of A’s choices go to the paid card.</p>';

  var paid = '<div class="label">Version A only</div><table>' +
    '<tr><td>“Book &amp; pay” taps</td><td>' + kn(D.A.pay, D.A.N) + '</td></tr>' +
    '<tr><td>Emails left</td><td>' + kn(D.A.email, D.A.N) + '</td></tr></table>';

  function dist(title, key, labels, valueOf, multi) {
    var rows = labels.map(function (l, i) {
      function c(v) { return D[v][key].filter(function (r) { var x = valueOf(r); return multi ? x.indexOf(l) !== -1 : x === i + 1 || x === l; }).length; }
      return '<tr><td>' + esc(l) + '</td><td>' + kn(c('A'), D.A[key].length) + '</td><td>' + kn(c('B'), D.B[key].length) + '</td></tr>';
    }).join('');
    return '<div class="label">' + title + '</div><table><tr><th></th><th>A (N=' + D.A[key].length + ')</th><th>B (N=' + D.B[key].length + ')</th></tr>' + rows + '</table>';
  }
  var dists = dist('Q4 would pay (1–5)', 'q4', QUESTIONS.q4.options, function (r) { return r.q4; }) +
    dist('Q5 highest price', 'q5', QUESTIONS.q5.options, function (r) { return r.q5; }) +
    dist('Q6 last time stuck (multiple answers)', 'q6', QUESTIONS.q6.options, function (r) { return r.q6 || []; }, true);

  var set = S.minPaidTapPct != null && S.minEmailPct != null;
  var payPct = pct(D.A.pay, D.A.N) || 0, mailPct = pct(D.A.email, D.A.N) || 0;
  var met = set && D.A.N > 0 && payPct >= S.minPaidTapPct && mailPct >= S.minEmailPct;
  var smart = '<div class="label">SMART criterion</div><div class="summary">' +
    'Success if at least <b>' + (S.minPaidTapPct == null ? '[TODO X]' : S.minPaidTapPct) + '%</b> of group A tap “Book &amp; pay” and at least <b>' +
    (S.minEmailPct == null ? '[TODO Y]' : S.minEmailPct) + '%</b> leave an email, by <b>' + esc(S.deadline) + '</b>.<br>' +
    'Now: ' + payPct + '% taps, ' + mailPct + '% emails. ' +
    (!set ? '<b>Status: thresholds not set yet (edit CONFIG.smart in js/data.js).</b>' : met ? '<b class="ok">Status: met.</b>' : '<b>Status: not met.</b>') + '</div>';

  return {
    back: { label: 'Start', href: '#/' },
    content: '<h1>Study results</h1>' +
      '<p class="muted small">Team only. Numbers are from this browser; the Sheet (see docs/apps-script.md) has all respondents.</p>' + warning +
      '<div class="label">Respondents</div>' + counts + choice + paid + dists + smart +
      '<div class="label">You are now seeing version <span class="pill">' + Store.variant() + '</span></div>' +
      '<button class="btn small ghost" data-action="new-visitor" data-v="A">New visitor · A</button>' +
      '<button class="btn small ghost" data-action="new-visitor" data-v="B">New visitor · B</button>' +
      '<button class="btn small ghost" data-action="new-visitor" data-v="">New visitor · random</button>' +
      '<div class="label">Data</div>' +
      '<button class="btn small ghost" data-action="export" data-what="respondents">Export respondents (CSV)</button>' +
      '<button class="btn small ghost" data-action="export" data-what="events">Export event log (CSV)</button>' +
      '<button class="btn small danger" data-action="reset">Reset all data</button>',
    footer: ''
  };
};

Views.notFound = function () {
  return { back: { label: 'Back', href: '#/' }, content: '<div class="empty">This page does not exist.</div>', footer: '' };
};
