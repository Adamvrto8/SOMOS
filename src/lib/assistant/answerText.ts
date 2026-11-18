import { tipById, topicById, verbById, wordById } from '../../data'
import { TABLE_TENSES, type TableTense } from '../conjugate'

export type AnswerPart = { type: 'text'; text: string } | { type: 'link'; label: string; to: string }

/**
 * A card the app draws from its own data where the model wrote a marker (docs/chat-assistant-improvements.md S1): the
 * model never writes the forms or the word itself, so they cannot be made up.
 */
export type AnswerCard =
  | { type: 'conj'; verbId: string; tense: TableTense }
  | { type: 'word'; id: string }
  | { type: 'tip'; id: string }

export type AnswerBlock = { type: 'text'; parts: AnswerPart[] } | { type: 'card'; card: AnswerCard }

// The prompt asks for links woven into the sentence as `[label](/path)`. A bare path the model still writes
// (`/word/casa`) becomes a link too, so nothing in-app is left untappable. A path is an app path: one slash,
// then no second one (never `//host`), and no dots, so a full stop after it stays text.
const MARKDOWN_LINK = String.raw`\[([^\]\n]+)\]\((\/(?!\/)[\w\-/?=&%]*)\)`
const BARE_PATH = String.raw`(?<![\w/])(\/(?:word|topic|practice|review|diary|search|archive|profile|stats|path|privacy|duel)(?![\w-])[\w\-/?=&%]*)`
const LINKS = new RegExp(`${MARKDOWN_LINK}|${BARE_PATH}`, 'g')

/** `{{conj:tener:preterito}}`, `{{word:casa}}`, `{{tip:por-para}}`; anything else in double braces is a marker gone wrong. */
export const MARKER = /\{\{\s*([^{}\n]*?)\s*\}\}/g

/** The screens of src/App.tsx a link may open; an id must exist in the data (a made-up one opened an empty page). */
const STATIC_PATHS = new Set([
  '/',
  '/stats',
  '/search',
  '/practice',
  '/path',
  '/practice/grammar',
  '/practice/tests',
  '/practice/lesson',
  '/practice/test',
  '/duel',
  '/archive',
  '/archive/new',
  '/diary',
  '/profile',
  '/profile/stats',
  '/review',
  '/privacy',
])

/** Whether an in-app link of an answer leads to a real page. */
export function appPathExists(to: string): boolean {
  const path = to.split(/[?#]/)[0].replace(/(.)\/$/, '$1')
  if (STATIC_PATHS.has(path)) return true
  const [, first, second, third, fourth] = path.split('/')
  if (fourth !== undefined || !second) return false
  if (first === 'word' && !third) return wordById.has(second)
  if (first === 'topic' && !third) return topicById.has(second)
  if (first === 'practice' && second === 'grammar' && third) return tipById.has(third)
  if (first === 'diary' && !third) return /^\d{4}-\d{2}-\d{2}$/.test(second)
  if (first === 'profile' && !third) return /^[a-z-]+$/.test(second)
  return false
}

/** A marker's card, or undefined when it names nothing the app has. */
export function cardOf(marker: string): AnswerCard | undefined {
  const [kind, id, tense, ...rest] = marker.split(':').map((part) => part.trim())
  if (rest.length || !id) return undefined
  if (kind === 'word' && tense === undefined) return wordById.has(id) ? { type: 'word', id } : undefined
  if (kind === 'tip' && tense === undefined) return tipById.has(id) ? { type: 'tip', id } : undefined
  if (kind === 'conj') {
    const known = TABLE_TENSES.find((t) => t === tense)
    return known && verbById.has(id) ? { type: 'conj', verbId: id, tense: known } : undefined
  }
  return undefined
}

/** Bold markers go: the prompt asks for no Markdown, but a model slips. */
const unbold = (text: string) => text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1')

/** An answer as text and in-app links, in order. A link to a page that does not exist stays its label. */
export function answerParts(text: string): AnswerPart[] {
  const plain = unbold(text)
  const parts: AnswerPart[] = []
  const push = (piece: string) => {
    const previous = parts.at(-1)
    if (previous?.type === 'text') previous.text += piece
    else parts.push({ type: 'text', text: piece })
  }
  let last = 0
  for (const match of plain.matchAll(LINKS)) {
    const [whole, label, labelled, bare] = match
    if (match.index > last) push(plain.slice(last, match.index))
    const link = labelled !== undefined ? { label: label.trim(), to: labelled } : { label: bare, to: bare }
    if (appPathExists(link.to)) parts.push({ type: 'link', ...link })
    else push(link.label)
    last = match.index + whole.length
  }
  if (last < plain.length) push(plain.slice(last))
  return parts
}

/**
 * An answer as paragraphs and cards, in the order the model wrote them. A marker that names nothing is left out (the
 * check in answerCheck.ts has already asked the model once to fix it); the text around it stays.
 */
export function answerBlocks(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = []
  const pushText = (piece: string) => {
    const trimmed = piece.trim()
    if (trimmed) blocks.push({ type: 'text', parts: answerParts(trimmed) })
  }
  let last = 0
  for (const match of text.matchAll(MARKER)) {
    pushText(text.slice(last, match.index))
    const card = cardOf(match[1])
    if (card) blocks.push({ type: 'card', card })
    last = match.index + match[0].length
  }
  pushText(text.slice(last))
  return blocks
}
