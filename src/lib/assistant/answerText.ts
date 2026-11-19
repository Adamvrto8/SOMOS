import { tipById, topicById, verbById, wordById } from '../../data'
import { TABLE_TENSES, type TableTense } from '../conjugate'

export type AnswerPart = { type: 'text'; text: string } | { type: 'strong'; text: string } | { type: 'link'; label: string; to: string }

/**
 * A card the app draws from its own data where the model wrote a marker (docs/chat-assistant-improvements.md S1): the
 * model never writes the forms or the word itself, so they cannot be made up.
 */
export type AnswerCard =
  | { type: 'conj'; verbId: string; tense: TableTense }
  | { type: 'word'; id: string }
  | { type: 'tip'; id: string }

/** A line "- Tengo un carro. – Mám auto." is an example: Spanish above, the translation under it; any other is an item. */
export type ListItem = { type: 'example'; es: string; text: string } | { type: 'item'; parts: AnswerPart[] }

export type AnswerBlock = { type: 'text'; parts: AnswerPart[] } | { type: 'list'; items: ListItem[] } | { type: 'card'; card: AnswerCard }

// The prompt asks for links woven into the sentence as `[label](/path)`. A bare path the model still writes
// (`/word/casa`) becomes a link too, so nothing in-app is left untappable. A path is an app path: one slash,
// then no second one (never `//host`), and no dots, so a full stop after it stays text.
const MARKDOWN_LINK = String.raw`\[([^\]\n]+)\]\((\/(?!\/)[\w\-/?=&%]*)\)`
const BARE_PATH = String.raw`(?<![\w/])(\/(?:word|topic|practice|review|diary|search|archive|profile|stats|path|privacy|duel)(?![\w-])[\w\-/?=&%]*)`
const LINKS = new RegExp(`${MARKDOWN_LINK}|${BARE_PATH}`, 'g')

/** `{{conj:tener:preterito}}`, `{{word:casa}}`, `{{tip:por-para}}`, `{{dalej:…}}`; anything else is a marker gone wrong. */
export const MARKER = /\{\{\s*([^{}\n]*?)\s*\}\}/g

/** Follow-up questions the model may offer at the end, `{{dalej:…}}`, shown as chips under the newest answer. */
export const MAX_FOLLOW_UPS = 2
const MAX_FOLLOW_UP_CHARS = 120
const FOLLOW_UP = /^dalej\s*:\s*(.+)$/

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

/** A marker that is a follow-up question: its question, else undefined. */
export function followUpOf(marker: string): string | undefined {
  const question = FOLLOW_UP.exec(marker)?.[1].trim()
  return question && question.length <= MAX_FOLLOW_UP_CHARS ? question : undefined
}

/** The follow-up questions of an answer, at most MAX_FOLLOW_UPS. */
export function followUpsOf(text: string): string[] {
  const questions: string[] = []
  for (const match of text.matchAll(MARKER)) {
    const question = followUpOf(match[1])
    if (question && !questions.includes(question)) questions.push(question)
  }
  return questions.slice(0, MAX_FOLLOW_UPS)
}

const sameQuestion = (question: string) => question.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/**
 * The follow-ups of the newest answer that the chat has not asked or offered before: run 5 repeated a chip from the
 * previous answer under an unrelated one.
 */
export function freshFollowUps(turns: readonly { question: string; answer: string }[]): string[] {
  const last = turns.at(-1)
  if (!last) return []
  const seen = new Set(turns.map((turn) => sameQuestion(turn.question)))
  for (const turn of turns.slice(0, -1)) for (const question of followUpsOf(turn.answer)) seen.add(sameQuestion(question))
  return followUpsOf(last.answer).filter((question) => !seen.has(sameQuestion(question)))
}

/**
 * A path with a placeholder of the app map, `(/word/<id>)`: it leads nowhere, so it is left out of what is shown
 * (answerCheck.ts asks the model to fix it first).
 */
export const PLACEHOLDER_PATH = /\s*\(?\/[\w\-/?=&%]*<[^<>\n]{1,20}>[\w\-/?=&%<>]*\)?/g

/**
 * **bold** (or __bold__): the prompt keeps it for Spanish words in a sentence. The model also writes *italics* for a
 * Spanish word now and then (run 5: "*descansar*"); shown as bold too, never as stray asterisks.
 */
const BOLD = /\*\*([^*\n]+)\*\*|__([^_\n]+)__|(?<![\w*])\*([^*\s](?:[^*\n]*[^*\s])?)\*(?![\w*])/g
const boldText = (match: RegExpMatchArray) => match[1] ?? match[2] ?? match[3] ?? ''
const unbold = (text: string) => text.replace(BOLD, (...match: string[]) => match[1] ?? match[2] ?? match[3] ?? '')

/** Text with its in-app links; a link to a page that does not exist stays its label. */
function linkParts(plain: string, parts: AnswerPart[]) {
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
}

/** A piece of an answer as text, bold Spanish (**tuve**) and in-app links, in order. */
export function answerParts(text: string): AnswerPart[] {
  const parts: AnswerPart[] = []
  let last = 0
  for (const match of text.matchAll(BOLD)) {
    if (match.index > last) linkParts(text.slice(last, match.index), parts)
    parts.push({ type: 'strong', text: boldText(match) })
    last = match.index + match[0].length
  }
  if (last < text.length) linkParts(text.slice(last), parts)
  return parts
}

const LIST_LINE = /^\s*[-•*]\s+(.*)$/
const EXAMPLE = /^(.+?)\s+[–—]\s+(.+)$/

function listItem(line: string): ListItem {
  const example = EXAMPLE.exec(line)
  if (example && !example[1].includes('](')) return { type: 'example', es: unbold(example[1]).trim(), text: unbold(example[2]).trim() }
  return { type: 'item', parts: answerParts(line) }
}

/** Plain text of an answer as paragraphs and lists: lines starting with "- " make a list, the rest stays as written. */
function textBlocks(raw: string, blocks: AnswerBlock[]) {
  const piece = raw.replace(PLACEHOLDER_PATH, '')
  let paragraph: string[] = []
  let items: ListItem[] = []
  const flushParagraph = () => {
    const text = paragraph.join('\n').trim()
    if (text) blocks.push({ type: 'text', parts: answerParts(text) })
    paragraph = []
  }
  const flushList = () => {
    if (items.length) blocks.push({ type: 'list', items })
    items = []
  }
  for (const line of piece.split('\n')) {
    const item = LIST_LINE.exec(line)
    if (item && item[1].trim()) {
      flushParagraph()
      items.push(listItem(item[1].trim()))
    } else {
      flushList()
      paragraph.push(line)
    }
  }
  flushParagraph()
  flushList()
}

/**
 * An answer as paragraphs, lists of examples and cards, in the order the model wrote them. A marker that names nothing
 * is left out (the check in answerCheck.ts has already asked the model once to fix it); the text around it stays.
 * Follow-up questions are not part of it: followUpsOf.
 */
export function answerBlocks(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = []
  let last = 0
  for (const match of text.matchAll(MARKER)) {
    textBlocks(text.slice(last, match.index), blocks)
    const card = cardOf(match[1])
    if (card) blocks.push({ type: 'card', card })
    last = match.index + match[0].length
  }
  textBlocks(text.slice(last), blocks)
  return blocks
}
