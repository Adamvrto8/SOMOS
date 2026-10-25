// Profil → Nástroje pre vývoj → Štatistiky používania: the aggregates of usage_report() (supabase/schema.sql).
// Only accounts in usage_admins get them; everyone else gets 'forbidden'. Loaded by UsageStats.tsx (account.ts
// needs a browser, so this file stays free of it and testable).

export interface LessonRow {
  by: 'type' | 'level'
  key: string // an exercise type or a level ('-' = lessons of every level)
  started: number
  finished: number
  quit: number // left through ✕
  usualStop: number | null // the most common number of tasks answered before ✕
}

export interface UsageReport {
  since: string
  devices: number
  active: { day: string; devices: number }[]
  returning: { new: number; nextDay: number; weekOld: number; withinWeek: number }
  welcome: Record<string, number>
  lessons: LessonRow[]
  screens: Record<string, number>
}

export type UsageReportError = 'forbidden' | 'offline'

/** Fewer devices than this in the period: percentages would mislead. */
export const MIN_DEVICES = 5

export function parseReportError(error: { message?: string }): UsageReportError {
  return error.message?.includes('forbidden') ? 'forbidden' : 'offline'
}

export function lessonRows(report: UsageReport, by: LessonRow['by']): LessonRow[] {
  return report.lessons.filter((r) => r.by === by).sort((a, b) => b.started - a.started)
}

export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null
}
