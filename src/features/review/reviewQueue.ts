import type { Card } from 'ts-fsrs'
import { sentenceById, wordById } from '../../data'
import type { Example } from '../../data/types'
import { db, type ReviewItemType } from '../../lib/db'
import { articleFor } from '../../lib/grammar'
import { cardOf, isDueToday } from '../../lib/srs'

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
}

/** Cards due today, soonest first, joined with their dictionary or custom word. */
export async function loadDueEntries(now = new Date()): Promise<ReviewEntry[]> {
  const due = (await db.reviewCards.toArray())
    .map((rc) => ({ rc, card: cardOf(rc) }))
    .filter(({ card }) => isDueToday(card, now))
    .sort((a, b) => a.card.due.getTime() - b.card.due.getTime())

  const customIds = due.filter(({ rc }) => rc.itemType === 'custom').map(({ rc }) => rc.itemId)
  const customs = new Map((await db.customWords.bulkGet(customIds)).flatMap((c) => (c ? [[c.id, c] as const] : [])))

  return due.flatMap(({ rc, card }): ReviewEntry[] => {
    if (rc.itemType === 'sentence') {
      const sentence = sentenceById.get(rc.itemId)
      return sentence ? [{ itemType: 'sentence', itemId: rc.itemId, card, es: sentence.es, sk: [sentence.sk] }] : []
    }
    if (rc.itemType === 'word') {
      const word = wordById.get(rc.itemId)
      if (!word) return [] // removed from the dataset
      return [{ itemType: 'word', itemId: rc.itemId, card, es: word.es, article: articleFor(word), sk: word.sk, example: word.examples[0], note: word.note }]
    }
    const custom = customs.get(rc.itemId)
    if (!custom) return []
    return [{ itemType: 'custom', itemId: rc.itemId, card, es: custom.es, sk: [custom.sk], note: custom.note }]
  })
}
