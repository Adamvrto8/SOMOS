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

// 'sentence' = a sentence starred from an exercise ('verb' is reserved, unused).
export type SavedItemType = 'word' | 'verb' | 'custom' | 'sentence'

export interface SavedItem {
  itemId: string
  itemType: SavedItemType
  savedAt: number
}

/** Spaced-repetition items: saved words and sentences (⭐) and the learner's own words. */
export type ReviewItemType = 'word' | 'custom' | 'sentence'

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

/** An exercise answered wrong, kept until the learner says they know it. */
export interface Mistake {
  exercise: string // ExerciseType
  itemId: string // lesson task itemId ("s001#0", "tener:preterito:yo", "s004")
  firstWrongAt: number
  lastWrongAt: number
  wrongCount: number
}

/** Cached online (DeepL) translation, so a repeated lookup is free and works offline. Not backed up. */
export interface Lookup {
  key: string // "sk:zmrzlinár" = source language + lowercased text
  text: string
  from: 'sk' | 'es'
  translation: string
  at: number
}

export class SomosDB extends Dexie {
  customWords!: EntityTable<CustomWord, 'id'>
  // Compound key: a word and a verb can share an id (e.g. "tener").
  savedItems!: Table<SavedItem, [SavedItemType, string]>
  reviewCards!: Table<ReviewCard, [ReviewItemType, string]>
  attempts!: EntityTable<Attempt, 'id'>
  mistakes!: Table<Mistake, [string, string]>
  lookups!: EntityTable<Lookup, 'key'>

  constructor() {
    super('somos')
    this.version(1).stores({
      customWords: 'id, es, topic, createdAt',
      savedItems: '[itemType+itemId], savedAt',
      reviewCards: '[itemType+itemId], itemType',
      attempts: '++id, exercise, itemId, at',
    })
    this.version(2).stores({
      mistakes: '[exercise+itemId], lastWrongAt',
    })
    this.version(3).stores({
      lookups: 'key, at',
    })
  }
}

export const db = new SomosDB()
