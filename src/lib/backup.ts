import { db, type Attempt, type CustomWord, type ReviewCard, type SavedItem } from './db'

// JSON backup of everything stored on the device (IndexedDB).

const APP = 'somos'
const VERSION = 1

export interface Backup {
  app: typeof APP
  version: typeof VERSION
  exportedAt: string
  customWords: CustomWord[]
  savedItems: SavedItem[]
  reviewCards: ReviewCard[]
  attempts: Attempt[]
}

export interface ImportResult {
  customWords: number
  savedItems: number
  reviewCards: number
  attempts: number
  skipped: number
}

export async function createBackup(): Promise<Backup> {
  const [customWords, savedItems, reviewCards, attempts] = await Promise.all([
    db.customWords.toArray(),
    db.savedItems.toArray(),
    db.reviewCards.toArray(),
    db.attempts.toArray(),
  ])
  return { app: APP, version: VERSION, exportedAt: new Date().toISOString(), customWords, savedItems, reviewCards, attempts }
}

export async function downloadBackup(): Promise<void> {
  const backup = await createBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `somos-zaloha-${backup.exportedAt.slice(0, 10)}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---------- parsing (the file comes from outside, so every item is checked) ----------

type Rec = Record<string, unknown>
const isRec = (x: unknown): x is Rec => typeof x === 'object' && x !== null && !Array.isArray(x)
const isStr = (x: unknown): x is string => typeof x === 'string'
const isOptStr = (x: unknown) => x === undefined || isStr(x)
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

const isCustomWord = (x: unknown): x is CustomWord =>
  isRec(x) && isStr(x.id) && isStr(x.es) && isStr(x.sk) && isOptStr(x.note) && isOptStr(x.topic) && isNum(x.createdAt)

const isSavedItem = (x: unknown): x is SavedItem =>
  isRec(x) && isStr(x.itemId) && ['word', 'verb', 'custom'].includes(x.itemType as string) && isNum(x.savedAt)

const isReviewCard = (x: unknown): x is ReviewCard => isRec(x) && isStr(x.itemId) && isStr(x.itemType) && 'fsrs' in x

const isAttempt = (x: unknown): x is Attempt =>
  isRec(x) && isStr(x.exercise) && isStr(x.itemId) && typeof x.correct === 'boolean' && isNum(x.at)

export type ParseResult = { ok: true; backup: Backup; skipped: number } | { ok: false; error: string }

export function parseBackup(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Súbor nie je platný JSON.' }
  }
  if (!isRec(data) || data.app !== APP) return { ok: false, error: 'Toto nie je záloha zo SOMOS.' }
  if (data.version !== VERSION) return { ok: false, error: `Nepodporovaná verzia zálohy (${String(data.version)}).` }

  let skipped = 0
  const pick = <T>(list: unknown, guard: (x: unknown) => x is T): T[] => {
    if (!Array.isArray(list)) return []
    const valid = list.filter(guard)
    skipped += list.length - valid.length
    return valid
  }

  const backup: Backup = {
    app: APP,
    version: VERSION,
    exportedAt: isStr(data.exportedAt) ? data.exportedAt : '',
    customWords: pick(data.customWords, isCustomWord),
    savedItems: pick(data.savedItems, isSavedItem),
    reviewCards: pick(data.reviewCards, isReviewCard),
    attempts: pick(data.attempts, isAttempt),
  }
  return { ok: true, backup, skipped }
}

/**
 * Merges a backup into the local database: items from the backup are added,
 * items with the same key are replaced by the backup version.
 */
export async function importBackup(backup: Backup, skipped: number): Promise<ImportResult> {
  return db.transaction('rw', [db.customWords, db.savedItems, db.reviewCards, db.attempts], async () => {
    await db.customWords.bulkPut(backup.customWords)
    await db.savedItems.bulkPut(backup.savedItems)
    await db.reviewCards.bulkPut(backup.reviewCards)

    // Attempts use auto-increment ids that differ between devices: dedupe by content instead.
    const attemptKey = (a: Attempt) => `${a.at}|${a.exercise}|${a.itemId}`
    const existing = new Set((await db.attempts.toArray()).map(attemptKey))
    const newAttempts = backup.attempts
      .filter((a) => !existing.has(attemptKey(a)))
      .map(({ exercise, itemId, correct, at }) => ({ exercise, itemId, correct, at }))
    await db.attempts.bulkAdd(newAttempts)

    return {
      customWords: backup.customWords.length,
      savedItems: backup.savedItems.length,
      reviewCards: backup.reviewCards.length,
      attempts: newAttempts.length,
      skipped,
    }
  })
}
