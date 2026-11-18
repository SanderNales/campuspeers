/* Headless acceptance checks. Dev-only (the app itself has no dependencies).
   Run:  npm i playwright   (anywhere)   then   node tests/acceptance.js
   Optional: CHROME_PATH=<chrome executable> if Playwright's own browser is not installed. */
const path = require('path');
const { chromium } = require('playwright');

const URL = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
let failed = 0;
function check(name, ok, extra) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || !extra ? '' : '  -> ' + extra));
  if (!ok) failed++;
}
const text = (page) => page.evaluate(() => document.body.innerText + ' | ' + document.title);
const hash = (page) => page.evaluate(() => location.hash);
const rec = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('cp2_responses'))[localStorage.getItem('cp2_current').replace(/"/g, '')]);
const events = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('cp2_events')).map((e) => e.event));
const click = (page, sel) => page.click(sel);

async function passConsentAndScreening(page) {
  await page.check('#consent-box');
  await click(page, '#consent-btn');
  await page.check('input[name=q1][value=yes]');
  await click(page, '[data-action=screen-q1]');
  await page.fill('#programme', 'Computer Science');
  await page.selectOption('#year', '3rd year Bachelor');
  await click(page, '[data-action=screen-q2]');
}
async function pickCourse(page) {
  await click(page, '[data-action=select-course][data-id=calculus-1b]');
  await click(page, '[data-action=to-help]');
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const newPage = async () => (await browser.newContext({ acceptDownloads: true })).newPage();
  const FORBIDDEN = /EUR|€|Book & pay|Lisa|tutor|pay\b/i;

  /* ---- 1. A shows 4 options, B shows 3, free cards identical ---- */
  const cardsFor = async (v) => {
    const page = await newPage();
    await page.goto(URL + '?v=' + v);
    check(v + ': fresh visit lands on consent', (await hash(page)) === '#/consent', await hash(page));
    let seen = await text(page);
    await passConsentAndScreening(page);
    seen += await text(page);
    await pickCourse(page);
    seen += await text(page);
    const cards = await page.$$eval('.card.opt', (els) => els.map((e) => e.innerText.trim()));
    return { page, cards, seen };
  };
  const A = await cardsFor('a'), B = await cardsFor('b');
  check('A help screen has 4 options', A.cards.length === 4, A.cards.length);
  check('B help screen has 3 options', B.cards.length === 3, B.cards.length);
  const aFree = A.cards.filter((_, i) => i !== 1);
  check('three free options identical in A and B', JSON.stringify(aFree) === JSON.stringify(B.cards), JSON.stringify([aFree, B.cards]));
  check('paid card is second in A and mentions price + button', /Lisa V\./.test(A.cards[1]) && /EUR 12 \/ 30 min/.test(A.cards[1]) && /Book & pay EUR 12/.test(A.cards[1]));

  /* ---- 2. B: no price / tutor / paying before Q4 (consent, screening, course, help, free confirmation) ---- */
  await click(B.page, '[data-action=choose-option][data-id=office-hours]');
  B.seen += await text(B.page);
  check('B: forbidden strings absent before Q4', !FORBIDDEN.test(B.seen), (B.seen.match(FORBIDDEN) || [])[0]);
  check('A sanity: forbidden strings DO appear in A', FORBIDDEN.test(A.seen + (await text(A.page))));
  await B.page.goto(URL + '#/pilot');
  check('B cannot open #/pilot', (await hash(B.page)) !== '#/pilot', await hash(B.page));

  /* ---- 3. Guards and screening ---- */
  const g = await newPage();
  await g.goto(URL + '#/help/calculus-1b');
  check('#/help without consent -> #/consent', (await hash(g)) === '#/consent');
  await g.goto(URL + '#/questions');
  check('#/questions without consent -> #/consent', (await hash(g)) === '#/consent');
  check('continue disabled until checkbox ticked', await g.$eval('#consent-btn', (b) => b.disabled));
  await g.check('#consent-box');
  check('continue enabled after ticking', !(await g.$eval('#consent-btn', (b) => b.disabled)));
  await click(g, '#consent-btn');
  await g.check('input[name=q1][value=no]');
  await click(g, '[data-action=screen-q1]');
  check('screening "no" shows thank-you end screen', /Thank you for your time/.test(await text(g)));
  await g.goto(URL + '#/');
  check('screened-out respondent cannot continue', (await hash(g)) === '#/screening');
  const gr = await rec(g);
  check('screened_out recorded', gr.screened_out === true && gr.q1 === 'no');

  /* ---- 4. Variant lock ---- */
  await A.page.goto(URL + '?v=b#/');
  check('?v=b link does not reassign a started respondent', (await rec(A.page)).variant === 'A');

  /* ---- 5. Paid flow in A (+ endpoint sync) ---- */
  const posts = [];
  await A.page.route('https://example.invalid/collect', (route) => { posts.push(JSON.parse(route.request().postData())); route.fulfill({ status: 200, body: 'ok' }); });
  await A.page.goto(URL + '#/help/calculus-1b');
  await A.page.evaluate(() => { CONFIG.trackEndpoint = 'https://example.invalid/collect'; CONFIG.trackToken = 'test-token'; });
  await click(A.page, '[data-action=choose-option][data-id=peer-tutor]');
  check('paid card -> #/pilot', (await hash(A.page)) === '#/pilot');
  const pilotText = await text(A.page);
  check('pilot copy is honest', /prototype/i.test(pilotText) && !/pilot starts soon|let you know when|first session free/i.test(pilotText));
  await click(A.page, '[data-action=notify]');
  check('invalid/empty email is rejected', /valid email/.test(await text(A.page)) && (await hash(A.page)) === '#/pilot');
  await A.page.fill('#email', 'student@example.com');
  await click(A.page, '[data-action=notify]');
  check('email -> #/questions', (await hash(A.page)) === '#/questions');
  check('Q4 comes first and Q5 is not visible yet', /fellow student for 30 minutes/.test(await text(A.page)) && !/highest price/.test(await text(A.page)));
  await A.page.check('input[name=q4][value="4"]'); await click(A.page, '[data-action=answer-next]');
  check('Q5 second', /highest price/.test(await text(A.page)));
  await A.page.check('input[name=q5][value="EUR 6-10"]'); await click(A.page, '[data-action=answer-next]');
  await A.page.check('input[name=q6][value="Asked a friend"]'); await A.page.check('input[name=q6][value="Used an AI chatbot"]');
  await click(A.page, '[data-action=answer-next]');
  check('-> debrief', (await hash(A.page)) === '#/debrief');
  const ar = await rec(A.page), ev = await events(A.page);
  check('record: click_pay, email_given, paid, answers, completed',
    ar.click_pay && ar.email_given && ar.email === 'student@example.com' && ar.option_is_paid && ar.option_chosen === 'peer-tutor' &&
    ar.q4 === 4 && ar.q5 === 'EUR 6-10' && ar.q6.length === 2 && ar.completed && typeof ar.ms_to_choice === 'number', JSON.stringify(ar));
  check('event log has the key events', ['view_consent', 'consent_given', 'view_help', 'select_option', 'click_pay', 'submit_email', 'answer_q4', 'answer_q5', 'answer_q6', 'view_debrief'].every((e) => ev.includes(e)), ev.join(','));
  await A.page.waitForTimeout(300);
  check('endpoint received repeated posts for one session', posts.length >= 4 && posts.every((p) => p.session === ar.session) && posts[posts.length - 1].completed === true, posts.length);
  check('every post carries the token, local record does not store it', posts.every((p) => p.token === 'test-token') && !('token' in ar));
  const { loadScript } = require('./appscript-lib');
  const sheet = loadScript({ token: 'test-token' });
  check('real client payloads pass the Apps Script validation', posts.every((p) => sheet.post(p) === 'ok') && sheet.rows.length === 2, sheet.rows.length);
  await A.page.goto(URL + '#/help/calculus-1b');
  check('finished respondent cannot restart', (await hash(A.page)) === '#/debrief');

  /* ---- 5b. A failing endpoint never breaks the survey ---- */
  const F = await newPage();
  await F.route('https://example.invalid/**', (route) => route.abort());
  await F.goto(URL + '?v=a');
  await F.evaluate(() => { CONFIG.trackEndpoint = 'https://example.invalid/collect'; });
  await passConsentAndScreening(F); await pickCourse(F);
  await click(F, '[data-action=choose-option][data-id=study-group]');
  await click(F, '[data-action=go]');
  await F.check('input[name=q4][value="3"]'); await click(F, '[data-action=answer-next]');
  check('survey continues when the endpoint request fails', /highest price/.test(await text(F)));

  /* ---- 6. B free flow, then results + export ---- */
  await B.page.goto(URL + '#/questions');
  await B.page.check('input[name=q4][value="2"]'); await click(B.page, '[data-action=answer-next]');
  await B.page.check('input[name=q5][value="EUR 0"]'); await click(B.page, '[data-action=answer-next]');
  await B.page.check('input[name=q6][value="Did nothing"]');
  await B.page.check('input[name=q6][value="Other"]');
  await B.page.check('input[name=q6][value="Did nothing"]');
  check('"Did nothing" excludes other Q6 answers', (await B.page.$$eval('input[name=q6]:checked', (e) => e.length)) === 1);
  await click(B.page, '[data-action=answer-next]');
  check('B -> debrief', (await hash(B.page)) === '#/debrief');
  check('debrief copy present', /prototype/.test(await text(B.page)) && /Nothing was charged/.test(await text(B.page)));

  // Put both respondents into one browser's results: re-run B's flow and A's flow in a single context.
  const R = await newPage();
  await R.goto(URL + '#/results');
  await click(R, '[data-action=new-visitor][data-v=A]');
  await passConsentAndScreening(R); await pickCourse(R);
  await click(R, '[data-action=choose-option][data-id=peer-tutor]');
  await R.fill('#email', 'x@example.com'); await click(R, '[data-action=notify]');
  await R.check('input[name=q4][value="5"]'); await click(R, '[data-action=answer-next]');
  await R.check('input[name=q5][value="EUR 11-15"]'); await click(R, '[data-action=answer-next]');
  await R.check('input[name=q6][value="Other"]'); await click(R, '[data-action=answer-next]');
  await R.goto(URL + '#/results');
  await click(R, '[data-action=new-visitor][data-v=B]');
  await passConsentAndScreening(R); await pickCourse(R);
  await click(R, '[data-action=choose-option][data-id=ai-youtube]');
  await click(R, '[data-action=go]');
  await R.check('input[name=q4][value="1"]'); await click(R, '[data-action=answer-next]');
  await R.check('input[name=q5][value="EUR 0"]'); await click(R, '[data-action=answer-next]');
  await R.check('input[name=q6][value="Did nothing"]'); await click(R, '[data-action=answer-next]');
  await R.goto(URL + '#/results');
  const rt = await text(R);
  check('results lists both versions with k of N', /Completed\s+1\s+1/.test(rt) && /1 of 1/.test(rt) && /Fewer than 15/.test(rt), rt.slice(0, 600));
  check('results shows A-only paid taps and SMART block', /“Book & pay” taps\s+1 of 1/.test(rt) && /SMART criterion/i.test(rt) && /thresholds not set/.test(rt));
  const [dl] = await Promise.all([R.waitForEvent('download'), click(R, '[data-action=export][data-what=respondents]')]);
  const csv = require('fs').readFileSync(await dl.path(), 'utf8').trim().split('\n');
  check('respondent export = header + one row per respondent', csv.length === 3, csv.length);
  const [dl2] = await Promise.all([R.waitForEvent('download'), click(R, '[data-action=export][data-what=events]')]);
  check('event export downloads', require('fs').readFileSync(await dl2.path(), 'utf8').split('\n').length > 5);
  check('no "Menu" link on the course screen', !/Menu/.test(await (async () => { await R.goto(URL + '#/results'); await click(R, '[data-action=new-visitor][data-v=A]'); await R.goto(URL + '#/consent'); return text(R); })()));

  await browser.close();
  console.log(failed ? '\n' + failed + ' check(s) FAILED' : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
