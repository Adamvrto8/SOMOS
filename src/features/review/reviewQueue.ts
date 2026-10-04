import { Rating, type Card, type Grade } from 'ts-fsrs'
import { sentenceById, wordById } from '../../data'
import { db, type ReviewItemType } from '../../lib/db'
import { articleFor } from '../../lib/grammar'
import { slovakAnswers } from '../../lib/lesson'
import { sentenceTranslation, wordExamples, wordNote, wordTranslations, type LocalExample } from '../../lib/localized'
import { cardOf, loadDueCards } from '../../lib/srs'

/** One flashcard in a review session, with everything needed to show both sides. */
export interface ReviewEntry {
  itemType: ReviewItemType
  itemId: string
  card: Card
  es: string
  article?: string
  sk: string[] // the meaning, in the learner's language
  example?: LocalExample
  note?: string
  /** Decided when the session loads, so a card coming back in the same session keeps its side. */
  slovakFirst: boolean
  /** What may be typed for the hidden side; empty when the card can only be revealed (sentences). */
  answers: string[]
}

/**
 * Words alternate the side shown first with every review, so recalling the Spanish word
 * is practised too. Sentences are always read in Spanish.
 */
export function slovakFirst(itemType: ReviewItemType, card: Card): boolean {
  return itemType !== 'sentence' && card.reps % 2 === 1
}

/** A Spanish word typed with or without its article. */
export function spanishAnswers(es: string, article?: string): string[] {
  return article ? [es, `${article} ${es}`] : [es]
}

/** A custom word's Slovak side is free text: "pes, psík" is right as a whole or by either meaning. */
export function customSlovakAnswers(sk: string): string[] {
  return [...new Set([sk, ...sk.split(/[,;]/).map((part) => part.trim())])].filter(Boolean)
}

/** A typed answer rates itself: right at once = Good, fixed after a hint = Hard, given up = Again. */
export function typedRating(tries: number, gaveUp: boolean): Grade {
  if (gaveUp) return Rating.Again
  return tries <= 1 ? Rating.Good : Rating.Hard
}

/** Cards due today (daily limit applied), soonest first, joined with their word, sentence or custom word. */
export async function loadDueEntries(now = new Date()): Promise<ReviewEntry[]> {
  const due = (await loadDueCards(now)).map((rc) => ({ rc, card: cardOf(rc) }))

  const customIds = due.filter(({ rc }) => rc.itemType === 'custom').map(({ rc }) => rc.itemId)
  const customs = new Map((await db.customWords.bulkGet(customIds)).flatMap((c) => (c ? [[c.id, c] as const] : [])))

  return due.flatMap(({ rc, card }): ReviewEntry[] => {
    const base = { itemType: rc.itemType, itemId: rc.itemId, card, slovakFirst: slovakFirst(rc.itemType, card) }
    if (rc.itemType === 'sentence') {
      const sentence = sentenceById.get(rc.itemId)
      // A free Slovak translation of a sentence can't be checked: reveal only.
      return sentence ? [{ ...base, es: sentence.es, sk: [sentenceTranslation(sentence)], answers: [] }] : []
    }
    if (rc.itemType === 'word') {
      const word = wordById.get(rc.itemId)
      if (!word) return [] // removed from the dataset
      const article = articleFor(word)
      const answers = base.slovakFirst ? spanishAnswers(word.es, article) : slovakAnswers(word)
      return [{ ...base, es: word.es, article, sk: wordTranslations(word), example: wordExamples(word)[0], note: wordNote(word), answers }]
    }
    const custom = customs.get(rc.itemId)
    if (!custom) return []
    const answers = base.slovakFirst ? spanishAnswers(custom.es) : customSlovakAnswers(custom.sk)
    return [{ ...base, es: custom.es, sk: [custom.sk], note: custom.note, answers }]
  })
}
