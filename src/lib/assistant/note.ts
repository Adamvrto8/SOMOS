import { verbById, wordById } from '../../data'
import { conjugationRows, formText, TENSE_LABELS } from '../conjugate'
import { TITLE_MAX } from '../diary'
import { articleFor } from '../grammar'
import { wordTranslations } from '../localized'
import { answerBlocks, type AnswerCard, type AnswerPart, type ListItem } from './answerText'

// An answer of SOMO as a diary note (docs/superpowers/specs/2026-11-19-diary-notes-design.md §3): the question is the
// title, the answer plain text — word and conjugation cards written out from the app's data, no marks, no tips, no
// sentence that pointed somewhere in the app (it means nothing in a note), no follow-up questions.
// A blank line parts the paragraphs, a list and a run of cards.

/** Marks where a link was, so the sentence around it can be left out. */
const LINK = '\u0000'

const partsText = (parts: AnswerPart[]) => parts.map((p) => (p.type === 'link' ? `${LINK}${p.label}` : p.text)).join('')

/** A paragraph without its sentences that held a link. */
function withoutLinkedSentences(text: string): string {
  if (!text.includes(LINK)) return text.trim()
  return text
    .split(/(?<=[.!?…])\s+/)
    .filter((sentence) => !sentence.includes(LINK))
    .join(' ')
    .trim()
}

/** A list item as a line; '' for an item that pointed somewhere in the app. */
function itemText(item: ListItem): string {
  if (item.type === 'example') return `- ${item.es} – ${item.text}`
  const text = partsText(item.parts).trim()
  return text && !text.includes(LINK) ? `- ${text}` : ''
}

/** A word or conjugation card as one line; '' for a tip and for a card whose data is gone. */
export function cardAsText(card: AnswerCard): string {
  if (card.type === 'word') {
    const word = wordById.get(card.id)
    if (!word) return ''
    const article = articleFor(word)
    return `${article ? `${article} ` : ''}${word.es} – ${wordTranslations(word).join(', ')}`
  }
  if (card.type === 'tip') return ''
  const verb = verbById.get(card.verbId)
  const estar = verbById.get('estar')
  if (!verb || !estar) return ''
  const forms = conjugationRows(verb, card.tense, estar).map((row) => formText(row.parts))
  return `${verb.id} · ${TENSE_LABELS[card.tense]}: ${forms.join(', ')}`
}

/**
 * A further answer saved at the end of its conversation's note (the first one gave the note its title): its question on
 * a line of its own after `questionLabel`, then the answer as in turnAsNote.
 */
export function appendTurn(noteText: string, turn: { question: string; answer: string }, questionLabel: string): string {
  const { title, text } = turnAsNote(turn)
  const section = [`${questionLabel}${title}`, text].filter(Boolean).join('\n')
  return noteText.trim() ? `${noteText.trimEnd()}\n\n${section}` : section
}

/** A chat turn as a note: the question's first line is the title, its other lines (a task) open the text. */
export function turnAsNote(turn: { question: string; answer: string }): { title: string; text: string } {
  const [title = '', ...context] = turn.question
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  // Each block of the answer becomes a group of lines; cards that follow each other stay one group.
  const groups: { lines: string[]; cards: boolean }[] = []
  for (const block of answerBlocks(turn.answer)) {
    const lines =
      block.type === 'text'
        ? [withoutLinkedSentences(partsText(block.parts))]
        : block.type === 'list'
          ? block.items.map(itemText)
          : [cardAsText(block.card)]
    const kept = lines.filter(Boolean)
    if (kept.length === 0) continue
    const last = groups.at(-1)
    if (block.type === 'card' && last?.cards) last.lines.push(...kept)
    else groups.push({ lines: kept, cards: block.type === 'card' })
  }
  const parts = [context.join('\n'), ...groups.map((g) => g.lines.join('\n'))].filter(Boolean)
  return { title: title.slice(0, TITLE_MAX), text: parts.join('\n\n') }
}
