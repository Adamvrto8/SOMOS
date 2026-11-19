import { english, tipById, tips, verbById, wordById } from '../../data'
import { conjugationRows, formText, TENSE_LABELS } from '../conjugate'
import { articleFor } from '../grammar'
import { localizedTip, wordTranslations } from '../localized'
import { answerBlocks, type AnswerCard, type AnswerPart, type ListItem } from './answerText'

// An answer of SOMO as plain text for the diary (docs/superpowers/specs/2026-11-19-diary-notes-design.md §3):
// the cards written out from the app's data, no marks, links as their words, no follow-up questions.
// "Otázka:" and "SOMO:" mark who said what; a blank line parts the paragraphs, a list and a run of cards.

/** How a tip card is written, and how the diary finds it again to offer its link. */
const TIP_PREFIX = 'Tip: '

const partsText = (parts: AnswerPart[]) => parts.map((p) => (p.type === 'link' ? p.label : p.text)).join('')

const itemText = (item: ListItem) => (item.type === 'example' ? `- ${item.es} – ${item.text}` : `- ${partsText(item.parts)}`)

/** A card as one line; '' for a card whose data is gone. */
export function cardAsText(card: AnswerCard): string {
  if (card.type === 'word') {
    const word = wordById.get(card.id)
    if (!word) return ''
    const article = articleFor(word)
    return `${article ? `${article} ` : ''}${word.es} – ${wordTranslations(word).join(', ')}`
  }
  if (card.type === 'tip') {
    const tip = tipById.get(card.id)
    return tip ? `${TIP_PREFIX}${localizedTip(tip).title}` : ''
  }
  const verb = verbById.get(card.verbId)
  const estar = verbById.get('estar')
  if (!verb || !estar) return ''
  const forms = conjugationRows(verb, card.tense, estar).map((row) => formText(row.parts))
  return `${verb.id} · ${TENSE_LABELS[card.tense]}: ${forms.join(', ')}`
}

export interface NoteLabels {
  question: string
  answer: string
}

/** The question and the answer of a chat turn as one block of the diary. */
export function turnAsNote(turn: { question: string; answer: string }, labels: NoteLabels): string {
  // Each block of the answer becomes a group of lines; cards that follow each other stay one group.
  const groups: { lines: string[]; cards: boolean }[] = []
  for (const block of answerBlocks(turn.answer)) {
    const lines =
      block.type === 'text' ? [partsText(block.parts).trim()] : block.type === 'list' ? block.items.map(itemText) : [cardAsText(block.card)]
    const kept = lines.filter(Boolean)
    if (kept.length === 0) continue
    const last = groups.at(-1)
    if (block.type === 'card' && last?.cards) last.lines.push(...kept)
    else groups.push({ lines: kept, cards: block.type === 'card' })
  }
  const [first, ...rest] = groups.map((g) => g.lines.join('\n'))
  const question = `${labels.question}: ${turn.question.trim()}`
  // Cards keep their own lines, so a "Tip: …" line still starts its line for tipsInText.
  const answer = first === undefined ? '' : `${labels.answer}:${groups[0].cards ? '\n' : ' '}${first}`
  return [question, answer, ...rest].filter(Boolean).join('\n\n')
}

/** Every tip of the app whose "Tip: <title>" line is in a diary text, in the order they come. */
export function tipsInText(text: string): string[] {
  const byTitle = new Map<string, string>()
  for (const tip of tips) {
    byTitle.set(tip.title, tip.id)
    const en = english.tips.get(tip.id)?.title
    if (en) byTitle.set(en, tip.id)
  }
  const found: string[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith(TIP_PREFIX)) continue
    const id = byTitle.get(trimmed.slice(TIP_PREFIX.length).trim())
    if (id && !found.includes(id)) found.push(id)
  }
  return found
}
