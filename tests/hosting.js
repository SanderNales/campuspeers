/* Simulates GitHub Pages project-site hosting: serves the PARENT folder, opens http://localhost:PORT/<repo-folder>/.
   Dev-only. Run:  node tests/hosting.js   (needs `npm i playwright` and `python` on PATH; CHROME_PATH optional) */
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const REPO = path.basename(path.resolve(__dirname, '..'));
const PARENT = path.resolve(__dirname, '..', '..');
const PORT = 8000 + Math.floor(Math.random() * 1000);
const BASE = 'http://localhost:' + PORT + '/' + encodeURIComponent(REPO) + '/';
let failed = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  -> ' + extra)); if (!ok) failed++; }

async function toHelp(page) {
  await page.check('#consent-box'); await page.click('#consent-btn');
  await page.check('input[name=q1][value=yes]'); await page.click('[data-action=screen-q1]');
  await page.fill('#programme', 'CS'); await page.selectOption('#year', 'Master'); await page.click('[data-action=screen-q2]');
  await page.click('[data-action=select-course][data-id=calculus-1b]'); await page.click('[data-action=to-help]');
  return page.$$eval('.card.opt', (e) => e.length);
}
const variantOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('cp2_responses'))[JSON.parse(localStorage.getItem('cp2_current'))].variant);

(async () => {
  const server = spawn(process.env.PYTHON || 'python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: PARENT, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  try {
    const bad = [];
    const fresh = async () => {
      const page = await (await browser.newContext()).newPage();
      page.on('response', (r) => { if (r.url().startsWith('http://localhost:' + PORT) && r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
      page.on('requestfailed', (r) => { if (r.url().startsWith('http://localhost:' + PORT)) bad.push('failed ' + r.url()); });
      return page;
    };

    const a = await fresh();
    await a.goto(BASE + 'a/');
    await a.waitForURL(/\?v=a/);
    check('/a/ redirects to the app root with ?v=a', a.url().startsWith(BASE + '?v=a'), a.url());
    check('/a/ lands on consent', (await a.evaluate(() => location.hash)) === '#/consent');
    check('/a/ -> help screen has 4 options (A)', (await toHelp(a)) === 4);
    check('/a/ stored variant A', (await variantOf(a)) === 'A');

    // lock: same browser, now open the other link
    await a.goto(BASE + 'b/'); await a.waitForURL(/\?v=b/);
    check('after consent, /b/ does not change the variant', (await variantOf(a)) === 'A');
    check('and the respondent is not sent back to consent', (await a.evaluate(() => location.hash)) !== '#/consent', await a.evaluate(() => location.hash));

    const b = await fresh();
    await b.goto(BASE + 'b/'); await b.waitForURL(/\?v=b/);
    check('/b/ -> help screen has 3 options (B)', (await toHelp(b)) === 3);
    check('/b/ stored variant B', (await variantOf(b)) === 'B');

    // before consent the other link may still set the variant
    const c = await fresh();
    await c.goto(BASE + 'a/'); await c.waitForURL(/\?v=a/); await c.goto(BASE + 'b/'); await c.waitForURL(/\?v=b/);
    check('before consent a later link still sets the variant', (await variantOf(c)) === 'B');

    // plain link: random 50/50
    const seen = { A: 0, B: 0 };
    for (let i = 0; i < 24; i++) {
      const p = await fresh(); await p.goto(BASE); seen[await variantOf(p)]++;
      await p.context().close();
    }
    check('plain link assigns both versions randomly', seen.A > 3 && seen.B > 3, JSON.stringify(seen));

    // root with explicit query
    const r = await fresh(); await r.goto(BASE + '?v=b');
    check('?v=b on the root works', (await variantOf(r)) === 'B');

    // no-slash form redirects (GitHub Pages does the same)
    const n = await fresh(); await n.goto(BASE + 'a'); await n.waitForURL(/\?v=a/);
    check('/a (no trailing slash) also works', (await variantOf(n)) === 'A');

    check('no 404 / failed request for css, js or pages under the subpath', bad.length === 0, bad.join(' | '));
  } finally {
    await browser.close(); server.kill();
  }
  console.log(failed ? '\n' + failed + ' FAILED' : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
