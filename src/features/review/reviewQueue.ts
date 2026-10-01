import type { Card } from 'ts-fsrs'
import { sentenceById, wordById } from '../../data'
import type { Example } from '../../data/types'
import { db, type ReviewItemType } from '../../lib/db'
import { articleFor } from '../../lib/grammar'
import { cardOf, loadDueCards } from '../../lib/srs'

/** One flashcard in a review session, with everything needed to show both sides. */
export interface ReviewEntry {
  itemType: ReviewItemType
  itemId: string
  card: Card
  es: string
  article?: string
  sk: string[]
  example?: Example
  note?: string
  /** Decided when the session loads, so a card coming back in the same session keeps its side. */
  slovakFirst: boolean
}

/**
 * Words alternate the side shown first with every review, so recalling the Spanish word
 * is practised too. Sentences are always read in Spanish.
 */
export function slovakFirst(itemType: ReviewItemType, card: Card): boolean {
  return itemType !== 'sentence' && card.reps % 2 === 1
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
      return sentence ? [{ ...base, es: sentence.es, sk: [sentence.sk] }] : []
    }
    if (rc.itemType === 'word') {
      const word = wordById.get(rc.itemId)
      if (!word) return [] // removed from the dataset
      return [{ ...base, es: word.es, article: articleFor(word), sk: word.sk, example: word.examples[0], note: word.note }]
    }
    const custom = customs.get(rc.itemId)
    if (!custom) return []
    return [{ ...base, es: custom.es, sk: [custom.sk], note: custom.note }]
  })
}
