# Collecting responses in a Google Sheet

The app POSTs the respondent's response object as JSON (`Content-Type: text/plain`, `mode: no-cors`) to
`CONFIG.trackEndpoint` after every step and on completion. The script below validates it and **upserts by `session`**,
so each respondent ends up as exactly one row that is updated as they progress.

**Assume the endpoint URL is public:** the repo is public, so anyone can read `js/data.js` and POST to the URL.
The script therefore trusts nothing: it only accepts a POST with a JSON object, keeps only whitelisted fields,
validates every type, range and length, rejects the whole payload if anything is wrong, and caps the number of rows.

## Setup

1. Create a new Google Sheet (e.g. `CampusPeers responses`). **Do not share it publicly or "anyone with the link".**
   Share it only with the group members, by name. The web app writes to it as *you*, so the Sheet itself never needs to be public.
2. In the Sheet: **Extensions → Apps Script**. Delete the sample code and paste the script below.
3. Optional: set `TOKEN` in the script to a random string (and the same value as `CONFIG.trackToken` in `js/data.js`).
4. **Deploy → New deployment → type: Web app**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone** (respondents are not signed in; this only lets them POST, not read the Sheet)
5. Authorise, copy the **Web app URL**, paste it in `js/data.js`:
   ```js
   trackEndpoint: '<PASTE YOUR WEB APP URL HERE>',
   ```
6. Test with the payloads in "Testing" below, then with the real app (`/a/`, pass consent, check a row appears).
   After changing the script use **Deploy → Manage deployments → Edit → New version**, otherwise the old code keeps running.

Notes
- **The token is not a secret.** It is shipped in the public JS, so it only reduces casual spam (bots that do not read the repo).
  The real protections are validation, the whitelist and `MAX_ROWS`. If the endpoint gets abused, deploy a new version of
  the script with a new URL and update `data.js`.
- The script cannot require `Content-Type: application/json`: a cross-origin JSON content type would trigger a CORS preflight
  that Apps Script does not answer. Instead it parses the body as JSON and ignores everything that is not a JSON object.
  `GET` requests are ignored.
- Because the request is `no-cors`, the browser cannot read the answer; a failure is silent and the survey carries on.
  Check the Sheet yourself. `localStorage` in each respondent's browser is only a fallback you cannot collect afterwards.
- The Sheet contains emails of people who chose to give one. Delete that column after the date named in the consent text.
- Text starting with `=`, `+`, `-` or `@` is stored with a leading `'` so a respondent cannot inject Sheet formulas.

## Script

```javascript
// ---- configuration ----
var TOKEN = '';        // optional shared token; must equal CONFIG.trackToken in js/data.js. Empty = not checked.
var MAX_ROWS = 5000;   // hard cap against flooding
var MAX_BODY = 4000;   // characters

var HEADERS = [
  'session', 'variant', 'screened_out', 'q1', 'q2', 'q2_year', 'course', 'help_view_time',
  'option_chosen', 'option_is_paid', 'ms_to_choice', 'click_pay', 'email_given', 'email',
  'q4', 'q5', 'q6', 'completed',
  'created_at', 'consent_at', 'screened_at', 'chosen_at', 'completed_at', 'updated_at'
];

// ---- validators: each returns true if the value is acceptable (null/undefined are allowed except where required) ----
function isText_(max) { return function (v) { return typeof v === 'string' && v.length <= max; }; }
function isMatch_(re) { return function (v) { return typeof v === 'string' && re.test(v); }; }
function isInt_(min, max) { return function (v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= min && v <= max; }; }
function isOneOf_(list) { return function (v) { return list.indexOf(v) !== -1; }; }
function isBool_(v) { return typeof v === 'boolean'; }
function isList_(maxItems, maxLen) {
  return function (v) {
    return Array.isArray(v) && v.length <= maxItems && v.every(function (x) { return typeof x === 'string' && x.length <= maxLen; });
  };
}
var ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

var FIELDS = {
  session: isMatch_(/^[a-z0-9]{8,20}$/),
  variant: isOneOf_(['A', 'B']),
  screened_out: isBool_,
  q1: isOneOf_(['yes', 'no']),
  q2: isText_(80),
  q2_year: isText_(40),
  course: isMatch_(/^[a-z0-9-]{1,40}$/),
  help_view_time: isMatch_(ISO),
  option_chosen: isMatch_(/^[a-z0-9-]{1,30}$/),
  option_is_paid: isBool_,
  ms_to_choice: isInt_(0, 86400000),
  click_pay: isBool_,
  email_given: isBool_,
  email: function (v) { return typeof v === 'string' && v.length <= 254 && (v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)); },
  q4: isInt_(1, 5),
  q5: isText_(30),
  q6: isList_(8, 40),
  completed: isBool_,
  created_at: isMatch_(ISO), consent_at: isMatch_(ISO), screened_at: isMatch_(ISO),
  chosen_at: isMatch_(ISO), completed_at: isMatch_(ISO), updated_at: isMatch_(ISO)
};
var REQUIRED = ['session', 'variant'];

// Returns { ok: true, row: [...] } or { ok: false, error: '...' }. Unknown fields (and "token") are dropped.
function validate_(rec) {
  for (var r = 0; r < REQUIRED.length; r++) {
    if (rec[REQUIRED[r]] === undefined || rec[REQUIRED[r]] === null) return { ok: false, error: 'missing ' + REQUIRED[r] };
  }
  var row = [];
  for (var i = 0; i < HEADERS.length; i++) {
    var key = HEADERS[i], v = rec[key];
    if (v === undefined || v === null) { row.push(''); continue; }
    if (!FIELDS[key](v)) return { ok: false, error: 'invalid ' + key };
    if (Array.isArray(v)) v = v.join('; ');                       // q6 is multiple choice
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) v = "'" + v;   // neutralise Sheet formulas
    row.push(v);
  }
  return { ok: true, row: row };
}

function reply_(msg) { return ContentService.createTextOutput(msg); }

// Anything that is not a POST is ignored.
function doGet() { return reply_('ignored'); }

function doPost(e) {
  if (!e || !e.postData || typeof e.postData.contents !== 'string' || e.postData.contents.length > MAX_BODY) return reply_('ignored');
  var rec;
  try { rec = JSON.parse(e.postData.contents); } catch (err) { return reply_('ignored'); }
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return reply_('ignored');
  if (TOKEN && rec.token !== TOKEN) return reply_('ignored');

  var res = validate_(rec);
  if (!res.ok) return reply_('rejected: ' + res.error);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);                      // concurrent phones must not interleave writes
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
    var last = sheet.getLastRow();
    var ids = last > 1 ? sheet.getRange(2, 1, last - 1, 1).getValues() : [];
    var target = 0;
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(rec.session)) { target = i + 2; break; }
    }
    if (target) sheet.getRange(target, 1, 1, HEADERS.length).setValues([res.row]);
    else if (last - 1 >= MAX_ROWS) return reply_('rejected: full');
    else sheet.appendRow(res.row);
    return reply_('ok');
  } finally {
    lock.releaseLock();
  }
}
```

## Testing

`node tests/appscript.test.js` extracts the script above from this file and runs it against an in-memory Sheet.
It posts these payloads (a valid base record, with one change each):

| Payload | Expected |
|---|---|
| valid record | `ok`, one row |
| same record again with `completed: true` | `ok`, still one row (upsert), updated |
| unknown extra field `evil: "x"` | `ok`, field not in the row |
| `variant: "C"` | `rejected: invalid variant` |
| `q2` of 500 characters | `rejected: invalid q2` |
| no `session` | `rejected: missing session` |
| `session: "../../x"` | `rejected: invalid session` |
| `q4: 9` | `rejected: invalid q4` |
| `email` of 300 characters | `rejected: invalid email` |
| `q2: "=HYPERLINK(...)"` | `ok`, stored as `'=HYPERLINK(...)` |
| body that is not JSON, a JSON array, or a GET | `ignored` |
| wrong or missing `token` while `TOKEN` is set | `ignored` |

To test the deployed web app by hand (replace the placeholders):

```bash
curl -L -X POST '<PASTE YOUR WEB APP URL HERE>' -H 'Content-Type: text/plain' \
  --data '{"session":"abcd1234efgh","variant":"C","token":"<TOKEN>"}'
# -> rejected: invalid variant      (then delete any test rows from the Sheet)
```
