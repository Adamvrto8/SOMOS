import { tipById, verbById, wordById } from '../../data'
import { conjugationRows, formText, TENSE_LABELS } from '../conjugate'
import { articleFor } from '../grammar'
import { localizedTip, wordTranslations } from '../localized'
import { answerBlocks, type AnswerCard, type AnswerPart, type ListItem } from './answerText'

// An answer of SOMO as plain text for the diary (docs/superpowers/specs/2026-11-19-diary-notes-design.md §3):
// the cards written out from the app's data, no marks, links as their words, no follow-up questions.

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
    return tip ? `Tip: ${localizedTip(tip).title}` : ''
  }
  const verb = verbById.get(card.verbId)
  const estar = verbById.get('estar')
  if (!verb || !estar) return ''
  const forms = conjugationRows(verb, card.tense, estar).map((row) => formText(row.parts))
  return `${verb.id} · ${TENSE_LABELS[card.tense]}: ${forms.join(', ')}`
}

/** The question and the answer of a chat turn as one block of the diary. */
export function turnAsNote(turn: { question: string; answer: string }): string {
  const lines = answerBlocks(turn.answer).flatMap((block) => {
    if (block.type === 'text') return [partsText(block.parts).trim()]
    if (block.type === 'list') return block.items.map(itemText)
    return [cardAsText(block.card)]
  })
  return [turn.question.trim(), ...lines].filter(Boolean).join('\n')
}
