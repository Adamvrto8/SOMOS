import { dayKey } from '../../lib/dates'
import type { DiaryNote } from '../../lib/db'

/** "sobota 7. novembra" for "2026-11-07", in the UI's locale. */
export function diaryDate(date: string, locale: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
}

/** The heading of a day in the list: Dnes, Včera, or the date. */
export function dayLabel(date: string, today: string, t: { today: string; yesterday: string }, locale: string): string {
  if (date === today) return t.today
  const [y, m, d] = today.split('-').map(Number)
  if (date === dayKey(new Date(y, m - 1, d - 1))) return t.yesterday
  return diaryDate(date, locale)
}

const lines = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean)

/** What a note shows as its name: its title, else the first line of its text. */
export const noteHeading = (note: Pick<DiaryNote, 'title' | 'text'>) => note.title.trim() || lines(note.text)[0] || ''

/** The text a list shows under the heading: what the heading did not take. */
export const notePreview = (note: Pick<DiaryNote, 'title' | 'text'>) => (note.title.trim() ? lines(note.text) : lines(note.text).slice(1)).join(' ')
