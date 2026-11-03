// Static content model (see CLAUDE.md §3). Checked by `npm run validate:data`.

export type Level = 'A1' | 'A2' | 'B1' | 'B2'

// el = él/ella/usted, ellos = ellos/ellas/ustedes. No vosotros (Mexican Spanish).
export type Person = 'yo' | 'tu' | 'el' | 'nosotros' | 'ellos'

// Tenses stored on every verb with all five persons.
export type Tense = 'presente' | 'preterito' | 'imperfecto' | 'futuro' | 'subjuntivo' | 'subjImperfecto' | 'condicional'

// tú, usted, nosotros, ustedes: the imperative has no yo (el = usted, ellos = ustedes).
export type ImperativePerson = 'tu' | 'el' | 'nosotros' | 'ellos'

export type PartOfSpeech = 'noun' | 'verb' | 'adj' | 'adv' | 'prep' | 'pron' | 'conj' | 'phrase' | 'other'

export type Grammar =
  | 'presente'
  | 'progresivo'
  | 'preterito'
  | 'imperfecto'
  | 'futuro'
  | 'ser-estar'
  | 'gender'
  | 'articles'
  | 'imperativo'
  | 'subjuntivo'
  | 'condicional'
  | 'pluscuamperfecto'
  | 'subj-imperfecto'
  | 'gustar'
  | 'hay-estar'
  | 'object-pronouns'
  | 'comparisons'
  | 'obligation'
  | 'subjuntivo-wishes'
  | 'si-clauses'
  | 'por-para'
  | 'subjuntivo-clauses'
  | 'relatives'
  | 'passive-se'

export interface Example {
  es: string
  sk: string
}

export interface Word {
  id: string // slug of `es` (accents stripped), "-2" suffix on collision: "papa" / "papa-2"
  es: string // lemma
  sk: string[] // Slovak translations, first = primary
  pos: PartOfSpeech
  gender?: 'm' | 'f' // nouns only
  plural?: string // nouns/adjs if not trivial (+s)
  uncountable?: boolean // no plural in normal use (el fútbol, la salud): skips the plural check
  drill?: false // never asked as a vocab task: the articles (el, un…), which the grammar steps practise
  feminine?: string // adjs: "bonito" → "bonita"
  level: Level
  topics: string[] // topic ids
  examples: Example[] // 1–3
  note?: string // usage note in Slovak (false friend, MX-specific…)
  verbId?: string // link to Verb when pos === 'verb'
}

export interface Verb {
  id: string // infinitive, e.g. "tener", "llamarse"
  sk: string[]
  group: 'ar' | 'er' | 'ir'
  // false if any form deviates from the -ar/-er/-ir pattern, spelling changes included (llegué)
  regular: boolean
  reflexive?: boolean // forms include the pronoun: "me llamo"
  gerund: string // without pronoun, also for reflexive verbs: "llamando"
  gerundIrregular?: boolean
  presente: Record<Person, string>
  preterito: Record<Person, string>
  imperfecto: Record<Person, string>
  futuro: Record<Person, string> // futuro simple: infinitive + é/ás/á/emos/án
  // The B1–B2 forms follow from the ones above by the rules of src/lib/verbForms.ts (checked by the validator).
  subjuntivo: Record<Person, string> // presente de subjuntivo: tenga
  subjImperfecto: Record<Person, string> // imperfecto de subjuntivo, -ra only (Mexico): tuviera
  condicional: Record<Person, string> // futuro stem + ía: tendría
  imperativo: Record<ImperativePerson, string> // affirmative, pronoun attached (levántate); negative = "no " + subjuntivo
  participle: string // without pronoun, like the gerund: "levantado"
  participleIrregular?: boolean
  // "presente.yo", "preterito.*", "subjuntivo.*", "imperativo.tu" → highlighted in UI
  irregularForms?: string[]
  level: Level
}
// presente progresivo is derived: estar.presente[person] + " " + gerund
// pluscuamperfecto likewise: haber.imperfecto[person] + " " + participle ("había salido")
// (reflexive: pronoun + estar + gerund → "me estoy llamando")

export interface Cloze {
  tokenIndex: number // which token is blanked
  answer: string // correct form, === tokens[tokenIndex]
  lemma: string // base word / infinitive
  // Verbs: "tener · yo · pretérito", "hablar · gerundio", "ser/estar · él · presente".
  // Otherwise a short Slovak hint ("člen", "zajtra").
  hint?: string
  tip?: Grammar // a usage tip the blank practises ("por-para"); a verb hint leads to the tense tips by itself
  why?: string // ser/estar blanks: the rule of the "ser-estar" tip that applies here ("origin"); blanks with `tip`: a rule of that tip
  distractors?: string[] // for multiple choice
}

export interface Sentence {
  id: string
  es: string
  sk: string
  level: Level
  topics: string[]
  tokens: string[] // for sentence builder, punctuation separate
  cloze?: Cloze[]
  grammar?: Grammar[]
}

// Grammar tips ("Prečo?"): a short Slovak explanation with examples, src/data/tips.json.
export interface TipRule {
  id: string // unique within its tip; a ser/estar cloze points at one with `why`
  title: string // Slovak: "Pôvod"
  text?: string // Slovak, one or two sentences
  examples: Example[] // 1–3
  verb?: 'ser' | 'estar' // ser-estar only: groups the rules, must equal the lemma of a cloze pointing here
  because?: string // ser-estar and the usage tips, shown for one blank: "Ide o pôvod, preto ser."
}

export interface Tip {
  id: string // a Grammar tag where one exists ("preterito"), else its own ("accents")
  title: string
  level: Level // the level it is taught at, after the Plan curricular del Instituto Cervantes
  intro: string
  rules: TipRule[]
  related?: string[] // tip ids, "Pozri aj"
  sources: string[] // citations: "Plan curricular del Instituto Cervantes (2006), Gramática B1"
}

// The guided path ("Cesta", docs/guided-path-spec.md): src/data/path.json, units in the order they are learned.
export interface PathEntry {
  level: Level
  topic: string // the unit teaches the words and sentences whose first topic this is, at the level
  part: number // 1…n: a topic with many words at a level is split into n units, in data order
  grammar: string // a tip id: the grammar point of the unit
  rules?: string[] // rule ids of that tip; none = the whole tip
}

export interface Topic {
  id: string
  sk: string
  es: string
  icon: string // lucide icon name, kebab-case ("utensils")
}

// ---------- English overlay (src/data/en/) ----------
// Matched to the base data by id and holding only what is language. An entry that is missing
// means "not translated yet": src/lib/localized.ts then shows the Slovak.

export interface WordEn {
  id: string
  en: string[] // translations, first = primary
  examples?: string[] // translations of the word's examples, in their order
  note?: string // written for an English speaker; none = the word has no note in English
}

export interface VerbEn {
  id: string
  en: string[]
}

export interface SentenceEn {
  id: string
  en: string
  hints?: (string | null)[] // one per cloze; null keeps the base hint ("tener · yo · pretérito")
}

export interface TopicEn {
  id: string
  en: string
}

/** A whole tip rewritten for an English speaker: same id, the same rules in the same order. */
export interface TipEn {
  id: string
  title: string
  intro: string
  rules: { id: string; title: string; text?: string; because?: string; examples: string[] }[] // examples: translations, in order
}
