import { AUTO_REVIEW_LIMITS, type AutoReviewSettings } from './autoReview'
import { GOAL_OPTIONS } from './dailyGoal'
import type { ThemePref } from './theme'

/**
 * The settings a backup carries to another device. The voice is not among them (voices differ
 * between devices), and of the reminder only the time is restored: the push subscription and the
 * notification permission belong to the device, so the reminder has to be turned on there again.
 */
export interface SettingsBackup {
  theme?: ThemePref
  dailyGoal?: number
  autoReview?: AutoReviewSettings
  reminder?: { enabled: boolean; time: string }
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const isRec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** The valid settings in a backup file; anything unknown or out of range is left out. */
export function parseSettingsBackup(data: unknown): SettingsBackup {
  const settings: SettingsBackup = {}
  if (!isRec(data)) return settings
  const { theme, dailyGoal, autoReview, reminder } = data
  if (theme === 'system' || theme === 'light' || theme === 'dark') settings.theme = theme
  if ((GOAL_OPTIONS as readonly unknown[]).includes(dailyGoal)) settings.dailyGoal = dailyGoal as number
  if (isRec(autoReview) && typeof autoReview.enabled === 'boolean' && (AUTO_REVIEW_LIMITS as readonly unknown[]).includes(autoReview.limit)) {
    settings.autoReview = { enabled: autoReview.enabled, limit: autoReview.limit as AutoReviewSettings['limit'] }
  }
  if (isRec(reminder) && typeof reminder.enabled === 'boolean' && typeof reminder.time === 'string' && TIME.test(reminder.time)) {
    settings.reminder = { enabled: reminder.enabled, time: reminder.time }
  }
  return settings
}
