import { tips, topicById, verbById, wordIdByVerb } from '../../data'
import type { Tip, Verb, Word } from '../../data/types'
import { conjugate, formText, PERSON_LABELS, personsOf, TABLE_TENSES, type TableTense } from '../conjugate'
import { localizedTip, topicName, verbTranslations, wordExamples, wordTranslations } from '../localized'
import { searchWords, type SearchFilter } from '../search'
import { fold } from '../text'
import { rankTips } from '../tipSearch'
import { cutAt } from './learner'
import { loadRecordsInput, RECORD_KINDS, recordsOf, type RecordKind } from './records'

// The tools the assistant's model may call (their schemas live in api/chat.ts; the names must match, a test checks it).
// They only read the data bundled with the app, in the learner's variant (Mexico / Spain) and language.
// Results carry `card` markers ({{word:casa}}, {{conj:tener:preterito}}, {{tip:por-para}}): the model puts one on its own
// line and the chat draws it from the data (answerText.ts), so forms and words are never retyped by the model.

export interface ToolOutcome {
  content: string
  isError: boolean
}

/** What one tool result may weigh: the server takes 6 000 characters, but the model needs far less. */
export const MAX_TOOL_OUTPUT = 2000

/** A wrong input from the model: reported back to it as an error result, never thrown to the screen. */
class ToolInputError extends Error {}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

function required(input: Record<string, unknown>, key: string): string {
  const value = text(input[key])
  if (!value) throw new ToolInputError(`"${key}" must be a non-empty string`)
  return value
}

/** The word's first example from the app ("es – translation"), so the model quotes one instead of making it up. */
function firstExample(word: Word): string | undefined {
  const example = wordExamples(word)[0]
  return example ? `${example.es} – ${example.text}` : undefined
}

/**
 * Tip examples that use a word the dictionary lacks ("problema" → gender, "Mužské koncovky", "el problema"), shortest
 * first: the model then answers from the app's rule instead of guessing (it once said "la problema", eval run 2).
 */
function tipsUsing(query: string): { id: string; title: string; rule: string; example: string; link: string }[] {
  const wanted = fold(query)
  const tokens = (text: string) => fold(text).split(/[^a-z0-9ñ]+/)
  const hits: { id: string; title: string; rule: string; example: string; link: string }[] = []
  for (const tip of tips) {
    const local = localizedTip(tip)
    for (const rule of local.rules) {
      const example = rule.examples.find((e) => tokens(e.es).some((t) => t === wanted || t === `${wanted}s` || t === `${wanted}es`))
      if (example) {
        hits.push({ id: tip.id, title: local.title, rule: rule.title, example: `${example.es} – ${example.text}`, link: `/practice/grammar/${tip.id}` })
        break
      }
    }
  }
  return hits.sort((a, b) => a.example.length - b.example.length).slice(0, 3)
}

const FILTERS: SearchFilter[] = ['all', 'verb', 'noun', 'phrase']

function searchWord(input: Record<string, unknown>): unknown {
  const query = required(input, 'query')
  const filter = FILTERS.find((f) => f === input.filter) ?? 'all'
  const all = searchWords(query, filter)
  if (all.length === 0) {
    const inTips = tipsUsing(query)
    return inTips.length ? { found: false, inTips } : { found: false }
  }
  // An exact match (the Spanish word, a translation or a form) hides the fuzzy neighbours: "pes" gives perro, not
  // pesar, peso and pescar, which the model would otherwise list as "similar words".
  const wanted = fold(query)
  const exact = all.filter(
    ({ word, matchedForm }) =>
      fold(word.es) === wanted || wordTranslations(word).some((t) => fold(t) === wanted) || (matchedForm !== undefined && fold(matchedForm) === wanted),
  )
  const hits = (exact.length > 0 ? exact : all).slice(0, 5)
  // No exact word: the neighbours are other words, so say where the app itself uses the asked one.
  const inTips = exact.length === 0 ? tipsUsing(query) : []
  return {
    found: true,
    ...(inTips.length ? { inTips } : {}),
    results: hits.map(({ word, matchedForm, otherForm }) => ({
      es: word.es,
      translations: wordTranslations(word),
      pos: word.pos,
      gender: word.gender,
      plural: word.plural,
      level: word.level,
      matchedForm,
      otherForm,
      example: firstExample(word),
      // The word's own topics: the model once linked carro to travel instead of city.
      topics: word.topics.flatMap((id) => {
        const topic = topicById.get(id)
        return topic ? [{ name: topicName(topic), link: `/topic/${id}` }] : []
      }),
      link: `/word/${word.id}`,
      card: `{{word:${word.id}}}`,
    })),
  }
}

const DEFAULT_TENSES: TableTense[] = ['presente', 'preterito', 'imperfecto', 'futuro']

const FORM_TENSES = ['presente', 'preterito', 'imperfecto', 'futuro', 'subjuntivo', 'subjImperfecto', 'condicional', 'imperativo'] as const
const REFLEXIVE_PRONOUN = /^(?:me|te|se|nos) /

/** Every written form of a verb (without reflexive pronouns), folded: what a learner may type for it. */
function formsOf(verb: Verb): Set<string> {
  const forms = [verb.id, verb.gerund, verb.participle]
  for (const tense of FORM_TENSES) forms.push(...Object.values(verb[tense]))
  return new Set(forms.map((form) => fold(form).replace(REFLEXIVE_PRONOUN, '')))
}

/**
 * The verb for an infinitive, a reflexive infinitive ("levantarse") or a conjugated form ("fui"). A search hit counts only
 * when the query really is one of the verb's forms: a fuzzy match to another verb would be an invented answer.
 */
function resolveVerb(query: string): Verb | undefined {
  const asked = fold(query).replace(REFLEXIVE_PRONOUN, '')
  const direct = verbById.get(query.toLowerCase()) ?? verbById.get(asked)
  if (direct) return direct
  const matches: Verb[] = []
  for (const hit of searchWords(asked, 'verb')) {
    const verb = hit.word.verbId ? verbById.get(hit.word.verbId) : undefined
    if (verb && (formsOf(verb).has(asked) || fold(verb.id) + 'se' === asked)) matches.push(verb)
  }
  // "me llamo" is llamarse, a bare "llamo" is llamar: the pronoun in the query decides between look-alikes.
  const reflexive = REFLEXIVE_PRONOUN.test(fold(query))
  const match = matches.find((verb) => Boolean(verb.reflexive) === reflexive) ?? matches[0]
  if (match) return match
  // "levantarse" may be stored as "levantarse" or only as "levantar".
  const base = asked.replace(/se$/, '')
  return base !== asked ? verbById.get(base) : undefined
}

function getConjugation(input: Record<string, unknown>): unknown {
  const query = required(input, 'verb')
  const asked = text(input.tense)
  if (asked && !TABLE_TENSES.includes(asked as TableTense)) {
    throw new ToolInputError(`"tense" must be one of: ${TABLE_TENSES.join(', ')}`)
  }
  const verb = resolveVerb(query)
  const estar = verbById.get('estar')
  if (!verb || !estar) return { found: false }

  const tenses = asked ? [asked as TableTense] : DEFAULT_TENSES
  const irregular: string[] = []
  const table: Record<string, Record<string, string>> = {}
  for (const tense of tenses) {
    table[tense] = {}
    for (const person of personsOf(tense)) {
      const parts = conjugate(verb, tense, person, estar)
      table[tense][PERSON_LABELS[person]] = formText(parts)
      if (parts.some((part) => part.irregular)) irregular.push(`${tense}.${person}`)
    }
  }
  const wordId = wordIdByVerb.get(verb.id)
  return {
    found: true,
    verb: verb.id,
    cards: Object.fromEntries(tenses.map((tense) => [tense, `{{conj:${verb.id}:${tense}}}`])),
    translations: verbTranslations(verb),
    regular: verb.regular,
    gerund: verb.gerund,
    participle: verb.participle,
    tenses: table,
    irregular,
    link: wordId ? `/word/${wordId}` : undefined,
  }
}

/** Tips as the model reads them, shrunk until the JSON fits, so it stays valid instead of being cut in the middle. */
function tipResult(found: Tip[]): unknown {
  const build = (tipCount: number, ruleCount: number) => ({
    found: true,
    tips: found.slice(0, tipCount).map((tip) => {
      const local = localizedTip(tip)
      return {
        id: tip.id,
        title: local.title,
        level: local.level,
        intro: local.intro,
        rules: local.rules.slice(0, ruleCount).map((rule) => ({
          title: rule.title,
          text: rule.text,
          examples: rule.examples.slice(0, 2).map((example) => `${example.es} – ${example.text}`),
        })),
        variantNote: local.variantNote,
        sources: local.sources,
        link: `/practice/grammar/${tip.id}`,
        card: `{{tip:${tip.id}}}`,
      }
    }),
  })
  for (const [tipCount, ruleCount] of [[2, 6], [1, 6], [1, 4], [1, 2], [1, 1]]) {
    const result = build(tipCount, ruleCount)
    if (JSON.stringify(result).length <= MAX_TOOL_OUTPUT) return result
  }
  return build(1, 1)
}

const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const

function getGrammarTip(input: Record<string, unknown>): unknown {
  // An id from the app map: exact, the way the model should ask.
  const id = text(input.id)
  if (id) {
    const tip = tips.find((candidate) => candidate.id === id)
    return tip ? tipResult([tip]) : { found: false, hint: 'Tip s týmto id nie je. Id sú v zozname tipov v mape appky; alebo skús query.' }
  }
  // A level alone lists that level's tips by title ("aké časy sú na A1"), without their contents.
  const level = LEVELS.find((l) => l === text(input.level).toUpperCase())
  const query = text(input.query)
  if (level && !query) {
    const atLevel = tips.map(localizedTip).filter((tip) => tip.level === level)
    return { found: atLevel.length > 0, level, count: atLevel.length, tips: atLevel.map((tip) => ({ id: tip.id, title: tip.title, link: `/practice/grammar/${tip.id}` })) }
  }
  if (!query) throw new ToolInputError('give "id", "query" or "level"')
  const found = rankTips(tips, query).slice(0, 2)
  return found.length ? tipResult(found) : { found: false }
}

async function getMyRecords(input: Record<string, unknown>): Promise<unknown> {
  const kind = RECORD_KINDS.find((k): k is RecordKind => k === input.kind)
  if (!kind) throw new ToolInputError(`"kind" must be one of: ${RECORD_KINDS.join(', ')}`)
  const limit = typeof input.limit === 'number' && Number.isInteger(input.limit) ? Math.min(20, Math.max(1, input.limit)) : 10
  const items = recordsOf(kind, await loadRecordsInput(kind), limit)
  // Drop the oldest until the JSON fits whole.
  while (items.length > 1 && JSON.stringify({ kind, count: items.length, items }).length > MAX_TOOL_OUTPUT) items.pop()
  return { kind, count: items.length, items }
}

export const TOOL_HANDLERS: Record<string, (input: Record<string, unknown>) => unknown> = {
  search_word: searchWord,
  get_conjugation: getConjugation,
  get_grammar_tip: getGrammarTip,
  get_my_records: getMyRecords,
}

export const cap = (value: string) => (value.length <= MAX_TOOL_OUTPUT ? value : `${cutAt(value, MAX_TOOL_OUTPUT)} …[skrátené]`)

/** Runs one tool call of the model; every failure comes back as an error result the model can read. */
export async function runTool(name: string, input: unknown): Promise<ToolOutcome> {
  const handler = Object.hasOwn(TOOL_HANDLERS, name) ? TOOL_HANDLERS[name] : undefined
  if (!handler) return { content: `Unknown tool: ${name}`, isError: true }
  try {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new ToolInputError('the input must be an object')
    return { content: cap(JSON.stringify(await handler(input as Record<string, unknown>))), isError: false }
  } catch (error) {
    if (error instanceof ToolInputError) return { content: error.message, isError: true }
    console.error('assistant tool failed', name, error)
    return { content: 'The tool failed.', isError: true }
  }
}
