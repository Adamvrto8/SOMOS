import Dexie, { type EntityTable, type Table } from 'dexie'
import type { Card } from 'ts-fsrs'

// Local, per-device user data (see CLAUDE.md §3). Static content lives in src/data.

export interface CustomWord {
  id: string
  es: string
  sk: string
  note?: string
  topic?: string
  createdAt: number
}

export type SavedItemType = 'word' | 'verb' | 'custom'

export interface SavedItem {
  itemId: string
  itemType: SavedItemType
  savedAt: number
}

/** Spaced-repetition items: saved dictionary words and the learner's own words. */
export type ReviewItemType = 'word' | 'custom'

export interface ReviewCard {
  itemId: string
  itemType: ReviewItemType
  // Dates are Date objects in IndexedDB but strings after a JSON backup: read via srs.cardOf().
  fsrs: Card
}

export interface Attempt {
  id?: number
  exercise: string
  itemId: string
  correct: boolean
  at: number
}

export class SomosDB extends Dexie {
  customWords!: EntityTable<CustomWord, 'id'>
  // Compound key: a word and a verb can share an id (e.g. "tener").
  savedItems!: Table<SavedItem, [SavedItemType, string]>
  reviewCards!: Table<ReviewCard, [ReviewItemType, string]>
  attempts!: EntityTable<Attempt, 'id'>

  constructor() {
    super('somos')
    this.version(1).stores({
      customWords: 'id, es, topic, createdAt',
      savedItems: '[itemType+itemId], savedAt',
      reviewCards: '[itemType+itemId], itemType',
      attempts: '++id, exercise, itemId, at',
    })
  }
}

export const db = new SomosDB()
