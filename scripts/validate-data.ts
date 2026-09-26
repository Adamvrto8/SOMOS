// Validates static content in src/data. Run with `npm run validate:data`.
// Exits with code 1 and lists every problem if anything is wrong.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import type { Cloze, Level, Person, Sentence, Tense, Topic, Verb, Word } from '../src/data/types.ts'

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

const errors: string[] = []
const fail = (where: string, message: string) => errors.push(`${where}: ${message}`)

const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2']
const PERSONS: Person[] = ['yo', 'tu', 'el', 'nosotros', 'ellos']
const TENSES: Tense[] = ['presente', 'preterito', 'imperfecto', 'futuro']
const POS = ['noun', 'verb', 'adj', 'adv', 'prep', 'pron', 'conj', 'phrase', 'other']
const GRAMMAR = ['presente', 'progresivo', 'preterito', 'imperfecto', 'futuro', 'ser-estar', 'gender', 'articles']

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

const ENDINGS: Record<Tense, Record<Verb['group'], string[]>> = {
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
    const match = /^(presente|preterito|imperfecto|futuro)\.(yo|tu|el|nosotros|ellos|\*)$/.exec(entry)
    if (!match) {
      fail(where, `invalid irregularForms entry "${entry}"`)
      continue
    }
    const persons = match[2] === '*' ? PERSONS : [match[2] as Person]
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
const TENSE_LABELS: Record<string, Tense> = {
  presente: 'presente',
  pretérito: 'preterito',
  imperfecto: 'imperfecto',
  futuro: 'futuro',
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
  const conj = /^(\S+) · (\S+) · (\S+)$/.exec(hint)
  const ger = /^(\S+) · gerundio$/.exec(hint)
  const options = (conj?.[1] ?? ger?.[1])?.split('/')
  const isVerbHint = Boolean(options?.every((o) => verbById.has(o)))

  if (!isVerbHint) {
    return verbById.has(cloze.lemma) ? { error: `verb "${cloze.lemma}" needs a hint like "${cloze.lemma} · yo · presente"` } : null
  }
  if (!options!.includes(cloze.lemma)) return { error: `lemma "${cloze.lemma}" not in hint "${hint}"` }
  const verb = verbById.get(cloze.lemma)!
  if (ger) return { expected: verb.gerund }

  const person = PERSON_LABELS[conj![2]]
  const tense = TENSE_LABELS[conj![3]]
  if (!person) return { error: `unknown person "${conj![2]}" in hint` }
  if (!tense) return { error: `unknown tense "${conj![3]}" in hint` }
  const form = verb[tense][person]
  // Reflexive forms carry the pronoun ("me llamo"); the blank is just the verb token.
  return { expected: verb.reflexive ? form.split(' ').at(-1)! : form }
}

checkUniqueIds(sentences, 'sentences')
for (const s of sentences) {
  const where = `sentences[${s.id}]`
  if (!/^s\d{3}$/.test(s.id)) fail(where, 'id must look like "s001"')
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

    const result = expectedFromHint(c)
    if (result && 'error' in result) fail(cw, result.error)
    if (result && 'expected' in result && result.expected.toLowerCase() !== c.answer.toLowerCase()) {
      fail(cw, `hint "${c.hint}" gives "${result.expected}", answer is "${c.answer}"`)
    }

    const distractors = c.distractors ?? []
    const lower = distractors.map((d) => d.toLowerCase())
    if (new Set(lower).size !== lower.length) fail(cw, 'duplicate distractors')
    if (lower.includes(c.answer.toLowerCase())) fail(cw, 'a distractor equals the answer')
    if (distractors.some((d) => !isNonEmpty(d))) fail(cw, 'empty distractor')
    distractors.forEach((d) => checkSpanish(`${cw}.distractors`, d))
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
    `${sentences.length} sentences (${clozeCount} cloze)`,
)
