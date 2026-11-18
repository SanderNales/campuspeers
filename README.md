# CampusPeers – A/B study prototype

Prototype for the course Enterprising Behaviour (Group 14). It tests one critical assumption:
**students will pay a fellow student for short, on-demand help with a specific course, even though free alternatives exist.**

Static web app: plain HTML, CSS and JavaScript. No build step, no backend, no dependencies.

## Run it

- **Locally:** double-click `index.html` (or `a/index.html` / `b/index.html` to test the short links).
- **Subpath test (like GitHub Pages):** serve the *parent* folder, then open the repo folder:
  `cd .. && python3 -m http.server 8000` → `http://localhost:8000/<REPO-FOLDER-NAME>/`, `…/a/`, `…/b/`.
  `node tests/hosting.js` does this automatically.

On a phone it fills the screen; on a laptop it sits in a phone frame.

## Survey links (what respondents get)

One repo, one copy of the app. `a/` and `b/` only contain a tiny redirect to the root with the version set.

| Link | Shows | Help screen |
|---|---|---|
| `https://SanderNales.github.io/campuspeers/a/` | **Version A** | 3 free options + 1 paid peer-tutor card |
| `https://SanderNales.github.io/campuspeers/b/` | **Version B** | the same 3 free options only |
| `https://SanderNales.github.io/campuspeers/` | random 50/50 | A or B |

`…/?v=a` and `…/?v=b` on the root also work. Copy-paste list: [docs/LINKS.md](docs/LINKS.md).
The assignment is locked once a respondent has passed the consent screen, so opening the other link later changes nothing.
Before consent a later link may still set the version (nobody has started yet).

### Hosting on GitHub Pages

1. Push this repo to GitHub (public repo, so free Pages works; see the Data section: the repo must never contain data).
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / folder `/ (root)` → Save.**
   No GitHub Actions needed. `.nojekyll` (repo root) makes Pages serve the files as they are.
3. Wait 1–2 minutes. The URL appears at the top of the Pages settings: `https://SanderNales.github.io/campuspeers/`.

### Check a deploy

On your own phone, in a private tab, for each of `/a/`, `/b/` and the plain link:
1. It lands on the consent screen (not a 404, not an unstyled page).
2. Pass consent, screening, pick a course. `/a/` shows **4** options, `/b/` shows **3**.
3. Finish the flow. A new row appears in the Google Sheet (once `trackEndpoint` is set), then delete your test rows.
4. After Pages updates, hard-refresh (browsers cache `js/` and `css/`).

### Handing out the links fairly

- Alternate **person by person**: 1st person gets `/a/`, 2nd gets `/b/`, 3rd `/a/` … Do not let people pick, and do not hand
  A to one kind of student (friends, one programme, one time of day) and B to another.
- Or give everyone the **plain link** and let the app randomise 50/50 (simplest and fairest; group sizes may differ a bit).
- Do not mix both methods in one session, and never tell people which version they have.
- If one person opens both links, the first one that passed consent counts.

## The A/B definition

The two versions differ in **exactly one thing**, on the help screen (`#/help/<course>`). Consent, wording, order, styling,
questions and debrief are identical.

| Version | Link | Help screen |
|---|---|---|
| **B** (baseline, what students have today) | `/b/` or `?v=b` | 3 free options: TA office hours, study group, AI chatbot or YouTube |
| **A** | `/a/` or `?v=a` | the same 3 free options **plus** one paid peer-tutor card (second in the list, same card style, not highlighted) |
| random | plain link | 50/50 |

**Assignment is locked** per browser once the consent screen has been passed: opening another `?v=` link later does not
reassign someone who has started or finished. Only the "New visitor" buttons on `#/results` reset it (for demos/tests).

In B nothing about prices, tutors or paying is shown before question Q4. Direct URLs to `#/pilot` are blocked in B.

## Flow

| Route | Screen |
|---|---|
| `#/consent` | Consent. Continue is disabled until the checkbox is ticked. |
| `#/screening` | Q1 difficult course? ("No" ends the study with a thank-you screen, `screened_out`). Q2 programme + year. |
| `#/` | Pick your course |
| `#/help/<course>` | **The help screen (only screen that differs)** |
| `#/free/<option>` | Short confirmation after a free option (same in A and B) |
| `#/pilot` | Fake door, only reachable by tapping the paid card (A). Honest "this is a prototype" copy, optional email (validated). |
| `#/questions` | Q4 would pay (5-point), Q5 highest price, Q6 what you did last time. One question at a time. |
| `#/debrief` | Debrief + participation code |
| `#/results` | Team page, reachable only by typing the URL |

The flow is forward-only: opening `#/help` or `#/questions` without consent redirects to `#/consent`; finished respondents land on the debrief.

## Data

One record per respondent (`session, variant, screened_out, q1, q2, q2_year, course, help_view_time, option_chosen,
option_is_paid, ms_to_choice, click_pay, email_given, email, q4, q5, q6, completed` and timestamps), plus an event log
(`view_consent, consent_given, view_help, select_option, click_pay, submit_email, answer_q4…q6, view_debrief`, …).

- **localStorage** (keys `cp2_*`) always keeps a copy: fallback and what `#/results` reads. It only contains this browser's respondents.
- **Central collection:** set `CONFIG.trackEndpoint` in `js/data.js`. The record is POSTed as JSON (`text/plain`, `no-cors`)
  after each step and on completion; the server upserts by session id. Setup of the Google Sheet + Apps Script: [docs/apps-script.md](docs/apps-script.md).
  Only respondents who passed consent are sent. The event log stays local.

### Data: never in the repo

The repo is public. **Never commit exports, CSVs, spreadsheets, screenshots with answers, or anyone's email address.**
Respondent data lives only in the Google Sheet, which stays **private to the group** (shared by name, never "anyone with
the link"). `.gitignore` blocks `*.csv`, `*.xlsx`, `exports/`, `data/`, `.env`, `node_modules/`, `qr/` and test output, but check
`git status` before every commit. The collection endpoint URL is readable in `js/data.js`, so the Apps Script validates everything
it receives; see [docs/apps-script.md](docs/apps-script.md). Download exports only to a folder outside the repo.

## Results page (`#/results`)

Started / screened out / completed per version; option chosen as "k of N" (percentage secondary) with the free-option share
highlighted; "Book & pay" taps and emails left (A); Q4/Q5/Q6 distributions; the SMART criterion and whether it is met;
a warning when fewer than 15 completed per version. Exports: respondents (one row each) and the event log, as CSV.

## Where to change things

| File | What |
|---|---|
| `js/data.js` | Config, courses + real office hour / study group times, free and paid options, question options |
| `js/copy.js` | Consent, screening, pilot, debrief texts |
| `js/views.js` | One function per screen |
| `js/app.js` | Router, flow guards, button actions |
| `js/store.js` | Assignment lock, response record, events, sync |
| `css/styles.css` | Styling shared by A and B |
| `a/index.html`, `b/index.html` | Short links: redirect to `../?v=a` / `../?v=b` (no app code here) |
| `docs/` | `apps-script.md` (collection endpoint), `LINKS.md` (links for slides) |
| `tests/` | Dev-only checks: `node tests/appscript.test.js` (no deps); `acceptance.js` and `hosting.js` need `npm i playwright` |
| `scripts/make-qr.py` | Dev-only QR codes: `pip install qrcode pillow`, then `python scripts/make-qr.py https://SanderNales.github.io/campuspeers/` → `qr/` (git-ignored) |

## TODO before launch

Everything below is a placeholder and shows up literally in the app until filled in:

- [ ] Office hour and study group times per course (`js/data.js`, `[TODO: …]`)
- [x] `[UNIVERSITY]`, `[STORAGE]`, `[DATE]`, `[NAME + EMAIL]` in `js/copy.js` (done; storage = private Google Sheet, then moved to VU OneDrive)
- [ ] After the study: download the Sheet as `.xlsx`, move it to VU OneDrive, delete the Google Sheet (as promised in the consent text)
- [ ] SMART thresholds X (`minPaidTapPct`), Y (`minEmailPct`), deadline and `minPerVersion` in `CONFIG.smart`
- [ ] `CONFIG.trackEndpoint` and optional `CONFIG.trackToken` (see docs/apps-script.md; the token is not a secret)
- [ ] `SanderNales` and `campuspeers` in the links above
- [ ] Have the consent and debrief texts checked by your course teachers / ethics requirements

The tutor shown in A ("Lisa V.") is a fictional example.
