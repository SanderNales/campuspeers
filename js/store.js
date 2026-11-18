/* Variant assignment, one response record per respondent, event log, optional remote sync.
   localStorage is the fallback; CONFIG.trackEndpoint (if set) receives the record at every step. */

var Store = (function () {
  var K = { current: 'cp2_current', responses: 'cp2_responses', events: 'cp2_events' };

  function read(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode: ignore */ }
  }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function now() { return new Date().toISOString(); }

  function blank(variant) {
    return {
      session: newId(), variant: variant, screened_out: false, q1: null, q2: null, q2_year: null,
      course: null, help_view_time: null, option_chosen: null, option_is_paid: false, ms_to_choice: null,
      click_pay: false, email_given: false, email: '', q4: null, q5: null, q6: null, completed: false,
      created_at: now(), consent_at: null, screened_at: null, chosen_at: null, completed_at: null, updated_at: now()
    };
  }

  var cache = null;   // the current respondent's record

  function all() { return read(K.responses, {}); }
  function persist(rec) {
    var m = all(); m[rec.session] = rec; write(K.responses, m);
    cache = rec; write(K.current, rec.session);
  }

  // A "visitor" = one new record with one variant (unlocked until consent).
  function startVisitor(variant) {
    if (variant !== 'A' && variant !== 'B') variant = Math.random() < 0.5 ? 'A' : 'B';
    persist(blank(variant));
    return variant;
  }

  function init() {
    var m = all(), id = read(K.current, null);
    cache = id && m[id] ? m[id] : null;
    var forced = (new URLSearchParams(location.search).get('v') || '').toUpperCase();
    if (forced !== 'A' && forced !== 'B') forced = null;
    if (!cache) { startVisitor(forced); return; }
    // LOCK: once consent is given the assignment never changes. Before that a ?v link may still set it.
    if (!cache.consent_at && forced && cache.variant !== forced) { cache.variant = forced; persist(cache); }
  }

  function variant() { return cache ? cache.variant : 'A'; }

  // POST the record to the collection endpoint (upsert by session id on the server). Never breaks the flow.
  function sync() {
    if (!CONFIG.trackEndpoint || !cache || !cache.consent_at) return;
    try {
      var payload = {};
      for (var k in cache) payload[k] = cache[k];
      if (CONFIG.trackToken) payload.token = CONFIG.trackToken;   // sent on the wire only, never stored locally
      fetch(CONFIG.trackEndpoint, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) })
        .catch(function () { /* offline or blocked: localStorage still has it */ });
    } catch (e) { /* tracking must never break the survey */ }
  }

  function update(patch) {
    for (var k in patch) cache[k] = patch[k];
    cache.updated_at = now();
    persist(cache);
    sync();
  }

  function track(name, data) {
    var ev = { event: name, variant: variant(), session: cache ? cache.session : '', time: now() };
    for (var k in (data || {})) ev[k] = data[k];
    var list = read(K.events, []);
    list.push(ev);
    write(K.events, list);
  }

  function reset() {
    write(K.events, []); write(K.responses, {}); write(K.current, null);
    cache = null; startVisitor();
  }

  return {
    init: init, rec: function () { return cache; }, variant: variant, startVisitor: startVisitor,
    update: update, track: track, reset: reset, now: now,
    giveConsent: function () { update({ consent_at: now() }); track('consent_given'); },
    // All respondents on this browser who passed the consent screen.
    responses: function () {
      var m = all();
      return Object.keys(m).map(function (k) { return m[k]; }).filter(function (r) { return r.consent_at; });
    },
    events: function () { return read(K.events, []); }
  };
})();
