import type { Table } from 'dexie'
import { db, type Attempt, type CustomWord, type Mistake, type ReviewCard, type SavedItem } from '../db'

// What syncs between the devices of an account, record by record (docs/superpowers/specs/2026-10-19-accounts-design.md).

/** Rows of the learner's Dexie tables. */
export type TableKind = 'customWord' | 'saved' | 'card' | 'attempt' | 'mistake'
/** The localStorage stores: numbered lessons, tests, settings. */
export type StoreKind = 'lesson' | 'test' | 'settings'
export type SyncKind = TableKind | StoreKind

export interface SyncRecord {
  kind: SyncKind
  key: string
  data: unknown // the row as stored; null for a deletion
  deleted: boolean
  changedAt: number // device time of the change: the newer one wins
}

/** A record as the server returns it, with its place in the account's history. */
export interface RemoteRecord extends SyncRecord {
  rev: number
}

export const TABLE_KINDS: TableKind[] = ['customWord', 'saved', 'card', 'attempt', 'mistake']
export const isTableKind = (kind: string): kind is TableKind => (TABLE_KINDS as string[]).includes(kind)

/** "word:casa" → ["word", "casa"]; ids after the first colon may have colons of their own ("tener:preterito:yo"). */
function splitFirst(key: string, separator: string): [string, string] {
  const at = key.indexOf(separator)
  return at < 0 ? [key, ''] : [key.slice(0, at), key.slice(at + separator.length)]
}

/** Attempts have device-local auto ids: an attempt is known by its content. */
export const attemptKey = (a: Pick<Attempt, 'at' | 'exercise' | 'itemId'>) => `${a.at}|${a.exercise}|${a.itemId}`

function parseAttemptKey(key: string): { at: number; exercise: string; itemId: string } {
  const [at, rest] = splitFirst(key, '|')
  const [exercise, itemId] = splitFirst(rest, '|')
  return { at: Number(at), exercise, itemId }
}

/** The sync key of a row of a table kind. */
export function keyOf(kind: TableKind, row: unknown): string {
  switch (kind) {
    case 'customWord':
      return (row as CustomWord).id
    case 'saved':
    case 'card': {
      const { itemType, itemId } = row as SavedItem | ReviewCard
      return `${itemType}:${itemId}`
    }
    case 'mistake': {
      const { exercise, itemId } = row as Mistake
      return `${exercise}:${itemId}`
    }
    case 'attempt':
      return attemptKey(row as Attempt)
  }
}

export function tableOf(kind: TableKind): Table {
  switch (kind) {
    case 'customWord':
      return db.customWords
    case 'saved':
      return db.savedItems
    case 'card':
      return db.reviewCards
    case 'attempt':
      return db.attempts
    case 'mistake':
      return db.mistakes
  }
}

/** The Dexie primary key of a record (attempts have none to share). */
function primaryKey(kind: Exclude<TableKind, 'attempt'>, key: string): string | [string, string] {
  return kind === 'customWord' ? key : splitFirst(key, ':')
}

async function findAttempt(key: string): Promise<Attempt | undefined> {
  const { at, exercise, itemId } = parseAttemptKey(key)
  return db.attempts
    .where('at')
    .equals(at)
    .filter((a) => a.exercise === exercise && a.itemId === itemId)
    .first()
}

/** The current row of a record, as it is sent; undefined when it is gone. */
export async function readRow(kind: TableKind, key: string): Promise<unknown> {
  if (kind === 'attempt') {
    const attempt = await findAttempt(key)
    if (!attempt) return undefined
    const { exercise, itemId, correct, at } = attempt
    return { exercise, itemId, correct, at }
  }
  return tableOf(kind).get(primaryKey(kind, key))
}

/** Stores a record's row from another device. Call inside runRemote. */
export async function writeRow(kind: TableKind, key: string, data: unknown): Promise<void> {
  if (kind !== 'attempt') {
    await tableOf(kind).put(data)
    return
  }
  if (await findAttempt(key)) return // attempts never change
  const { exercise, itemId, correct, at } = data as Attempt
  await db.attempts.add({ exercise, itemId, correct, at })
}

/** Removes a record's row deleted on another device. Call inside runRemote. */
export async function deleteRow(kind: TableKind, key: string): Promise<void> {
  if (kind !== 'attempt') {
    await tableOf(kind).delete(primaryKey(kind, key))
    return
  }
  const attempt = await findAttempt(key)
  if (attempt?.id !== undefined) await db.attempts.delete(attempt.id)
}
