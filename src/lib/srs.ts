import { useLiveQuery } from 'dexie-react-hooks'
import { createEmptyCard, fsrs, Rating, TypeConvert, type Card, type Grade } from 'ts-fsrs'
import { recordAttempt } from './attempts'
import { endOfDay } from './dates'
import { db, type ReviewCard, type ReviewItemType } from './db'
import { pluralSk } from './text'

// Spaced repetition (FSRS) for saved dictionary words and custom words.

const scheduler = fsrs({ enable_fuzz: true })

export const GRADES: { grade: Grade; label: string }[] = [
  { grade: Rating.Again, label: 'Znova' },
  { grade: Rating.Hard, label: 'Ťažké' },
  { grade: Rating.Good, label: 'Dobre' },
  { grade: Rating.Easy, label: 'Ľahké' },
]

/** The FSRS card with real Date objects (JSON backups store dates as strings). */
export const cardOf = (rc: ReviewCard): Card => TypeConvert.card(rc.fsrs)

/** Due before the end of the local day, so a card due tonight is already offered in the morning. */
export const isDueToday = (card: Card, now = new Date()) => card.due.getTime() <= endOfDay(now).getTime()

/** "< 1 min", "10 min", "3 h", "1 deň", "5 dní", "2 mes.", "1,5 r." */
export function formatInterval(ms: number): string {
  const minutes = ms / 60_000
  if (minutes < 1) return '< 1 min'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const hours = minutes / 60
  if (hours < 24) return `${Math.round(hours)} h`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} ${pluralSk(days, ['deň', 'dni', 'dní'])}`
  if (days < 365) return `${Math.round(days / 30)} mes.`
  return `${(days / 365).toFixed(1).replace('.', ',')} r.`
}

/** When the card would come back for each grade, as labels for the rating buttons. */
export function previewIntervals(card: Card, now: Date): Record<Grade, string> {
  const preview = scheduler.repeat(card, now)
  const out = {} as Record<Grade, string>
  for (const { grade } of GRADES) out[grade] = formatInterval(preview[grade].card.due.getTime() - now.getTime())
  return out
}

export function scheduleNext(card: Card, grade: Grade, now: Date): Card {
  return scheduler.next(card, now, grade).card
}

// ---------- database ----------

const key = (itemType: ReviewItemType, itemId: string): [ReviewItemType, string] => [itemType, itemId]

/** Stores the new schedule and counts the review toward the streak and daily goal. */
export async function rateCard(itemType: ReviewItemType, itemId: string, grade: Grade, now = new Date()): Promise<Card> {
  const stored = await db.reviewCards.get(key(itemType, itemId))
  if (!stored) throw new Error(`No review card for ${itemType}:${itemId}`)
  const card = scheduleNext(cardOf(stored), grade, now)
  await db.reviewCards.put({ ...stored, fsrs: card })
  await recordAttempt('review', `${itemType}:${itemId}`, grade !== Rating.Again)
  return card
}

export async function addReviewCard(itemType: ReviewItemType, itemId: string): Promise<void> {
  if (await db.reviewCards.get(key(itemType, itemId))) return
  await db.reviewCards.put({ itemType, itemId, fsrs: createEmptyCard(new Date()) })
}

export async function removeReviewCard(itemType: ReviewItemType, itemId: string): Promise<void> {
  await db.reviewCards.delete(key(itemType, itemId))
}

/**
 * Makes review cards match the archive: every saved word and custom word has one,
 * nothing else does. Idempotent; run at startup and after restoring a backup.
 */
export async function syncReviewCards(): Promise<void> {
  await db.transaction('rw', db.savedItems, db.customWords, db.reviewCards, async () => {
    const saved = await db.savedItems.toArray()
    const custom = await db.customWords.toArray()
    const wanted = new Map<string, [ReviewItemType, string]>([
      ...saved.filter((s) => s.itemType === 'word').map((s): [string, [ReviewItemType, string]] => [`word:${s.itemId}`, ['word', s.itemId]]),
      ...custom.map((c): [string, [ReviewItemType, string]] => [`custom:${c.id}`, ['custom', c.id]]),
    ])
    const existing = await db.reviewCards.toArray()
    const have = new Set(existing.map((c) => `${c.itemType}:${c.itemId}`))

    const stale = existing.filter((c) => !wanted.has(`${c.itemType}:${c.itemId}`)).map((c) => key(c.itemType, c.itemId))
    const now = new Date()
    const missing = [...wanted].filter(([k]) => !have.has(k)).map(([, [itemType, itemId]]) => ({ itemType, itemId, fsrs: createEmptyCard(now) }))

    await db.reviewCards.bulkDelete(stale)
    await db.reviewCards.bulkPut(missing)
  })
}

export interface ReviewOverview {
  total: number // cards in the archive
  dueToday: number
}

export function useReviewOverview(): ReviewOverview | undefined {
  return useLiveQuery(async () => {
    const cards = await db.reviewCards.toArray()
    const now = new Date()
    return { total: cards.length, dueToday: cards.filter((c) => isDueToday(cardOf(c), now)).length }
  }, [])
}
