import { tips, verbById, wordIdByVerb } from '../../data'
import type { Verb } from '../../data/types'
import { conjugate, formText, PERSON_LABELS, personsOf, TABLE_TENSES, type TableTense } from '../conjugate'
import { localizedTip, verbTranslations, wordTranslations } from '../localized'
import { searchWords, type SearchFilter } from '../search'
import { fold } from '../text'
import { searchTips } from '../tipSearch'
import { appHelp } from './appHelp'

// The tools the assistant's model may call (their schemas live in api/chat.ts; the names must match, a test checks it).
// They only read the data bundled with the app, in the learner's variant (Mexico / Spain) and language.

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

const FILTERS: SearchFilter[] = ['all', 'verb', 'noun', 'phrase']

function searchWord(input: Record<string, unknown>): unknown {
  const query = required(input, 'query')
  const filter = FILTERS.find((f) => f === input.filter) ?? 'all'
  const hits = searchWords(query, filter).slice(0, 5)
  if (hits.length === 0) return { found: false }
  return {
    found: true,
    results: hits.map(({ word, matchedForm, otherForm }) => ({
      es: word.es,
      translations: wordTranslations(word),
      pos: word.pos,
      gender: word.gender,
      plural: word.plural,
      level: word.level,
      matchedForm,
      otherForm,
      link: `/word/${word.id}`,
    })),
  }
}

const DEFAULT_TENSES: TableTense[] = ['presente', 'preterito', 'imperfecto', 'futuro']

/** The verb for an infinitive, a reflexive infinitive ("levantarse") or a conjugated form ("fui"). */
function resolveVerb(query: string): Verb | undefined {
  const direct = verbById.get(query.toLowerCase())
  if (direct) return direct
  for (const hit of searchWords(query, 'verb')) {
    const verb = hit.word.verbId ? verbById.get(hit.word.verbId) : undefined
    if (verb) return verb
  }
  // "levantarse" may be stored as "levantarse" or only as "levantar".
  const base = fold(query).replace(/se$/, '')
  return base !== fold(query) ? verbById.get(base) : undefined
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
    translations: verbTranslations(verb),
    regular: verb.regular,
    gerund: verb.gerund,
    participle: verb.participle,
    tenses: table,
    irregular,
    link: wordId ? `/word/${wordId}` : undefined,
  }
}

function getGrammarTip(input: Record<string, unknown>): unknown {
  const query = required(input, 'query')
  const found = searchTips(tips, query).slice(0, 2)
  if (found.length === 0) return { found: false }
  const build = (tipCount: number, ruleCount: number) => ({
    found: true,
    tips: found.slice(0, tipCount).map((tip) => {
      const local = localizedTip(tip)
      return {
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
      }
    }),
  })
  // Shrink the answer until it fits, so the JSON stays valid instead of being cut in the middle.
  for (const [tipCount, ruleCount] of [[2, 6], [1, 6], [1, 4], [1, 2], [1, 1]]) {
    const result = build(tipCount, ruleCount)
    if (JSON.stringify(result).length <= MAX_TOOL_OUTPUT) return result
  }
  return build(1, 1)
}

function appHelpTool(input: Record<string, unknown>): unknown {
  return appHelp(text(input.topic))
}

export const TOOL_HANDLERS: Record<string, (input: Record<string, unknown>) => unknown> = {
  search_word: searchWord,
  get_conjugation: getConjugation,
  get_grammar_tip: getGrammarTip,
  app_help: appHelpTool,
}

const cap = (value: string) => (value.length <= MAX_TOOL_OUTPUT ? value : `${value.slice(0, MAX_TOOL_OUTPUT)} …[skrátené]`)

/** Runs one tool call of the model; every failure comes back as an error result the model can read. */
export function runTool(name: string, input: unknown): ToolOutcome {
  const handler = Object.hasOwn(TOOL_HANDLERS, name) ? TOOL_HANDLERS[name] : undefined
  if (!handler) return { content: `Unknown tool: ${name}`, isError: true }
  try {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new ToolInputError('the input must be an object')
    return { content: cap(JSON.stringify(handler(input as Record<string, unknown>))), isError: false }
  } catch (error) {
    if (error instanceof ToolInputError) return { content: error.message, isError: true }
    console.error('assistant tool failed', name, error)
    return { content: 'The tool failed.', isError: true }
  }
}
