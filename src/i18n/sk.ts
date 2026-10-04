import { pluralSk } from '../lib/text'

// Interface texts in Slovak, the model for every other language: en.ts has to have this shape.
// Texts with a number are functions, because the languages count differently.
// Spanish and the teaching content (src/data) are not here.

/** What a restored backup brought, for the line under "Obnoviť zo zálohy". */
export interface ImportSummary {
  savedItems: number
  customWords: number
  reviewCards: number
  attempts: number
  mistakes: number
  lessons: number
  skipped: number
  settings: boolean
  reminderOff: boolean
}

export const sk = {
  languageName: 'Slovenčina',
  dateLocale: 'sk-SK',

  common: {
    back: 'Späť',
    clear: 'Vymazať',
    playPronunciation: 'Prehrať výslovnosť',
    notFoundBefore: 'Skús ho nájsť cez',
    notFoundLink: 'vyhľadávanie',
    themeNames: { system: 'podľa systému', light: 'svetlá', dark: 'tmavá' },
    themeTitle: (current: string) => `Téma: ${current}`,
    themeSwitch: (current: string, next: string) => `Téma: ${current}. Prepnúť na: ${next}`,
  },

  nav: {
    main: 'Hlavná navigácia',
    home: 'Domov',
    search: 'Hľadať',
    practice: 'Cvičiť',
    archive: 'Archív',
    searchWord: 'Hľadať slovo',
  },

  settings: {
    title: 'Nastavenia',
    language: 'Jazyk',
    appearance: 'Vzhľad',
    theme: 'Téma',
    themeOptions: { system: 'Podľa systému', light: 'Svetlá', dark: 'Tmavá' },
    dailyGoal: 'Denný cieľ',
    dailyGoalHint: 'Počet odpovedí za deň – v lekciách aj pri opakovaní.',
    version: 'Verzia',

    autoReview: {
      title: 'Automatické opakovanie',
      toggle: 'Opakovať precvičené slová',
      toggleHint: 'Slová zo Slovnej zásoby a Časovania sa vrátia na zopakovanie.',
      limit: 'Najviac za deň',
      limitLabel: 'Najviac precvičených slov za deň',
      limitHint: 'Tvoje ⭐ a vlastné slová prídu na rad vždy, limit platí len pre precvičené slová.',
    },

    voice: {
      title: 'Výslovnosť',
      unsupported: 'Tento prehliadač výslovnosť nepodporuje. Skús Chrome.',
      legend: 'Hlas',
      auto: 'Automaticky',
      offline: 'funguje offline',
      online: 'potrebuje internet',
      tryIt: 'Vyskúšať hlas',
      none: 'V zariadení sme nenašli španielsky hlas.',
      installIntro: 'Na Androide ho doinštaluješ takto:',
      installSteps: [
        'Nastavenia → vyhľadaj „Prevod textu na reč“.',
        'Pri nástroji Google ťukni na ozubené koliesko → Inštalovať hlasové údaje.',
        'Stiahni Español (Estados Unidos), prípadne México, ak je v ponuke.',
        'Zatvor a znova otvor SOMOS.',
      ],
    },

    backup: {
      title: 'Záloha',
      intro:
        'Uložené a vlastné slová, postup v lekciách aj nastavenia sú len v tomto zariadení. Občas si stiahni zálohu, napríklad na Google Drive, aby si o ne neprišiel pri výmene telefónu.',
      persisted: 'Úložisko je trvalé, prehliadač dáta sám nezmaže.',
      notPersisted: 'Prehliadač môže dáta pri nedostatku miesta zmazať – záloha sa oplatí.',
      download: 'Stiahnuť zálohu',
      restore: 'Obnoviť zo zálohy',
      downloaded: 'Záloha je stiahnutá (priečinok Stiahnuté).',
      downloadFailed: 'Zálohu sa nepodarilo vytvoriť.',
      restoreFailed: 'Zálohu sa nepodarilo obnoviť.',
      notJson: 'Súbor nie je platný JSON.',
      notSomos: 'Toto nie je záloha zo SOMOS.',
      badVersion: (version: string) => `Nepodporovaná verzia zálohy (${version}).`,
      restored: (r: ImportSummary) => {
        const parts = [`uložené: ${r.savedItems}`, `vlastné slová: ${r.customWords}`]
        if (r.reviewCards) parts.push(`karty na opakovanie: ${r.reviewCards}`)
        if (r.attempts) parts.push(`nové výsledky cvičení: ${r.attempts}`)
        if (r.mistakes) parts.push(`chyby: ${r.mistakes}`)
        if (r.lessons) parts.push(`lekcie: ${r.lessons}`)
        const skipped = r.skipped ? ` Preskočené neplatné záznamy: ${r.skipped}.` : ''
        const settings = r.settings ? ' Obnovené sú aj nastavenia.' : ''
        const reminder = r.reminderOff ? ' Pripomienku treba na tomto zariadení zapnúť znova.' : ''
        return `Obnovené – ${parts.join(', ')}.${skipped}${settings}${reminder}`
      },
    },
  },

  reminder: {
    title: 'Pripomienka cvičenia',
    toggle: 'Pripomínať cvičenie',
    toggleHint: 'Raz denne, ak ešte nemáš splnený denný cieľ.',
    time: 'Čas',
    sendTest: 'Poslať skúšobnú notifikáciu',
    testSent: 'Odoslané. Notifikácia by mala prísť o pár sekúnd.',
    statusTitle: 'Stav pripomienky',
    unreachable: 'Server je odtiaľto nedostupný, stav sa nedá zistiť. Skús iné pripojenie.',
    notWorking: 'Pripomienka nefunguje',
    errors: {
      unavailable: 'Pripomienky fungujú len v nasadenej aplikácii, nie na lokálnom serveri.',
      unsupported: 'Tento prehliadač notifikácie nepodporuje.',
      denied: 'Notifikácie sú zablokované. Povoľ ich v Nastaveniach Androidu → Aplikácie → SOMOS → Upozornenia.',
      'not-allowed': 'Bez povolenia notifikácií pripomienky nefungujú.',
      offline: 'Potrebuješ internet.',
      'not-configured': 'Pripomienky ešte nie sú na serveri nastavené.',
      'too-many': 'Skúšobnú notifikáciu môžeš poslať raz za minútu.',
      gone: 'Prihlásenie na notifikácie vypršalo. Skús to znova.',
      failed: 'Nepodarilo sa. Skús to znova.',
    },
    lost: 'Pripomienka sa vypla, lebo Android zrušil povolenie upozornení (napríklad po preinštalovaní aplikácie). Zapni ju znova.',
    problem: (why: string) => `Telefón sa nepodarilo prihlásiť na pripomienky. ${why}`,
    problemOffline: 'Server je z tejto siete nedostupný, skús iné pripojenie.',
    problemFailed: 'Skús poslať skúšobnú notifikáciu.',
    status: {
      thisDevice: (time: string | null) => `Server pozná tento telefón, pripomienka o ${time}.`,
      otherDevice: 'Pripomienky chodia na iné zariadenie. Pošli skúšobnú notifikáciu, tým sa prepnú sem.',
      dropped: 'Server nepozná žiadny telefón: prihlásenie na notifikácie zaniklo. Pošli skúšobnú notifikáciu, tým sa obnoví.',
      none: 'Server nepozná žiadny telefón. Pošli skúšobnú notifikáciu, tým sa prihlási znova.',
      noTick: 'Server ešte nedostal signál z časovača.',
      /** `since` = "11:45", or "2. 10. 11:45" when it was not today. */
      stale: (since: string) => `Časovač sa neozval od ${since}.`,
      lastCheck: (at: string, reason: string) => `Posledná kontrola o ${at}: ${reason}.`,
      reasons: {
        sent: 'pripomienka poslaná',
        'already-sent': 'dnes už bola poslaná',
        'goal-met': 'denný cieľ je splnený',
        'too-early': 'ešte nie je čas',
        'too-late': 'už je po čase',
        'no-subscription': 'žiadne zariadenie',
        gone: 'prihlásenie telefónu zaniklo',
        failed: 'odoslanie zlyhalo',
      } as Record<string, string>,
      neverSent: 'Zatiaľ nebola poslaná žiadna.',
      shortDay: (day: number, month: number) => `${day}. ${month}.`,
      sentToday: 'Naposledy poslaná dnes.',
      sentYesterday: 'Naposledy poslaná včera.',
      /** `day` comes from shortDay. */
      sentOn: (day: string) => `Naposledy poslaná ${day}`,
      today: (done: number, goal: number) => `Dnes podľa servera: ${done}/${goal}.`,
    },
  },

  home: {
    practiceMistakes: 'Precvičiť chyby',
    mistakesWaiting: (n: number) => `${n} ${pluralSk(n, ['úloha čaká', 'úlohy čakajú', 'úloh čaká'])}`,
    streak: 'Séria',
    /** Under the big number of days. */
    streakDays: (n: number) => `${pluralSk(n, ['deň', 'dni', 'dní'])} v rade`,
    atRisk: 'Séria v ohrození – precvič si ešte dnes',
    practiceToday: 'precvič si dnes',
    goalAria: (done: number, goal: number, reached: boolean) => `Denný cieľ: ${done} z ${goal}${reached ? ', splnený' : ''}. Precvičovať`,
    goalReached: 'Denný cieľ splnený!',
    goalLeft: (left: number) => `denný cieľ · ešte ${left}`,
    dueToday: 'Na zopakovanie dnes',
    continueLesson: 'Pokračuj v lekcii',
    firstLesson: 'Začni prvou lekciou',
    words: (n: number) => `${n} ${pluralSk(n, ['slovo', 'slová', 'slov'])}`,
    sentences: (n: number) => `${n} ${pluralSk(n, ['veta', 'vety', 'viet'])}`,
    minutes: (n: number) => `asi ${n} min`,
    reviewAria: (n: number) => `Zopakovať ${n}`,
    lessonAria: (lesson: number, label: string) => `Lekcia ${lesson}: ${label}`,
    lessonLine: (lesson: number, label: string) => `Lekcia ${lesson} · ${label}`,
    reviewDone: 'Opakovanie na dnes hotové',
    week: 'Posledných 7 dní',
    noActivity: 'Zatiaľ žiadna aktivita. Každá odpoveď v lekcii aj pri opakovaní sa ráta.',
    answers: (n: number) => `${n} ${pluralSk(n, ['odpoveď', 'odpovede', 'odpovedí'])}`,
    percentCorrect: (percent: number) => `${percent} % správne`,
    goalLegend: (goal: number, days: number) => `denný cieľ ${goal} · splnený ${days} z 7 dní`,
    byDay: 'Odpovede po dňoch',
    correct: (n: number) => `${n} správne`,
    today: 'Dnes',
    weekdays: ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'], // Date.getDay() order
    wordOfDay: 'Slovo dňa',
  },

  exercise: {
    types: {
      cloze: { label: 'Doplňovačka', description: 'Doplň chýbajúce slovo v správnom tvare.', instruction: 'Doplň slovo' },
      choice: { label: 'Výber z možností', description: 'Vyber správne slovo alebo tvar.', instruction: 'Vyber správnu možnosť' },
      vocab: { label: 'Slovná zásoba', description: 'Prelož slovenské alebo španielske slovo.', instruction: 'Prelož slovo' },
      conjugation: { label: 'Časovanie', description: 'tener · yo · pretérito → tuve', instruction: 'Vyčasuj sloveso' },
      builder: { label: 'Skladanie viet', description: 'Poskladaj vetu zo zamiešaných slov.', instruction: 'Poskladaj vetu' },
      translation: { label: 'Preklad viet', description: 'Prelož vetu zo slovenčiny do španielčiny.', instruction: 'Prelož do španielčiny' },
      dictation: { label: 'Diktát', description: 'Počúvaj vetu a napíš ju.', instruction: 'Napíš, čo počuješ' },
      speaking: { label: 'Vyslovovanie', description: 'Prečítaj vetu nahlas.', instruction: 'Povedz vetu nahlas' },
    },
    noSpeech: 'Tento prehliadač nepodporuje rozpoznávanie reči.',
    allTopics: 'Všetky témy',
    allTenses: 'Všetky časy',
  },
}

export type Dictionary = typeof sk
