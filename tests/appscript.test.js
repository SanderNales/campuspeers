/* Tests the validation in docs/apps-script.md. Run: node tests/appscript.test.js (no dependencies) */
const { loadScript } = require('./appscript-lib');
let failed = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  -> ' + extra)); if (!ok) failed++; }

const base = {
  session: 'abcd1234efgh', variant: 'A', screened_out: false, q1: 'yes', q2: 'Computer Science', q2_year: 'Master',
  course: 'calculus-1b', help_view_time: '2026-11-18T10:00:00.000Z', option_chosen: 'peer-tutor', option_is_paid: true,
  ms_to_choice: 4200, click_pay: true, email_given: true, email: 'a@b.nl', q4: 4, q5: 'EUR 6-10', q6: ['Asked a friend', 'Other'],
  completed: false, created_at: '2026-11-18T10:00:00.000Z', consent_at: '2026-11-18T10:00:05.000Z', updated_at: '2026-11-18T10:01:00.000Z'
};
const w = (patch) => Object.assign({}, base, patch);

let s = loadScript();
check('valid record accepted', s.post(base) === 'ok' && s.rows.length === 2, s.rows.length);
check('q6 joined, header written', s.rows[1][16] === 'Asked a friend; Other' && s.rows[0][0] === 'session');
check('same session upserts (one row, updated)', s.post(w({ completed: true })) === 'ok' && s.rows.length === 2 && s.rows[1][17] === true);
check('other session adds a row', s.post(w({ session: 'zzzz9999yyyy' })) === 'ok' && s.rows.length === 3);
s.post(w({ session: 'unknown0001', evil: 'x', token: 't' }));
check('unknown fields dropped', !s.rows[3].includes('x') && s.rows[3].length === s.rows[0].length);

const n = s.rows.length;
check('unknown variant rejected', s.post(w({ variant: 'C' })) === 'rejected: invalid variant');
check('oversized text field rejected', s.post(w({ q2: 'x'.repeat(500) })) === 'rejected: invalid q2');
const noSession = w({}); delete noSession.session;
check('missing session rejected', s.post(noSession) === 'rejected: missing session');
check('malformed session rejected', s.post(w({ session: '../../x' })) === 'rejected: invalid session');
check('scale out of range rejected', s.post(w({ session: 'q4bad000001', q4: 9 })) === 'rejected: invalid q4');
check('oversized email rejected', s.post(w({ session: 'mail00000001', email: 'a'.repeat(300) + '@b.nl' })) === 'rejected: invalid email');
check('wrong type rejected', s.post(w({ session: 'type0000001', click_pay: 'yes' })) === 'rejected: invalid click_pay');
check('rejected payloads wrote nothing', s.rows.length === n, s.rows.length);
s.post(w({ session: 'formula00001', q2: '=HYPERLINK("http://x")' }));
check('formula neutralised', s.rows[s.rows.length - 1][4] === '\'=HYPERLINK("http://x")');
check('non-JSON ignored', s.post('hello') === 'ignored');
check('JSON array ignored', s.post('[1,2]') === 'ignored');
check('oversized body ignored', s.post(JSON.stringify(w({ q2: 'x'.repeat(5000) }))) === 'ignored');
check('GET ignored', s.get() === 'ignored');

const t = loadScript({ token: 'tok123' });
check('token required when set (missing)', t.post(base) === 'ignored' && t.rows.length === 0);
check('token required when set (wrong)', t.post(w({ token: 'nope' })) === 'ignored');
check('token accepted when correct', t.post(w({ token: 'tok123' })) === 'ok' && t.rows.length === 2 && !t.rows[1].includes('tok123'));

console.log(failed ? '\n' + failed + ' FAILED' : '\nAll checks passed');
process.exit(failed ? 1 : 0);
