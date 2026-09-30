import { useLiveQuery } from 'dexie-react-hooks'
import { createEmptyCard, fsrs, Rating, TypeConvert, type Card, type Grade } from 'ts-fsrs'
import { sentenceById, wordById } from '../data'
import { recordAttempt } from './attempts'
import { getAutoReview, useAutoReviewSettings, type AutoReviewSettings } from './autoReview'
import { addDays, endOfDay, startOfDay } from './dates'
import { db, type ReviewCard, type ReviewItemType } from './db'
import { pluralSk } from './text'

// Spaced repetition (FSRS) for saved words and sentences, custom words and practised words.

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

/** A practised word stays in review when its ⭐ is removed. */
export async function removeReviewCard(itemType: ReviewItemType, itemId: string): Promise<void> {
  const card = await db.reviewCards.get(key(itemType, itemId))
  if (card?.practised) return
  await db.reviewCards.delete(key(itemType, itemId))
}

/** Cards to delete (not wanted, not practised) and to create (wanted, missing). */
export function reviewCardChanges(
  wanted: Map<string, [ReviewItemType, string]>,
  existing: ReviewCard[],
  now: Date,
): { stale: [ReviewItemType, string][]; missing: ReviewCard[] } {
  const have = new Set(existing.map((c) => `${c.itemType}:${c.itemId}`))
  const stale = existing.filter((c) => !c.practised && !wanted.has(`${c.itemType}:${c.itemId}`)).map((c) => key(c.itemType, c.itemId))
  const missing = [...wanted].filter(([k]) => !have.has(k)).map(([, [itemType, itemId]]) => ({ itemType, itemId, fsrs: createEmptyCard(now) }))
  return { stale, missing }
}

/**
 * Makes review cards match the archive: every saved (⭐) word and sentence and every
 * custom word has one; practised words keep theirs; nothing else does. Idempotent; run at
 * startup and after a restore.
 */
export async function syncReviewCards(): Promise<void> {
  await db.transaction('rw', db.savedItems, db.customWords, db.reviewCards, async () => {
    const saved = await db.savedItems.toArray()
    const custom = await db.customWords.toArray()
    const entry = (itemType: ReviewItemType, itemId: string): [string, [ReviewItemType, string]] => [`${itemType}:${itemId}`, [itemType, itemId]]
    const wanted = new Map<string, [ReviewItemType, string]>([
      ...saved.flatMap((s) => (s.itemType === 'word' || s.itemType === 'sentence' ? [entry(s.itemType, s.itemId)] : [])),
      ...custom.map((c) => entry('custom', c.id)),
    ])
    const { stale, missing } = reviewCardChanges(wanted, await db.reviewCards.toArray(), new Date())
    await db.reviewCards.bulkDelete(stale)
    await db.reviewCards.bulkPut(missing)
  })
}

// ---------- due today (with the daily limit for practised words) ----------

/** A practised word nobody starred: these are capped by the daily limit. */
export const isPractisedOnly = (card: ReviewCard, savedWordIds: ReadonlySet<string>) =>
  card.itemType === 'word' && card.practised === true && !savedWordIds.has(card.itemId)

/**
 * Cards to review today, soonest first: every due ⭐ word, ⭐ sentence and custom word, plus
 * practised-only words (most overdue first) up to the daily limit minus the ones reviewed today.
 */
export function selectDue(
  cards: ReviewCard[],
  savedWordIds: ReadonlySet<string>,
  settings: AutoReviewSettings,
  reviewedToday: ReadonlySet<string>,
  now: Date,
): ReviewCard[] {
  const due = cards.map((rc) => ({ rc, card: cardOf(rc) })).filter(({ card }) => isDueToday(card, now))
  const always = due.filter(({ rc }) => !isPractisedOnly(rc, savedWordIds))
  const practisedOnly = due.filter(({ rc }) => isPractisedOnly(rc, savedWordIds)).sort((a, b) => a.card.due.getTime() - b.card.due.getTime())
  const used = cards.filter((rc) => isPractisedOnly(rc, savedWordIds) && reviewedToday.has(rc.itemId)).length
  const slots = settings.enabled ? Math.max(0, settings.limit - used) : 0
  return [...always, ...practisedOnly.slice(0, slots)]
    .sort((a, b) => a.card.due.getTime() - b.card.due.getTime())
    .map(({ rc }) => rc)
}

/** Due today, and by the end of tomorrow (a fresh limit, nothing reviewed yet). */
export function dueCounts(
  cards: ReviewCard[],
  savedWordIds: ReadonlySet<string>,
  settings: AutoReviewSettings,
  reviewedToday: ReadonlySet<string>,
  now: Date,
): { today: number; tomorrow: number } {
  return {
    today: selectDue(cards, savedWordIds, settings, reviewedToday, now).length,
    tomorrow: selectDue(cards, savedWordIds, settings, new Set(), addDays(now, 1)).length,
  }
}

/**
 * Cards whose word or sentence still exists: a renamed or removed item would otherwise stay
 * "due" forever (and, practised, take a daily slot) without ever showing up in review.
 */
export function knownCards(cards: ReviewCard[]): ReviewCard[] {
  return cards.filter((c) => (c.itemType === 'word' ? wordById.has(c.itemId) : c.itemType === 'sentence' ? sentenceById.has(c.itemId) : true))
}

/** Everything the selection reads from the database. */
async function loadSelectionInput(now: Date) {
  const [cards, saved, todayAttempts] = await Promise.all([
    db.reviewCards.toArray(),
    db.savedItems.toArray(),
    db.attempts.where('at').aboveOrEqual(startOfDay(now).getTime()).toArray(),
  ])
  const savedWordIds = new Set(saved.filter((s) => s.itemType === 'word').map((s) => s.itemId))
  const reviewedToday = new Set(
    todayAttempts.filter((a) => a.exercise === 'review' && a.itemId.startsWith('word:')).map((a) => a.itemId.slice('word:'.length)),
  )
  return { cards: knownCards(cards), savedWordIds, reviewedToday }
}

export async function loadDueCards(now = new Date(), settings = getAutoReview()): Promise<ReviewCard[]> {
  const { cards, savedWordIds, reviewedToday } = await loadSelectionInput(now)
  return selectDue(cards, savedWordIds, settings, reviewedToday, now)
}

export async function loadDueCounts(now = new Date()): Promise<{ today: number; tomorrow: number }> {
  const { cards, savedWordIds, reviewedToday } = await loadSelectionInput(now)
  return dueCounts(cards, savedWordIds, getAutoReview(), reviewedToday, now)
}

export interface ReviewOverview {
  total: number // cards that can come up in review
  dueToday: number
  dueWords: number // saved and custom words
  dueSentences: number
}

export function useReviewOverview(): ReviewOverview | undefined {
  const settings = useAutoReviewSettings()
  return useLiveQuery(async () => {
    const now = new Date()
    const { cards, savedWordIds, reviewedToday } = await loadSelectionInput(now)
    const due = selectDue(cards, savedWordIds, settings, reviewedToday, now)
    const dueSentences = due.filter((c) => c.itemType === 'sentence').length
    const total = cards.filter((c) => settings.enabled || !isPractisedOnly(c, savedWordIds)).length
    return { total, dueToday: due.length, dueWords: due.length - dueSentences, dueSentences }
  }, [settings])
}
