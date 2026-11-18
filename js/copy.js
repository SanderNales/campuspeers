/* Study copy (consent, screening, pilot, debrief). [BRACKETS] are open TODOs – fill in before launch. */

var COPY = {
  consent: {
    title: 'Before you start',
    intro: 'Please read this short information. It is a student project, not a company.',
    sections: [
      ['Purpose', 'This is a prototype made by Group 14 for the course Enterprising Behaviour at [UNIVERSITY]. We want to learn how students look for help when they are stuck on a course.'],
      ['What you will do', 'You will try a short prototype (about 2 minutes) and then answer 3 short questions. Nothing is charged and no booking is made.'],
      ['Risks and benefits', 'We foresee no risks beyond everyday phone use. There is no direct benefit for you.'],
      ['What we record', 'The buttons you tap, your answers, your study programme and year, and your email address only if you choose to give it.'],
      ['Where it is stored and who sees it', 'Data is stored in [STORAGE]. Only our group and the course teachers can see individual responses. We only report combined results.'],
      ['Your email address', 'If you leave one, we use it only for this course project and delete it after [DATE].'],
      ['Voluntary', 'Taking part is voluntary. You can stop at any time by closing this page.'],
      ['Questions or data deletion', 'Contact [NAME + EMAIL] to ask questions or to have your data deleted.']
    ],
    checkbox: 'I am at least 18, I have read the above and I agree to take part.',
    button: 'Continue'
  },

  screening: {
    q1: 'Are you currently following a course at [UNIVERSITY] that you find difficult?',
    q2Programme: 'What is your study programme?',
    q2Year: 'Which year are you in?',
    endTitle: 'Thank you for your time',
    endText: 'This study is for students who are following a course they find difficult, so we do not need anything else from you. You can close this page.'
  },

  pilot: {
    title: 'This is a prototype',
    lead: 'You have not been charged and nothing was booked. The option you tapped does not exist yet: this app is a prototype for a course project (Enterprising Behaviour, Group 14).',
    emailIntro: 'If you want, you can leave your email address. We would only use it for this course project, for example to ask a follow-up question, and delete it after [DATE]. This is optional.',
    placeholder: 'your.name@student.university.nl',
    button: 'Save my email and continue',
    skip: 'Skip, continue without email'
  },

  free: {
    title: 'Noted',
    text: 'You chose this option. There is nothing to book here, because this is a prototype. Please answer three short questions to finish.',
    button: 'Continue'
  },

  debrief: {
    title: 'Thank you, that was it',
    paragraphs: [
      'This was a prototype. Nothing was charged and no booking was made.',
      'Some participants saw one extra option on the help screen: a paid session with a fellow student. That option and the student shown were examples, not a real service or a real person.',
      'Why we ran it: we wanted to know whether students would pay a fellow student for short, on-demand help with a course, even though free options exist. To test this, participants were randomly shown the help screen with or without the paid option, and everything else was identical.',
      'What happens to your data: your answers are combined with those of other participants and only reported as combined results. Your email address (if you gave one) is used only for this course project and deleted after [DATE].',
      'Questions, or want your data deleted? Contact [NAME + EMAIL] and mention your participation code.'
    ]
  }
};
