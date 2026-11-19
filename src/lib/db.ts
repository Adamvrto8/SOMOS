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
  /** Joined review because it was practised in a lesson (kept when its ⭐ is removed). */
  practised?: true
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
  key: string // "sk:zmrzlinár" = source language + lowercased text ("en>es:ice cream" for the English pair)
  text: string
  from: 'sk' | 'en' | 'es'
  translation: string
  at: number
}

/**
 * One note of the diary (Denník); a day has any number of them (since 2026-11-19, was one text per day).
 * A day written before notes became the note whose id is its date.
 */
export interface DiaryNote {
  id: string
  date: string // "2026-11-07", local time: the day it is listed under
  title: string // may be empty: the list then shows the first line of the text
  text: string
  createdAt: number
  updatedAt: number
}

/** A question and SOMO's answer as the chat shows them (src/lib/assistant/history.ts). */
export interface ChatTurn {
  question: string
  answer: string
  truncated?: boolean
  calls?: number
  /** The tools the model called for it, and the page it was asked on: they go along with 👍 / 👎. */
  tools?: { name: string; input: unknown }[]
  page?: string
  /** 👍 / 👎 given to the answer (src/lib/assistant/feedback.ts). */
  rating?: 'up' | 'down'
  reason?: FeedbackReason
}

export type FeedbackReason = 'wrong' | 'unclear' | 'long' | 'other'

/** One conversation with SOMO, kept on this device only (not synced, not backed up, gone on sign-out). */
export interface ChatThread {
  id: string
  /** The first question, shortened: the name in the list of conversations. */
  title: string
  turns: ChatTurn[]
  createdAt: number
  updatedAt: number
}

/** A change of the learner's tables not sent to the account yet (src/lib/sync). */
export interface OutboxEntry {
  kind: 'customWord' | 'saved' | 'card' | 'attempt' | 'mistake' | 'diary'
  key: string
  at: number // when it changed; 0 = taken over at the first sign-in (the server's version wins)
}

export class SomosDB extends Dexie {
  customWords!: EntityTable<CustomWord, 'id'>
  // Compound key: a word and a verb can share an id (e.g. "tener").
  savedItems!: Table<SavedItem, [SavedItemType, string]>
  reviewCards!: Table<ReviewCard, [ReviewItemType, string]>
  attempts!: EntityTable<Attempt, 'id'>
  mistakes!: Table<Mistake, [string, string]>
  lookups!: EntityTable<Lookup, 'key'>
  outbox!: Table<OutboxEntry, [string, string]>
  diaryNotes!: EntityTable<DiaryNote, 'id'>
  chats!: EntityTable<ChatThread, 'id'>

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
    this.version(4).stores({
      outbox: '[kind+key]',
    })
    this.version(5).stores({
      diary: 'date, updatedAt',
    })
    this.version(6).stores({
      chats: 'id, updatedAt',
    })
    // The diary's two fields (learned, es) became one text (docs/superpowers/specs/2026-11-19-diary-notes-design.md).
    // Kept apart from diary.ts's toDiaryEntry: db.ts must not import diary.ts, which imports db.
    this.version(7)
      .stores({ diary: 'date, updatedAt' })
      .upgrade((tx) =>
        tx
          .table('diary')
          .toCollection()
          .modify((row: Record<string, unknown>) => {
            const learned = typeof row.learned === 'string' ? row.learned.trim() : ''
            const es = typeof row.es === 'string' ? row.es.trim() : ''
            if (typeof row.text !== 'string') row.text = [learned, es].filter(Boolean).join('\n\n')
            delete row.learned
            delete row.es
          }),
      )
    // Notes instead of one text per day: a Dexie table cannot change its key, so the days move to a new table, each
    // becoming the note whose id is its date (sync and backups know a day by that key). The old table goes in version 9.
    this.version(8)
      .stores({ diaryNotes: 'id, date, updatedAt' })
      .upgrade(async (tx) => {
        const days = (await tx.table('diary').toArray()) as { date: string; text: string; createdAt: number; updatedAt: number }[]
        await tx.table('diaryNotes').bulkPut(
          days.map(({ date, text, createdAt, updatedAt }) => ({ id: date, date, title: '', text, createdAt, updatedAt })),
        )
      })
    this.version(9).stores({ diary: null })
  }
}

export const db = new SomosDB()
