import { getAutoReview, setAutoReview } from './autoReview'
import { t } from '../i18n'
import { getDailyGoal, setDailyGoal } from './dailyGoal'
import { getLanguage, setLanguage } from './language'
import { db, type Attempt, type CustomWord, type Mistake, type ReviewCard, type SavedItem } from './db'
import { getProgressionSnapshot, mergeProgression, parseProgression, type LessonProgressionMap } from './lessonProgress'
import { syncPracticeCards } from './practice'
import { getReminderSettings, setReminderTime } from './reminder'
import { parseSettingsBackup, type SettingsBackup } from './settingsBackup'
import { getSoundSet, setSoundSet } from './sound'
import { syncReviewCards } from './srs'
import { getLook, getThemePref, setLook, setThemePref } from './theme'

// JSON backup of the learner's data on the device: IndexedDB, the numbered lessons' progress and
// the settings (localStorage; see settingsBackup.ts for what is left out). The DeepL cache is not backed up.

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
  mistakes: Mistake[] // missing in backups made before the mistakes list existed
  lessons?: LessonProgressionMap // passed lessons and best scores; missing in backups made before 2026-10-01
  settings?: SettingsBackup // missing in backups made before 2026-10-02
}

export interface ImportResult {
  customWords: number
  savedItems: number
  reviewCards: number
  attempts: number
  mistakes: number
  lessons: number
  skipped: number
  settings: boolean // the backup had settings and they now apply here
  reminderOff: boolean // the reminder was on in the backup but is off on this device
}

function currentSettings(): SettingsBackup {
  const { enabled, time } = getReminderSettings()
  return { theme: getThemePref(), look: getLook(), dailyGoal: getDailyGoal(), autoReview: getAutoReview(), reminder: { enabled, time }, language: getLanguage(), sound: getSoundSet() }
}

/** The settings of a backup replace the ones on this device. Resolves to ImportResult's `reminderOff`. */
async function applySettings(settings: SettingsBackup): Promise<boolean> {
  if (settings.theme) setThemePref(settings.theme)
  if (settings.look) setLook(settings.look)
  if (settings.dailyGoal) setDailyGoal(settings.dailyGoal)
  if (settings.autoReview) setAutoReview(settings.autoReview)
  if (settings.language) setLanguage(settings.language)
  if (settings.sound) setSoundSet(settings.sound)
  if (!settings.reminder) return false
  const here = getReminderSettings()
  if (here.enabled) return false // a reminder that runs here keeps its own time
  // Only the time: notifications have to be allowed on each device, by a tap of the learner.
  await setReminderTime(settings.reminder.time)
  return settings.reminder.enabled
}

export async function createBackup(): Promise<Backup> {
  const [customWords, savedItems, reviewCards, attempts, mistakes] = await Promise.all([
    db.customWords.toArray(),
    db.savedItems.toArray(),
    db.reviewCards.toArray(),
    db.attempts.toArray(),
    db.mistakes.toArray(),
  ])
  return {
    app: APP,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    customWords,
    savedItems,
    reviewCards,
    attempts,
    mistakes,
    lessons: getProgressionSnapshot(),
    settings: currentSettings(),
  }
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
  isRec(x) && isStr(x.itemId) && ['word', 'verb', 'custom', 'sentence'].includes(x.itemType as string) && isNum(x.savedAt)

const isReviewCard = (x: unknown): x is ReviewCard =>
  isRec(x) && isStr(x.itemId) && ['word', 'custom', 'sentence'].includes(x.itemType as string) && isRec(x.fsrs) && 'due' in x.fsrs

const isAttempt = (x: unknown): x is Attempt =>
  isRec(x) && isStr(x.exercise) && isStr(x.itemId) && typeof x.correct === 'boolean' && isNum(x.at)

const isMistake = (x: unknown): x is Mistake =>
  isRec(x) && isStr(x.exercise) && isStr(x.itemId) && isNum(x.firstWrongAt) && isNum(x.lastWrongAt) && isNum(x.wrongCount)

export type ParseResult = { ok: true; backup: Backup; skipped: number } | { ok: false; error: string }

export function parseBackup(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: t().settings.backup.notJson }
  }
  if (!isRec(data) || data.app !== APP) return { ok: false, error: t().settings.backup.notSomos }
  if (data.version !== VERSION) return { ok: false, error: t().settings.backup.badVersion(String(data.version)) }

  let skipped = 0
  const pick = <T>(list: unknown, guard: (x: unknown) => x is T): T[] => {
    if (!Array.isArray(list)) return []
    const valid = list.filter(guard)
    skipped += list.length - valid.length
    return valid
  }

  const lessons = parseProgression(data.lessons)
  skipped += lessons.skipped

  const backup: Backup = {
    app: APP,
    version: VERSION,
    exportedAt: isStr(data.exportedAt) ? data.exportedAt : '',
    customWords: pick(data.customWords, isCustomWord),
    savedItems: pick(data.savedItems, isSavedItem),
    reviewCards: pick(data.reviewCards, isReviewCard),
    attempts: pick(data.attempts, isAttempt),
    mistakes: pick(data.mistakes, isMistake),
    lessons: lessons.records,
    settings: parseSettingsBackup(data.settings),
  }
  return { ok: true, backup, skipped }
}

/**
 * Merges a backup into the local database: items from the backup are added,
 * items with the same key are replaced by the backup version.
 */
export async function importBackup(backup: Backup, skipped: number): Promise<ImportResult> {
  const result = await db.transaction('rw', [db.customWords, db.savedItems, db.reviewCards, db.attempts, db.mistakes], async () => {
    await db.customWords.bulkPut(backup.customWords)
    await db.savedItems.bulkPut(backup.savedItems)
    await db.reviewCards.bulkPut(backup.reviewCards)
    await db.mistakes.bulkPut(backup.mistakes)

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
      mistakes: backup.mistakes.length,
      lessons: 0,
      skipped,
      settings: false,
      reminderOff: false,
    }
  })
  result.lessons = mergeProgression(backup.lessons ?? {})
  const settings = backup.settings ?? {}
  result.settings = Object.keys(settings).length > 0
  result.reminderOff = await applySettings(settings)
  // Backups made before review cards existed restore saved words without cards.
  await syncReviewCards()
  await syncPracticeCards()
  return result
}
