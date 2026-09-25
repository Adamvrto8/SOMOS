// Static content model (see CLAUDE.md §3). Checked by `npm run validate:data`.

export type Level = 'A1' | 'A2' | 'B1' | 'B2'

// el = él/ella/usted, ellos = ellos/ellas/ustedes. No vosotros (Mexican Spanish).
export type Person = 'yo' | 'tu' | 'el' | 'nosotros' | 'ellos'

export type Tense = 'presente' | 'preterito'

export type PartOfSpeech = 'noun' | 'verb' | 'adj' | 'adv' | 'prep' | 'pron' | 'conj' | 'phrase' | 'other'

export type Grammar = 'presente' | 'progresivo' | 'preterito' | 'ser-estar' | 'gender' | 'articles'

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
  irregularForms?: string[] // "presente.yo", "preterito.*" → highlighted in UI
  level: Level
}
// presente progresivo is derived: estar.presente[person] + " " + gerund
// (reflexive: pronoun + estar + gerund → "me estoy llamando")

export interface Cloze {
  tokenIndex: number // which token is blanked
  answer: string // correct form, === tokens[tokenIndex]
  lemma: string // base word / infinitive
  // Verbs: "tener · yo · pretérito", "hablar · gerundio", "ser/estar · él · presente".
  // Otherwise a short Slovak hint ("člen", "zajtra").
  hint?: string
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

export interface Topic {
  id: string
  sk: string
  es: string
  icon: string // lucide icon name, kebab-case ("utensils")
}
