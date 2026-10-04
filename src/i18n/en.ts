import type { Dictionary, ImportSummary } from './sk'

// Interface texts in American English. The shape is sk.ts's: a missing key does not compile.

/** English plural: one form for 1, the other for everything else (0 days, 1 day, 2 days). */
export const pluralEn = (count: number, one: string, many: string) => (count === 1 ? one : many)

const counted = (n: number, one: string, many: string) => `${n} ${pluralEn(n, one, many)}`

export const en: Dictionary = {
  languageName: 'English',
  dateLocale: 'en-US',

  common: {
    back: 'Back',
    clear: 'Clear',
    playPronunciation: 'Play pronunciation',
    notFoundBefore: 'Try finding it with',
    notFoundLink: 'search',
    themeNames: { system: 'system', light: 'light', dark: 'dark' },
    themeTitle: (current) => `Theme: ${current}`,
    themeSwitch: (current, next) => `Theme: ${current}. Switch to: ${next}`,
  },

  nav: {
    main: 'Main navigation',
    home: 'Home',
    search: 'Search',
    practice: 'Practice',
    archive: 'Archive',
    searchWord: 'Search for a word',
  },

  settings: {
    title: 'Settings',
    language: 'Language',
    appearance: 'Appearance',
    theme: 'Theme',
    themeOptions: { system: 'System', light: 'Light', dark: 'Dark' },
    dailyGoal: 'Daily goal',
    dailyGoalHint: 'Answers per day, in lessons and in review.',
    version: 'Version',

    autoReview: {
      title: 'Automatic review',
      toggle: 'Review practiced words',
      toggleHint: 'Words from Vocabulary and Conjugation come back for review.',
      limit: 'Most per day',
      limitLabel: 'Most practiced words per day',
      limitHint: 'Your ⭐ and your own words always come up; the limit is only for practiced words.',
    },

    voice: {
      title: 'Pronunciation',
      unsupported: 'This browser cannot read aloud. Try Chrome.',
      legend: 'Voice',
      auto: 'Automatic',
      offline: 'works offline',
      online: 'needs the internet',
      tryIt: 'Try the voice',
      none: 'No Spanish voice was found on this device.',
      installIntro: 'On Android you can install one like this:',
      installSteps: [
        'Settings → search for “Text-to-speech”.',
        'Next to the Google engine, tap the gear → Install voice data.',
        'Download Español (Estados Unidos), or México if it is offered.',
        'Close SOMOS and open it again.',
      ],
    },

    backup: {
      title: 'Backup',
      intro:
        'Saved and own words, your progress in lessons and the settings live only on this device. Download a backup now and then, to Google Drive for example, so you do not lose them when you change phones.',
      persisted: 'The storage is persistent: the browser will not delete the data on its own.',
      notPersisted: 'The browser may delete the data when space runs low, so a backup is worth it.',
      download: 'Download a backup',
      restore: 'Restore from a backup',
      downloaded: 'The backup is downloaded (Downloads folder).',
      downloadFailed: 'The backup could not be created.',
      restoreFailed: 'The backup could not be restored.',
      notJson: 'The file is not valid JSON.',
      notSomos: 'This is not a SOMOS backup.',
      badVersion: (version) => `Unsupported backup version (${version}).`,
      restored: (r: ImportSummary) => {
        const parts = [`saved: ${r.savedItems}`, `own words: ${r.customWords}`]
        if (r.reviewCards) parts.push(`review cards: ${r.reviewCards}`)
        if (r.attempts) parts.push(`new exercise results: ${r.attempts}`)
        if (r.mistakes) parts.push(`mistakes: ${r.mistakes}`)
        if (r.lessons) parts.push(`lessons: ${r.lessons}`)
        const skipped = r.skipped ? ` Invalid records skipped: ${r.skipped}.` : ''
        const settings = r.settings ? ' The settings were restored too.' : ''
        const reminder = r.reminderOff ? ' The reminder has to be turned on again on this device.' : ''
        return `Restored – ${parts.join(', ')}.${skipped}${settings}${reminder}`
      },
    },
  },

  reminder: {
    title: 'Practice reminder',
    toggle: 'Remind me to practice',
    toggleHint: 'Once a day, if the daily goal is not met yet.',
    time: 'Time',
    sendTest: 'Send a test notification',
    testSent: 'Sent. The notification should arrive in a few seconds.',
    statusTitle: 'Reminder status',
    unreachable: 'The server cannot be reached from here, so the status is unknown. Try another connection.',
    notWorking: 'The reminder is not working',
    errors: {
      unavailable: 'Reminders work only in the deployed app, not on a local server.',
      unsupported: 'This browser does not support notifications.',
      denied: 'Notifications are blocked. Allow them in Android Settings → Apps → SOMOS → Notifications.',
      'not-allowed': 'Reminders do not work without permission for notifications.',
      offline: 'You need the internet.',
      'not-configured': 'Reminders are not set up on the server yet.',
      'too-many': 'You can send a test notification once a minute.',
      gone: 'The notification subscription expired. Try again.',
      failed: 'That did not work. Try again.',
    },
    lost: 'The reminder turned itself off because Android took back the notification permission (after reinstalling the app, for example). Turn it on again.',
    problem: (why) => `The phone could not sign up for reminders. ${why}`,
    problemOffline: 'The server cannot be reached from this network; try another connection.',
    problemFailed: 'Try sending a test notification.',
    status: {
      thisDevice: (time) => `The server knows this phone; the reminder is at ${time}.`,
      otherDevice: 'Reminders go to another device. Send a test notification to switch them here.',
      dropped: 'The server knows no phone: the notification subscription lapsed. Send a test notification to renew it.',
      none: 'The server knows no phone. Send a test notification to sign up again.',
      noTick: 'The server has not heard from the timer yet.',
      stale: (since) => `The timer has been silent since ${since}.`,
      lastCheck: (at, reason) => `Last check at ${at}: ${reason}.`,
      reasons: {
        sent: 'reminder sent',
        'already-sent': 'already sent today',
        'goal-met': 'the daily goal is met',
        'too-early': 'not time yet',
        'too-late': 'past the time',
        'no-subscription': 'no device',
        gone: "the phone's subscription lapsed",
        failed: 'sending failed',
      },
      neverSent: 'None has been sent yet.',
      shortDay: (day, month) => `${month}/${day}`,
      sentToday: 'Last sent today.',
      sentYesterday: 'Last sent yesterday.',
      sentOn: (day) => `Last sent on ${day}.`,
      today: (done, goal) => `Today, according to the server: ${done}/${goal}.`,
    },
  },

  home: {
    practiceMistakes: 'Practice mistakes',
    mistakesWaiting: (n) => `${counted(n, 'task', 'tasks')} waiting`,
    streak: 'Streak',
    streakDays: (n) => `${pluralEn(n, 'day', 'days')} in a row`,
    atRisk: 'Streak at risk – practice today',
    practiceToday: 'practice today',
    goalAria: (done, goal, reached) => `Daily goal: ${done} of ${goal}${reached ? ', reached' : ''}. Practice`,
    goalReached: 'Daily goal reached!',
    goalLeft: (left) => `daily goal · ${left} to go`,
    dueToday: 'To review today',
    continueLesson: 'Continue the lesson',
    firstLesson: 'Start with the first lesson',
    words: (n) => counted(n, 'word', 'words'),
    sentences: (n) => counted(n, 'sentence', 'sentences'),
    minutes: (n) => `about ${n} min`,
    reviewAria: (n) => `Review ${n}`,
    lessonAria: (lesson, label) => `Lesson ${lesson}: ${label}`,
    lessonLine: (lesson, label) => `Lesson ${lesson} · ${label}`,
    reviewDone: 'Review done for today',
    week: 'Last 7 days',
    noActivity: 'No activity yet. Every answer in a lesson or in review counts.',
    answers: (n) => counted(n, 'answer', 'answers'),
    percentCorrect: (percent) => `${percent}% correct`,
    goalLegend: (goal, days) => `daily goal ${goal} · reached on ${days} of 7 days`,
    byDay: 'Answers by day',
    correct: (n) => `${n} correct`,
    today: 'Today',
    weekdays: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    wordOfDay: 'Word of the day',
  },

  exercise: {
    types: {
      cloze: { label: 'Fill in the blank', description: 'Fill in the missing word in the right form.', instruction: 'Fill in the word' },
      choice: { label: 'Multiple choice', description: 'Pick the right word or form.', instruction: 'Pick the right option' },
      vocab: { label: 'Vocabulary', description: 'Translate an English or a Spanish word.', instruction: 'Translate the word' },
      conjugation: { label: 'Conjugation', description: 'tener · yo · pretérito → tuve', instruction: 'Conjugate the verb' },
      builder: { label: 'Sentence builder', description: 'Build a sentence from shuffled words.', instruction: 'Build the sentence' },
      translation: { label: 'Sentence translation', description: 'Translate a sentence from English into Spanish.', instruction: 'Translate into Spanish' },
      dictation: { label: 'Dictation', description: 'Listen to a sentence and type it.', instruction: 'Type what you hear' },
      speaking: { label: 'Speaking', description: 'Read a sentence aloud.', instruction: 'Say the sentence aloud' },
    },
    noSpeech: 'This browser does not support speech recognition.',
    allTopics: 'All topics',
    allTenses: 'All tenses',
  },
}
