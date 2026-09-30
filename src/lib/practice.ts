import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs'
import { wordById, wordIdByVerb } from '../data'
import { addDays, dayKey, startOfDay } from './dates'
import type { ReviewCard } from './db'
import { cardOf } from './srs'

// Automatic review: a word answered in Slovná zásoba or Časovanie joins spaced repetition, and
// the lesson answer counts as a review of it (right = Good, wrong = Again).

/** No 10-minute learning steps: a lesson already was the first encounter. */
const practiceScheduler = fsrs({ enable_fuzz: true, enable_short_term: false })

export interface PracticeAnswer {
  exercise: string
  itemId: string
  correct: boolean
  at: number
}

/** The dictionary word a lesson answer practised: "perro:sk-es" → perro, "tener:preterito:yo" → tener. */
export function practisedWordId(exercise: string, itemId: string): string | undefined {
  const head = itemId.split(':')[0]
  if (exercise === 'vocab') return wordById.has(head) ? head : undefined
  if (exercise === 'conjugation') return wordIdByVerb.get(head)
  return undefined
}

/** The card after a lesson answer, or undefined when the card was already reviewed that day. */
export function applyPractice(card: Card | undefined, correct: boolean, at: Date): Card | undefined {
  if (card?.last_review && dayKey(card.last_review) === dayKey(at)) return undefined
  const next = practiceScheduler.next(card ?? createEmptyCard(at), at, correct ? Rating.Good : Rating.Again).card
  const tomorrow = startOfDay(addDays(at, 1))
  return !correct && next.due < tomorrow ? { ...next, due: tomorrow } : next
}

/** Schedules rebuilt from past lesson answers (oldest first, one per word per day). */
export function replayPractice(answers: PracticeAnswer[]): Map<string, Card> {
  const cards = new Map<string, Card>()
  for (const answer of [...answers].sort((a, b) => a.at - b.at)) {
    const wordId = practisedWordId(answer.exercise, answer.itemId)
    if (!wordId) continue
    const next = applyPractice(cards.get(wordId), answer.correct, new Date(answer.at))
    if (next) cards.set(wordId, next)
  }
  return cards
}

/** What to store after a lesson answer for `wordId`, or undefined when nothing changes. */
export function practiceUpdate(existing: ReviewCard | undefined, wordId: string, correct: boolean, at: Date): ReviewCard | undefined {
  const fsrs = applyPractice(existing && cardOf(existing), correct, at)
  if (fsrs) return { ...existing, itemType: 'word', itemId: wordId, fsrs, practised: true }
  return existing && !existing.practised ? { ...existing, practised: true } : undefined
}

/** Cards to put so every practised word has one (past lessons included). Idempotent. */
export function planPracticeSync(answers: PracticeAnswer[], existing: ReviewCard[]): ReviewCard[] {
  const have = new Map(existing.filter((c) => c.itemType === 'word').map((c) => [c.itemId, c]))
  const puts: ReviewCard[] = []
  for (const [wordId, fsrs] of replayPractice(answers)) {
    const card = have.get(wordId)
    if (!card) puts.push({ itemType: 'word', itemId: wordId, fsrs, practised: true })
    else if (!card.practised) puts.push({ ...card, practised: true })
  }
  return puts
}
