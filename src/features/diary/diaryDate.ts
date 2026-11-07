import type { DiaryEntry } from '../../lib/db'

/** "sobota 7. novembra" for "2026-11-07", in the UI's locale. */
export function diaryDate(date: string, locale: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
}

/** The first line with text, for a list row or the Domov card. */
export const firstLine = (text: string) => text.split('\n').find((line) => line.trim())?.trim() ?? ''

/** What a day shows in a list or on the card: the first line of the Spanish, else of the other field. */
export const entryLine = (entry: DiaryEntry) => firstLine(entry.es) || firstLine(entry.learned)
