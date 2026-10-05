import { AUTO_REVIEW_LIMITS, type AutoReviewSettings } from './autoReview'
import { GOAL_OPTIONS } from './dailyGoal'
import { parseLanguage, type Language } from './language'
import { parseLook, type Look } from './look'
import type { ThemePref } from './theme'

/**
 * The settings a backup carries to another device. The voice is not among them (voices differ
 * between devices), and of the reminder only the time is restored: the push subscription and the
 * notification permission belong to the device, so the reminder has to be turned on there again.
 */
export interface SettingsBackup {
  theme?: ThemePref
  look?: Look // missing in backups made before 2026-10-05
  dailyGoal?: number
  autoReview?: AutoReviewSettings
  reminder?: { enabled: boolean; time: string }
  language?: Language // missing in backups made before 2026-10-04
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const isRec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** The valid settings in a backup file; anything unknown or out of range is left out. */
export function parseSettingsBackup(data: unknown): SettingsBackup {
  const settings: SettingsBackup = {}
  if (!isRec(data)) return settings
  const { theme, look, dailyGoal, autoReview, reminder, language } = data
  if (theme === 'system' || theme === 'light' || theme === 'dark') settings.theme = theme
  const parsedLook = parseLook(look)
  if (parsedLook) settings.look = parsedLook
  if ((GOAL_OPTIONS as readonly unknown[]).includes(dailyGoal)) settings.dailyGoal = dailyGoal as number
  if (isRec(autoReview) && typeof autoReview.enabled === 'boolean' && (AUTO_REVIEW_LIMITS as readonly unknown[]).includes(autoReview.limit)) {
    settings.autoReview = { enabled: autoReview.enabled, limit: autoReview.limit as AutoReviewSettings['limit'] }
  }
  if (isRec(reminder) && typeof reminder.enabled === 'boolean' && typeof reminder.time === 'string' && TIME.test(reminder.time)) {
    settings.reminder = { enabled: reminder.enabled, time: reminder.time }
  }
  const parsedLanguage = parseLanguage(language)
  if (parsedLanguage) settings.language = parsedLanguage
  return settings
}
