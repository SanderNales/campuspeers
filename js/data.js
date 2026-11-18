/* CampusPeers study – all content lives here (or in copy.js) so the team can edit it without touching logic.
   Anything in [BRACKETS] or marked TODO is an open item: fill it in before launching. */

var CONFIG = {
  // Where every response is POSTed (JSON as text/plain, no-cors), keyed by session id so repeats update the same row.
  // TODO: paste your Google Apps Script web-app URL here (see docs/apps-script.md). Empty = localStorage only.
  trackEndpoint: '',

  // Optional shared token, sent in every payload and checked by the Apps Script (TOKEN there must match).
  // The repo is public, so this is NOT a secret: it only reduces casual spam. TODO: set the same value in both places.
  trackToken: '',

  // Shown in the help-screen header: "Stuck on <course>? Exam in N days."
  examInDays: 9,

  // Pre-registered success criterion (SMART). Shown on #/results.
  // TODO: agree X, Y, the date and the sample size as a team. null = not set yet.
  smart: {
    minPaidTapPct: null,     // X: % of group A that tap "Book & pay"
    minEmailPct: null,       // Y: % of group A that leave an email on the pilot screen
    deadline: '22 November 2026', // by when
    minPerVersion: 15        // TODO: confirm sample size per version (the results page warns below this)
  }
};

/* Courses. officeHours / studyGroup are real times that must be filled in per course (identical in A and B). */
var COURSES = [
  { id: 'linear-algebra', name: 'Linear Algebra', topics: 'Eigenvalues, vector spaces',
    officeHours: 'Tuesdays 13:30–15:30, Room HG4.04', studyGroup: 'Fridays 15:00–17:00' }
];

/* The three free options: shown in BOTH versions, same wording, same order.
   `when` is a fixed text; `whenKey` reads the time from the course above. */
var FREE_OPTIONS = [
  { id: 'office-hours', title: 'TA office hours', price: 'Free', whenKey: 'officeHours', note: 'Shared with the whole class' },
  { id: 'study-group', title: 'Study group', price: 'Free', whenKey: 'studyGroup', note: '' },
  { id: 'ai-youtube', title: 'AI chatbot or YouTube', price: 'Free', when: 'Instant', note: 'Generic, not specific to this course' }
];

/* The paid card: rendered ONLY in version A, same card style, not highlighted, at a fixed position
   (0-based index in the final list; 1 = second). Fictional example tutor. */
var PAID_OPTION = {
  id: 'peer-tutor', position: 1, paid: true,
  title: 'Lisa V., 3rd-year Applied Mathematics',
  when: 'Grade 9.0 · 4.9 stars',
  note: 'Available today 15:30',
  price: 'EUR 12 / 30 min',
  button: 'Book & pay EUR 12'
};

/* Answer options for the three closing questions (shown identically in A and B). */
var QUESTIONS = {
  q4: { text: 'How much do you agree: I would pay a fellow student for 30 minutes of help with a course I am stuck on.',
        options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'] },       // stored as 1..5
  q5: { text: 'What is the highest price you would pay for 30 minutes of such help?',
        options: ['EUR 0', 'EUR 1-5', 'EUR 6-10', 'EUR 11-15', 'More than EUR 15'] },
  q6: { text: 'The last time you got stuck on a course, what did you do? (Select all that apply.)',
        options: ['Went to office hours', 'Asked a friend', 'Watched YouTube', 'Used an AI chatbot', 'Did nothing', 'Other'],
        exclusive: 'Did nothing' }
};

var YEARS = ['1st year Bachelor', '2nd year Bachelor', '3rd year Bachelor', 'Master', 'Other'];
