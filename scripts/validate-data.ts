// Validates static content in src/data. Run with `npm run validate:data`.
// Exits with code 1 and lists every problem if anything is wrong.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import type { Cloze, Grammar, ImperativePerson, Level, PathEntry, Person, Sentence, SentenceEn, Source, SpanishVariant, Tense, Tip, TipEn, Topic, TopicEn, Verb, VerbEn, Word, WordEn } from '../src/data/types.ts'
import {
  deriveCondicional,
  deriveImperativo,
  deriveParticiple,
  deriveSubjImperfecto,
  deriveSubjuntivo,
  IMPERATIVE_PERSONS,
  regularImperativo,
  regularNew,
  regularParticiple,
} from '../src/lib/verbForms.ts'
import { checksOwnHint, usageClozeErrors, usageHint, USAGE_TIPS } from '../src/lib/clozeChecks.ts'

const DATA = new URL('../src/data/', import.meta.url)
const readJson = (url: URL) => JSON.parse(readFileSync(url, 'utf8')) as unknown

// words/, sentences/ and verbs/ hold one JSON array per file (same order as src/data/index.ts).
function loadDir<T>(dir: string): T[] {
  const url = new URL(`${dir}/`, DATA)
  return readdirSync(url)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => {
      const data = readJson(new URL(f, url))
      if (!Array.isArray(data)) throw new Error(`src/data/${dir}/${f} must contain a JSON array`)
      return data as T[]
    })
}

const topics = readJson(new URL('topics.json', DATA)) as Topic[]
const words = loadDir<Word>('words')
const verbs = loadDir<Verb>('verbs')
const sentences = loadDir<Sentence>('sentences')
const tipsUrl = new URL('tips.json', DATA)
const tips = (existsSync(tipsUrl) ? readJson(tipsUrl) : []) as Tip[]
const sourcesUrl = new URL('sources.json', DATA)
const sources = (existsSync(sourcesUrl) ? readJson(sourcesUrl) : []) as Source[]

const errors: string[] = []
const fail = (where: string, message: string) => errors.push(`${where}: ${message}`)

const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2']
const PERSONS: Person[] = ['yo', 'tu', 'el', 'nosotros', 'ellos']
const TENSES: Tense[] = ['presente', 'preterito', 'imperfecto', 'futuro', 'subjuntivo', 'subjImperfecto', 'condicional']
// The B1–B2 tenses follow from the others by the rules of src/lib/verbForms.ts.
const DERIVED_TENSES = ['subjuntivo', 'subjImperfecto', 'condicional'] as const
type StoredTense = Exclude<Tense, (typeof DERIVED_TENSES)[number]>
const isDerived = (tense: Tense): tense is (typeof DERIVED_TENSES)[number] => (DERIVED_TENSES as readonly string[]).includes(tense)
const POS = ['noun', 'verb', 'adj', 'adv', 'prep', 'pron', 'conj', 'phrase', 'other']
const GRAMMAR = ['presente', 'progresivo', 'preterito', 'imperfecto', 'futuro', 'ser-estar', 'gender', 'articles', 'imperativo', 'subjuntivo', 'condicional', 'pluscuamperfecto', 'subj-imperfecto', 'gustar', 'hay-estar', 'object-pronouns', 'comparisons', 'obligation', 'subjuntivo-wishes', 'si-clauses', 'por-para', 'subjuntivo-clauses', 'relatives', 'passive-se']

// ---------- helpers ----------

const isNonEmpty = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0

const stripAccents = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '')

const slugify = (s: string) =>
  stripAccents(s)
    .toLowerCase()
    .replace(/[¿?¡!.,]/g, '')
    .trim()
    .replace(/\s+/g, '-')

function checkUniqueIds(items: { id: string }[], label: string) {
  const seen = new Set<string>()
  for (const { id } of items) {
    if (!isNonEmpty(id)) fail(label, 'item without id')
    else if (seen.has(id)) fail(`${label}[${id}]`, 'duplicate id')
    seen.add(id)
  }
}

function checkLevel(where: string, level: unknown) {
  if (!LEVELS.includes(level as Level)) fail(where, `invalid level "${String(level)}"`)
}

const topicIds = new Set(topics.map((t) => t.id))

function checkTopics(where: string, ids: unknown, required: boolean) {
  if (!Array.isArray(ids)) return fail(where, 'topics must be an array')
  if (required && ids.length === 0) fail(where, 'needs at least one topic')
  for (const id of ids) if (!topicIds.has(id)) fail(where, `unknown topic "${id}"`)
}

// ---------- Mexican Spanish rules ----------

// Words that are standard in Spain but not in Mexico (MX equivalent in comment).
const SPAIN_ONLY = new Map([
  ['coche', 'carro'],
  ['coches', 'carros'],
  ['ordenador', 'computadora'],
  ['móvil', 'celular'],
  ['zumo', 'jugo'],
  ['patata', 'papa'],
  ['patatas', 'papas'],
  ['conducir', 'manejar'],
  ['coger', 'tomar / agarrar'],
  ['gafas', 'lentes'],
  ['bolígrafo', 'pluma'],
  ['aparcar', 'estacionar'],
  ['billete', 'boleto'],
  ['billetes', 'boletos'],
])
const VOSOTROS_WORDS = new Set(['vosotros', 'vosotras', 'os', 'sois', 'vais'])
const VOSOTROS_ENDING = /(áis|éis|asteis|isteis)$/
// Numbers that happen to end like a vosotros form.
const NOT_VOSOTROS = new Set(['dieciséis', 'veintiséis'])

function checkSpanish(where: string, text: unknown) {
  if (typeof text !== 'string') return
  for (const word of text.toLowerCase().split(/[^\p{L}]+/u)) {
    if (!word) continue
    if (VOSOTROS_WORDS.has(word) || (VOSOTROS_ENDING.test(word) && !NOT_VOSOTROS.has(word))) fail(where, `vosotros form "${word}"`)
    const mx = SPAIN_ONLY.get(word)
    if (mx) fail(where, `Spain-only word "${word}", use "${mx}"`)
  }
}

// ---------- verb conjugation (regular pattern) ----------

const ENDINGS: Record<StoredTense, Record<Verb['group'], string[]>> = {
  presente: {
    ar: ['o', 'as', 'a', 'amos', 'an'],
    er: ['o', 'es', 'e', 'emos', 'en'],
    ir: ['o', 'es', 'e', 'imos', 'en'],
  },
  preterito: {
    ar: ['é', 'aste', 'ó', 'amos', 'aron'],
    er: ['í', 'iste', 'ió', 'imos', 'ieron'],
    ir: ['í', 'iste', 'ió', 'imos', 'ieron'],
  },
  imperfecto: {
    ar: ['aba', 'abas', 'aba', 'ábamos', 'aban'],
    er: ['ía', 'ías', 'ía', 'íamos', 'ían'],
    ir: ['ía', 'ías', 'ía', 'íamos', 'ían'],
  },
  // Added to the whole infinitive (hablar → hablaré), not to the stem.
  futuro: {
    ar: ['é', 'ás', 'á', 'emos', 'án'],
    er: ['é', 'ás', 'á', 'emos', 'án'],
    ir: ['é', 'ás', 'á', 'emos', 'án'],
  },
}
const REFLEXIVE_PRONOUN: Record<Person, string> = { yo: 'me', tu: 'te', el: 'se', nosotros: 'nos', ellos: 'se' }

function baseInfinitive(verb: Verb) {
  return verb.reflexive ? verb.id.slice(0, -2) : verb.id
}

function regularForm(verb: Verb, tense: Tense, person: Person) {
  if (isDerived(tense)) return regularNew(verb, tense, person)
  const base = baseInfinitive(verb)
  const stem = tense === 'futuro' ? base : base.slice(0, -2)
  const form = stem + ENDINGS[tense][verb.group][PERSONS.indexOf(person)]
  return verb.reflexive ? `${REFLEXIVE_PRONOUN[person]} ${form}` : form
}

function regularGerund(verb: Verb) {
  const base = baseInfinitive(verb)
  return base.slice(0, -2) + (verb.group === 'ar' ? 'ando' : 'iendo')
}

function expandIrregular(entries: string[], where: string): Set<string> {
  const out = new Set<string>()
  for (const entry of entries) {
    const match = /^(presente|preterito|imperfecto|futuro|subjuntivo|subjImperfecto|condicional|imperativo)\.(yo|tu|el|nosotros|ellos|\*)$/.exec(entry)
    if (!match) {
      fail(where, `invalid irregularForms entry "${entry}"`)
      continue
    }
    if (match[1] === 'imperativo' && match[2] === 'yo') fail(where, 'the imperative has no yo')
    const all: Person[] = match[1] === 'imperativo' ? IMPERATIVE_PERSONS : PERSONS
    const persons = match[2] === '*' ? all : [match[2] as Person]
    for (const p of persons) out.add(`${match[1]}.${p}`)
  }
  return out
}

// ---------- topics ----------

// The app maps icon names to components statically; every topic icon must be in that map.
const topicIconSource = readFileSync(new URL('../src/components/TopicIcon.tsx', import.meta.url), 'utf8')
const topicIconMap = new Set([...topicIconSource.matchAll(/^\s*'?([a-z0-9-]+)'?: [A-Z]\w*,$/gm)].map((m) => m[1]))

checkUniqueIds(topics, 'topics')
for (const t of topics) {
  const where = `topics[${t.id}]`
  if (!/^[a-z]+(-[a-z]+)*$/.test(t.id)) fail(where, 'id must be lowercase kebab-case')
  if (!isNonEmpty(t.sk) || !isNonEmpty(t.es)) fail(where, 'missing sk/es name')
  checkSpanish(`${where}.es`, t.es)
  const iconFile = new URL(`../node_modules/lucide-react/dist/esm/icons/${t.icon}.mjs`, import.meta.url)
  if (!isNonEmpty(t.icon) || !existsSync(iconFile)) fail(where, `unknown lucide icon "${t.icon}"`)
  else if (!topicIconMap.has(t.icon)) fail(where, `icon "${t.icon}" missing in the ICONS map of src/components/TopicIcon.tsx`)
}

// ---------- verbs ----------

checkUniqueIds(verbs, 'verbs')
const verbById = new Map(verbs.map((v) => [v.id, v]))

for (const v of verbs) {
  const where = `verbs[${v.id}]`
  checkLevel(where, v.level)
  if (!Array.isArray(v.sk) || v.sk.length === 0 || !v.sk.every(isNonEmpty)) fail(where, 'sk must be a non-empty list')
  if (Boolean(v.reflexive) !== v.id.endsWith('se')) fail(where, 'reflexive flag must match the -se infinitive')
  const base = baseInfinitive(v)
  if (!['ar', 'er', 'ir'].includes(v.group) || !base.endsWith(v.group)) fail(where, `group "${v.group}" does not match "${base}"`)

  const irregular = new Set<string>()
  for (const tense of TENSES) {
    const table = v[tense]
    if (!table || typeof table !== 'object') {
      fail(where, `missing ${tense}`)
      continue
    }
    const keys = Object.keys(table)
    const extra = keys.filter((k) => !PERSONS.includes(k as Person))
    if (extra.length) fail(`${where}.${tense}`, `unexpected persons: ${extra.join(', ')}`)
    for (const p of PERSONS) {
      const form = table[p]
      if (!isNonEmpty(form)) {
        fail(`${where}.${tense}`, `missing form for "${p}"`)
        continue
      }
      checkSpanish(`${where}.${tense}.${p}`, form)
      if (form !== regularForm(v, tense, p)) irregular.add(`${tense}.${p}`)
    }
  }

  // The B1–B2 forms must be what the rules derive from the verb's own forms (src/lib/verbForms.ts):
  // a form typed or generated wrong shows up here.
  const derived = { subjuntivo: deriveSubjuntivo(v), subjImperfecto: deriveSubjImperfecto(v), condicional: deriveCondicional(v) }
  for (const tense of DERIVED_TENSES) {
    for (const p of PERSONS) {
      const form = v[tense]?.[p]
      if (form !== undefined && form !== derived[tense][p]) fail(`${where}.${tense}.${p}`, `"${form}", the rules give "${derived[tense][p]}"`)
    }
  }
  const imperativo = v.imperativo
  if (!imperativo || typeof imperativo !== 'object') fail(where, 'missing imperativo')
  else {
    const extra = Object.keys(imperativo).filter((k) => !IMPERATIVE_PERSONS.includes(k as ImperativePerson))
    if (extra.length) fail(`${where}.imperativo`, `unexpected persons: ${extra.join(', ')}`)
    const expected = deriveImperativo(v, v.subjuntivo ?? derived.subjuntivo)
    for (const p of IMPERATIVE_PERSONS) {
      const form = imperativo[p]
      if (!isNonEmpty(form)) {
        fail(`${where}.imperativo`, `missing form for "${p}"`)
        continue
      }
      checkSpanish(`${where}.imperativo.${p}`, form)
      if (form !== expected[p]) fail(`${where}.imperativo.${p}`, `"${form}", the rules give "${expected[p]}"`)
      if (form !== regularImperativo(v, p)) irregular.add(`imperativo.${p}`)
    }
  }
  if (!isNonEmpty(v.participle)) fail(where, 'missing participle')
  else {
    if (v.participle !== deriveParticiple(v)) fail(where, `participle "${v.participle}", the rules give "${deriveParticiple(v)}"`)
    if (Boolean(v.participleIrregular) !== (v.participle !== regularParticiple(v))) {
      fail(where, `participleIrregular should be ${v.participle !== regularParticiple(v)} (regular: "${regularParticiple(v)}")`)
    }
  }

  // irregularForms must list exactly the forms that deviate from the regular pattern.
  const declared = expandIrregular(v.irregularForms ?? [], where)
  const missing = [...irregular].filter((k) => !declared.has(k))
  const bogus = [...declared].filter((k) => !irregular.has(k))
  if (missing.length) fail(where, `irregular but not in irregularForms: ${missing.join(', ')}`)
  if (bogus.length) fail(where, `in irregularForms but regular: ${bogus.join(', ')}`)
  if (v.regular !== (irregular.size === 0)) {
    fail(where, `regular should be ${irregular.size === 0} (${irregular.size} irregular forms)`)
  }

  if (!isNonEmpty(v.gerund)) fail(where, 'missing gerund')
  else if (Boolean(v.gerundIrregular) !== (v.gerund !== regularGerund(v))) {
    fail(where, `gerundIrregular should be ${v.gerund !== regularGerund(v)} (regular: "${regularGerund(v)}")`)
  }
}

// ---------- words ----------

checkUniqueIds(words, 'words')
const wordsByVerb = new Map<string, number>()

for (const w of words) {
  const where = `words[${w.id}]`
  if (!isNonEmpty(w.es)) {
    fail(where, 'missing es')
    continue
  }
  const slug = slugify(w.es)
  if (w.id !== slug && !new RegExp(`^${slug}-\\d+$`).test(w.id)) fail(where, `id should be "${slug}" (or "${slug}-2"…)`)
  if (!Array.isArray(w.sk) || w.sk.length === 0 || !w.sk.every(isNonEmpty)) fail(where, 'sk must be a non-empty list')
  if (!POS.includes(w.pos)) fail(where, `invalid pos "${w.pos}"`)
  checkLevel(where, w.level)
  checkTopics(where, w.topics, false)
  checkSpanish(`${where}.es`, w.es)

  if (w.pos === 'noun') {
    if (w.gender !== 'm' && w.gender !== 'f') fail(where, 'noun needs gender m/f')
    if (!w.plural && !w.uncountable && /[^aeiouáéíóús]$/.test(w.es)) fail(where, 'noun ending in a consonant needs plural (or uncountable: true)')
    if (w.plural && w.uncountable) fail(where, 'uncountable noun cannot have a plural')
  } else if (w.gender) fail(where, 'gender is only for nouns')
  // Articles are practised by the grammar steps, not as vocab tasks (CLAUDE.md §3).
  if (w.drill !== undefined && (w.drill !== false || w.pos !== 'other')) fail(where, 'drill: false is only for articles (pos "other")')
  if (w.plural) checkSpanish(`${where}.plural`, w.plural)

  if (w.pos === 'adj' && w.es.endsWith('o') && !w.feminine) fail(where, 'adjective in -o needs feminine')
  if (w.feminine) {
    if (w.pos !== 'adj') fail(where, 'feminine is only for adjectives')
    checkSpanish(`${where}.feminine`, w.feminine)
  }

  if (!Array.isArray(w.examples) || w.examples.length < 1 || w.examples.length > 3) fail(where, 'needs 1–3 examples')
  w.examples?.forEach((ex, i) => {
    if (!isNonEmpty(ex.es) || !isNonEmpty(ex.sk)) fail(`${where}.examples[${i}]`, 'missing es/sk')
    checkSpanish(`${where}.examples[${i}]`, ex.es)
  })

  if (w.pos === 'verb') {
    const verb = w.verbId ? verbById.get(w.verbId) : undefined
    if (!verb) fail(where, `verbId "${w.verbId}" does not exist`)
    else {
      if (w.es !== verb.id) fail(where, `es "${w.es}" should equal verb id "${verb.id}"`)
      wordsByVerb.set(verb.id, (wordsByVerb.get(verb.id) ?? 0) + 1)
    }
  } else if (w.verbId) fail(where, 'verbId is only for pos "verb"')
}

for (const v of verbs) {
  const count = wordsByVerb.get(v.id) ?? 0
  if (count !== 1) fail(`verbs[${v.id}]`, `needs exactly one word entry (found ${count})`)
}

// ---------- sources ----------

checkUniqueIds(sources, 'sources')
const sourceIds = new Set(sources.map((s) => s.id))
const citedSources = new Set(tips.flatMap((t) => (Array.isArray(t.sources) ? t.sources.map((r) => r.source) : [])))
for (const s of sources) {
  const where = `sources[${s.id}]`
  if (!isNonEmpty(s.short) || !isNonEmpty(s.title) || !isNonEmpty(s.author)) fail(where, 'missing short/title/author')
  if (!Number.isInteger(s.year) || s.year < 1900 || s.year > 2100) fail(where, `implausible year ${s.year}`)
  if (s.url !== undefined && !/^https:\/\/\S+$/.test(s.url)) fail(where, 'url must be https')
  if (!citedSources.has(s.id)) fail(where, 'no tip cites it')
}

// ---------- grammar tips ----------

const SER_ESTAR = 'ser-estar'
const tipById = new Map(tips.map((t) => [t.id, t]))
// The reasons a ser/estar cloze can point at with `why`: rule id → the verb the rule is about.
const serEstarRules = new Map(tipById.get(SER_ESTAR)?.rules.map((r) => [r.id, r.verb]) ?? [])

checkUniqueIds(tips, 'tips')
for (const g of GRAMMAR) if (!tipById.has(g)) fail('tips', `no tip for the grammar tag "${g}"`)
for (const tip of tips) {
  const where = `tips[${tip.id}]`
  if (!isNonEmpty(tip.title) || !isNonEmpty(tip.intro)) fail(where, 'missing title/intro')
  checkLevel(where, tip.level)
  if (!Array.isArray(tip.sources) || tip.sources.length === 0) fail(where, 'needs at least one source')
  for (const ref of Array.isArray(tip.sources) ? tip.sources : []) {
    if (!sourceIds.has(ref.source)) fail(where, `unknown source "${ref.source}"`)
    if (!isNonEmpty(ref.where)) fail(where, `source "${ref.source}" needs where`)
  }
  // A Slovak note may name Spain-only forms (vosotros, coche), so it is not checked as Spanish.
  if (!isNonEmpty(tip.variants?.mx)) fail(where, 'needs variants.mx (how Mexico uses it)')
  for (const key of Object.keys(tip.variants ?? {})) {
    if (key !== 'mx' && key !== 'es') fail(where, `unknown Spanish variant "${key}"`)
    else if (!isNonEmpty(tip.variants[key as SpanishVariant])) fail(where, `empty variants.${key}`)
  }
  if (!Array.isArray(tip.ideas) || tip.ideas.length < 1 || tip.ideas.length > 3 || !tip.ideas.every(isNonEmpty)) fail(where, 'needs 1–3 ideas')
  if (!Array.isArray(tip.rules) || tip.rules.length === 0) {
    fail(where, 'needs at least one rule')
    continue
  }
  checkUniqueIds(tip.rules, `${where}.rules`)
  for (const rule of tip.rules) {
    const rw = `${where}.rules[${rule.id}]`
    if (!isNonEmpty(rule.title)) fail(rw, 'missing title')
    if (rule.text !== undefined && !isNonEmpty(rule.text)) fail(rw, 'empty text')
    if (!Array.isArray(rule.examples) || rule.examples.length < 1 || rule.examples.length > 3) fail(rw, 'needs 1–3 examples')
    rule.examples?.forEach((ex, i) => {
      if (!isNonEmpty(ex.es) || !isNonEmpty(ex.sk)) fail(`${rw}.examples[${i}]`, 'missing es/sk')
      checkSpanish(`${rw}.examples[${i}]`, ex.es)
    })
    // The reason shown for one blank ("Ide o pôvod, preto ser."): ser/estar and the usage tips, whose blanks name a rule.
    if (tip.id === SER_ESTAR) {
      if (rule.verb !== 'ser' && rule.verb !== 'estar') fail(rw, 'needs verb "ser" or "estar"')
    } else if (rule.verb !== undefined) fail(rw, `verb is only for the "${SER_ESTAR}" tip`)
    const saysWhy = tip.id === SER_ESTAR || USAGE_TIPS.includes(tip.id as Grammar)
    if (saysWhy && !isNonEmpty(rule.because)) fail(rw, 'needs because (shown for a blank)')
    else if (!saysWhy && rule.because !== undefined) fail(rw, 'because is only for ser-estar and the usage tips')
  }
  for (const id of tip.related ?? []) {
    if (id === tip.id) fail(where, 'related to itself')
    else if (!tipById.has(id)) fail(where, `unknown related tip "${id}"`)
  }
}

// ---------- sentences ----------

const PERSON_LABELS: Record<string, Person> = {
  yo: 'yo',
  tú: 'tu',
  él: 'el',
  ella: 'el',
  usted: 'el',
  nosotros: 'nosotros',
  nosotras: 'nosotros',
  ellos: 'ellos',
  ellas: 'ellos',
  ustedes: 'ellos',
}
const TENSE_LABELS: Record<string, Tense | 'imperativo'> = {
  presente: 'presente',
  pretérito: 'preterito',
  imperfecto: 'imperfecto',
  futuro: 'futuro',
  subjuntivo: 'subjuntivo',
  'subjuntivo imperfecto': 'subjImperfecto',
  condicional: 'condicional',
  imperativo: 'imperativo',
}

// Rebuilds the sentence from tokens: no space before .,?!;: and after ¿¡
const joinTokens = (tokens: string[]) =>
  tokens
    .join(' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/([¿¡])\s+/g, '$1')

// Returns the expected answer for a verb hint, or an error message.
function expectedFromHint(cloze: Cloze): { expected: string } | { error: string } | null {
  const hint = cloze.hint ?? ''
  const conj = /^(\S+) · (\S+) · (.+)$/.exec(hint)
  const ger = /^(\S+) · (gerundio|participio)$/.exec(hint)
  const options = (conj?.[1] ?? ger?.[1])?.split('/')
  const isVerbHint = Boolean(options?.every((o) => verbById.has(o)))

  if (!isVerbHint) {
    return verbById.has(cloze.lemma) ? { error: `verb "${cloze.lemma}" needs a hint like "${cloze.lemma} · yo · presente"` } : null
  }
  if (!options!.includes(cloze.lemma)) return { error: `lemma "${cloze.lemma}" not in hint "${hint}"` }
  const verb = verbById.get(cloze.lemma)!
  if (ger) return { expected: ger[2] === 'gerundio' ? verb.gerund : verb.participle }

  const person = PERSON_LABELS[conj![2]]
  const tense = TENSE_LABELS[conj![3]]
  if (!person) return { error: `unknown person "${conj![2]}" in hint` }
  if (!tense) return { error: `unknown tense "${conj![3]}" in hint` }
  if (tense === 'imperativo') {
    if (person === 'yo') return { error: 'the imperative has no yo' }
    return { expected: verb.imperativo[person] } // the pronoun is part of the word: levántate
  }
  const form = verb[tense][person]
  // Reflexive forms carry the pronoun ("me llamo"); the blank is just the verb token.
  return { expected: verb.reflexive ? form.split(' ').at(-1)! : form }
}

checkUniqueIds(sentences, 'sentences')
for (const s of sentences) {
  const where = `sentences[${s.id}]`
  if (!/^s\d{3,}$/.test(s.id)) fail(where, 'id must look like "s001" (after s999: "s1000")')
  if (!isNonEmpty(s.es) || !isNonEmpty(s.sk)) fail(where, 'missing es/sk')
  checkLevel(where, s.level)
  checkTopics(where, s.topics, true)
  checkSpanish(`${where}.es`, s.es)

  if (!Array.isArray(s.tokens) || s.tokens.length === 0 || !s.tokens.every(isNonEmpty)) {
    fail(where, 'tokens must be a non-empty list')
    continue
  }
  if (s.tokens.some((t) => /\s/.test(t))) fail(where, 'tokens must not contain spaces')
  if (joinTokens(s.tokens) !== s.es) fail(where, `tokens rebuild to "${joinTokens(s.tokens)}"`)

  for (const g of s.grammar ?? []) if (!GRAMMAR.includes(g)) fail(where, `invalid grammar tag "${g}"`)

  s.cloze?.forEach((c, i) => {
    const cw = `${where}.cloze[${i}]`
    if (!Number.isInteger(c.tokenIndex) || c.tokenIndex < 0 || c.tokenIndex >= s.tokens.length) {
      return fail(cw, `tokenIndex ${c.tokenIndex} out of range`)
    }
    if (s.tokens[c.tokenIndex] !== c.answer) fail(cw, `tokens[${c.tokenIndex}] is "${s.tokens[c.tokenIndex]}", not "${c.answer}"`)
    if (!isNonEmpty(c.lemma)) fail(cw, 'missing lemma')

    // "leer · yo", "gustar" and "hay/estar" leave the tense (and person) to the sentence: clozeChecks.ts checks those.
    if (!checksOwnHint(c, verbById)) {
      const result = expectedFromHint(c)
      if (result && 'error' in result) fail(cw, result.error)
      if (result && 'expected' in result && result.expected.toLowerCase() !== c.answer.toLowerCase()) {
        fail(cw, `hint "${c.hint}" gives "${result.expected}", answer is "${c.answer}"`)
      }
    }
    for (const error of usageClozeErrors(s, c, tipById, verbById)) fail(cw, error)

    // A ser/estar cloze says why it is that verb: the tip shows this reason for the sentence.
    if (c.hint?.startsWith('ser/estar ·')) {
      if (!c.why) fail(cw, 'ser/estar cloze needs `why` (a rule of the ser-estar tip)')
      else if (!serEstarRules.has(c.why)) fail(cw, `why "${c.why}" is not a rule of the ser-estar tip`)
      else if (serEstarRules.get(c.why) !== c.lemma) fail(cw, `why "${c.why}" is a rule for ${serEstarRules.get(c.why)}, the answer is ${c.lemma}`)
    } else if (c.why !== undefined && c.tip === undefined) fail(cw, '`why` is only for ser/estar clozes and blanks with `tip`')

    const distractors = c.distractors ?? []
    const lower = distractors.map((d) => d.toLowerCase())
    if (new Set(lower).size !== lower.length) fail(cw, 'duplicate distractors')
    if (lower.includes(c.answer.toLowerCase())) fail(cw, 'a distractor equals the answer')
    if (distractors.some((d) => !isNonEmpty(d))) fail(cw, 'empty distractor')
    distractors.forEach((d) => checkSpanish(`${cw}.distractors`, d))
  })
}

// ---------- guided path (src/data/path.json) ----------

const MAX_UNIT_WORDS = 20 // src/lib/pathUnits.ts
const pathUrl = new URL('path.json', DATA)
const path = (existsSync(pathUrl) ? readJson(pathUrl) : []) as PathEntry[]
const pathLevels = new Set(path.map((e) => e.level))
const partsOf = new Map<string, number[]>()
path.forEach((entry, i) => {
  const where = `path[${i}] ${entry.topic}:${entry.level}:${entry.part}`
  checkLevel(where, entry.level)
  if (!topicIds.has(entry.topic)) fail(where, `unknown topic "${entry.topic}"`)
  if (!Number.isInteger(entry.part) || entry.part < 1) fail(where, 'part must be 1, 2…')
  const tip = tipById.get(entry.grammar)
  if (!tip) fail(where, `unknown tip "${entry.grammar}"`)
  for (const rule of entry.rules ?? []) if (tip && !tip.rules.some((r) => r.id === rule)) fail(where, `tip "${entry.grammar}" has no rule "${rule}"`)
  const previous = path[i - 1]
  const point = (e: PathEntry) => `${e.grammar}|${(e.rules ?? []).join(',')}`
  if (previous && point(previous) === point(entry)) fail(where, 'the same grammar point as the unit before it')
  const key = `${entry.topic}:${entry.level}`
  partsOf.set(key, [...(partsOf.get(key) ?? []), entry.part])
})
for (const [key, parts] of partsOf) {
  const sorted = [...parts].sort((a, b) => a - b)
  if (sorted.some((part, i) => part !== i + 1)) fail(`path ${key}`, `parts must be 1…${parts.length} once each, not ${parts.join(', ')}`)
  const [topic, level] = key.split(':')
  const count = words.filter((w) => w.level === level && w.topics[0] === topic && w.drill !== false).length
  // pathUnits.ts splits the words evenly: the biggest part has ceil(count / parts).
  if (Math.ceil(count / parts.length) > MAX_UNIT_WORDS) fail(`path ${key}`, `${count} words in ${parts.length} part(s): more than ${MAX_UNIT_WORDS} in a unit, add a part`)
}
// Every word and sentence of a level on the path is in a unit (under its first topic; a verb without
// a topic is not, the grammar steps conjugate it).
for (const level of pathLevels) {
  for (const item of [...words, ...sentences]) {
    if (item.level === level && item.topics.length > 0 && !partsOf.has(`${item.topics[0]}:${level}`)) fail(`path ${level}`, `no unit for topic "${item.topics[0]}" (${item.id})`)
  }
}

// ---------- English overlay (src/data/en) ----------
// Matched to the base data by id. Missing English is not an error (the app shows Slovak);
// English that points at nothing, or does not fit what it translates, is.

function loadEnDir<T>(dir: string): T[] {
  return existsSync(new URL(`en/${dir}/`, DATA)) ? loadDir<T>(`en/${dir}`) : []
}
function loadEnFile<T>(file: string): T[] {
  const url = new URL(`en/${file}`, DATA)
  return existsSync(url) ? (readJson(url) as T[]) : []
}

const enWords = loadEnDir<WordEn>('words')
const enVerbs = loadEnDir<VerbEn>('verbs')
const enSentences = loadEnDir<SentenceEn>('sentences')
const enTopics = loadEnFile<TopicEn>('topics.json')
const enTips = loadEnFile<TipEn>('tips.json')

const isTextList = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.every(isNonEmpty)

checkUniqueIds(enWords, 'en/words')
const wordsById = new Map(words.map((w) => [w.id, w]))
for (const entry of enWords) {
  const where = `en/words[${entry.id}]`
  const word = wordsById.get(entry.id)
  if (!word) {
    fail(where, 'no such word')
    continue
  }
  if (!isTextList(entry.en)) fail(where, 'needs `en`: at least one translation')
  if (entry.examples !== undefined && (!isTextList(entry.examples) || entry.examples.length !== word.examples.length)) {
    fail(where, `examples must translate the word's ${word.examples.length} example(s), in order`)
  }
  if (entry.note !== undefined && !isNonEmpty(entry.note)) fail(where, 'empty note')
}

checkUniqueIds(enVerbs, 'en/verbs')
const verbIds = new Set(verbs.map((v) => v.id))
for (const entry of enVerbs) {
  const where = `en/verbs[${entry.id}]`
  if (!verbIds.has(entry.id)) fail(where, 'no such verb')
  if (!isTextList(entry.en)) fail(where, 'needs `en`: at least one translation')
}

checkUniqueIds(enSentences, 'en/sentences')
const sentencesById = new Map(sentences.map((s) => [s.id, s]))
for (const entry of enSentences) {
  const where = `en/sentences[${entry.id}]`
  const sentence = sentencesById.get(entry.id)
  if (!sentence) {
    fail(where, 'no such sentence')
    continue
  }
  if (!isNonEmpty(entry.en)) fail(where, 'missing `en`')
  const clozes = sentence.cloze ?? []
  if (entry.hints !== undefined && (!Array.isArray(entry.hints) || entry.hints.length !== clozes.length)) {
    fail(where, `hints must have one entry per cloze (${clozes.length})`)
    continue
  }
  clozes.forEach((cloze, i) => {
    const hint = entry.hints?.[i]
    if (hint !== undefined && hint !== null && !isNonEmpty(hint)) fail(where, `hints[${i}] is empty`)
    // "tener · yo · pretérito" and "gustar" read the same in any language; "člen" or "leto" does not.
    const slovak = cloze.hint !== undefined && !cloze.hint.includes(' · ') && usageHint(cloze, verbById).kind === 'other'
    if (slovak && !isNonEmpty(hint)) fail(where, `the hint "${cloze.hint}" of cloze ${i} needs an English one in hints[${i}]`)
  })
}

checkUniqueIds(enTopics, 'en/topics')
for (const entry of enTopics) {
  if (!topicIds.has(entry.id)) fail(`en/topics[${entry.id}]`, 'no such topic')
  if (!isNonEmpty(entry.en)) fail(`en/topics[${entry.id}]`, 'missing `en`')
}

checkUniqueIds(enTips, 'en/tips')
for (const entry of enTips) {
  const where = `en/tips[${entry.id}]`
  const tip = tipById.get(entry.id)
  if (!tip) {
    fail(where, 'no such tip')
    continue
  }
  if (!isNonEmpty(entry.title) || !isNonEmpty(entry.intro)) fail(where, 'missing title/intro')
  for (const key of Object.keys(tip.variants ?? {}) as SpanishVariant[]) {
    if (!isNonEmpty(entry.variants?.[key])) fail(where, `needs variants.${key}, like the Slovak tip`)
  }
  for (const key of Object.keys(entry.variants ?? {})) {
    if (!(key in (tip.variants ?? {}))) fail(where, `variants.${key} has no Slovak note`)
  }
  const ruleIds = (entry.rules ?? []).map((r) => r.id).join(', ')
  if (ruleIds !== tip.rules.map((r) => r.id).join(', ')) {
    fail(where, `rules must be the tip's own, in its order: ${tip.rules.map((r) => r.id).join(', ')}`)
    continue
  }
  entry.rules.forEach((rule, i) => {
    const rw = `${where}.rules[${rule.id}]`
    const base = tip.rules[i]
    if (!isNonEmpty(rule.title)) fail(rw, 'missing title')
    if (rule.text !== undefined && !isNonEmpty(rule.text)) fail(rw, 'empty text')
    if (!isTextList(rule.examples) || rule.examples.length !== base.examples.length) {
      fail(rw, `examples must translate the rule's ${base.examples.length} example(s), in order`)
    }
    if (Boolean(base.because) !== isNonEmpty(rule.because)) fail(rw, base.because ? 'needs because' : 'because is only where the Slovak rule has one')
  })
}

// ---------- report ----------

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s) in src/data:\n`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

const clozeCount = sentences.reduce((n, s) => n + (s.cloze?.length ?? 0), 0)
console.log(
  `✓ Data OK — ${topics.length} topics, ${words.length} words, ${verbs.length} verbs, ` +
    `${sentences.length} sentences (${clozeCount} cloze), ${tips.length} tips`,
)

// How much of the content has English, per topic (a word counts under its first topic).
const share = (done: number, total: number) => `${done}/${total}`
const enWordIds = new Set(enWords.map((e) => e.id))
const enSentenceIds = new Set(enSentences.map((e) => e.id))
console.log(
  `  English: ${share(enWords.length, words.length)} words, ${share(enVerbs.length, verbs.length)} verbs, ` +
    `${share(enSentences.length, sentences.length)} sentences, ${share(enTopics.length, topics.length)} topic names, ${share(enTips.length, tips.length)} tips`,
)
for (const topic of topics) {
  const topicWords = words.filter((w) => w.topics[0] === topic.id)
  const topicSentences = sentences.filter((s) => s.topics[0] === topic.id)
  const doneWords = topicWords.filter((w) => enWordIds.has(w.id)).length
  const doneSentences = topicSentences.filter((s) => enSentenceIds.has(s.id)).length
  if (doneWords + doneSentences === 0) continue
  console.log(`    ${topic.id}: ${share(doneWords, topicWords.length)} words, ${share(doneSentences, topicSentences.length)} sentences`)
}
