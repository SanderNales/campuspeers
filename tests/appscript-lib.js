/* Loads the Apps Script from docs/apps-script.md into a sandbox with an in-memory Sheet. Dev-only. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadScript(opts) {
  opts = opts || {};
  const md = fs.readFileSync(path.resolve(__dirname, '..', 'docs', 'apps-script.md'), 'utf8');
  let code = md.match(/```javascript\n([\s\S]*?)```/)[1];
  if (opts.token) code = code.replace("var TOKEN = '';", "var TOKEN = '" + opts.token + "';");

  const rows = [];   // rows[0] = header row, like a Sheet
  const sheet = {
    getLastRow: () => rows.length,
    appendRow: (r) => { rows.push(r.slice()); },
    getRange: (r, c, nr, nc) => ({
      getValues: () => rows.slice(r - 1, r - 1 + nr).map((x) => x.slice(c - 1, c - 1 + nc)),
      setValues: (v) => { v.forEach((x, i) => { rows[r - 1 + i] = x.slice(); }); }
    })
  };
  const sandbox = {
    ContentService: { createTextOutput: (t) => ({ text: t, getContent: () => t }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheets: () => [sheet] }) }
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return {
    rows,
    post: (body) => sandbox.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).text,
    get: () => sandbox.doGet({}).text
  };
}
module.exports = { loadScript };
