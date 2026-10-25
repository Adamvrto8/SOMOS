import { sentenceById, verbById, wordById } from '../data'
import type { Person } from '../data/types'
import { conjugate, formText, PERSON_LABELS, TENSE_LABELS, type TableTense } from './conjugate'
import type { ReportReason } from './contentReport'
import { sentenceTranslation, wordTranslations } from './localized'

// Nástroje pre vývoj → Nahlásený obsah: the reports of content_reports_list() grouped by what they name, the content
// as the app has it now, and the text for a Claude session. Pure: ContentReports.tsx loads and handles them.

/** A row of content_reports as content_reports_list() returns it. */
export interface StoredReport {
  id: number
  target: string
  detail: string
  exercise: string
  reason: ReportReason
  note: string
  answer: string | null
  shown: { es: string; translation: string }
  version: string
  language: string
  created_at: string
  status: 'open' | 'fixed' | 'rejected'
  handled_at: string | null
}

export interface ReportGroup {
  target: string
  reports: StoredReport[] // newest first
}

/** Most reported first, then the one reported last. */
export function groupReports(reports: StoredReport[]): ReportGroup[] {
  const byTarget = new Map<string, StoredReport[]>()
  for (const r of reports) byTarget.set(r.target, [...(byTarget.get(r.target) ?? []), r])
  return [...byTarget]
    .map(([target, list]) => ({ target, reports: list.sort((a, b) => b.created_at.localeCompare(a.created_at)) }))
    .sort((a, b) => b.reports.length - a.reports.length || b.reports[0].created_at.localeCompare(a.reports[0].created_at))
}

/** The content as the app has it now, shown the way a report shows it; null when the id no longer exists. */
export function currentContent(target: string, detail: string): { es: string; translation: string } | null {
  const [kind, id] = target.split(':')
  if (kind === 'sentence') {
    const sentence = sentenceById.get(id)
    return sentence ? { es: sentence.es, translation: sentenceTranslation(sentence) } : null
  }
  if (kind === 'word') {
    const word = wordById.get(id)
    if (!word) return null
    return { es: word.gender ? `${word.gender === 'm' ? 'el' : 'la'} ${word.es}` : word.es, translation: wordTranslations(word).join(', ') }
  }
  if (kind === 'verb') {
    const verb = verbById.get(id)
    const estar = verbById.get('estar')
    if (!verb || !estar) return null
    const [tense, person] = detail.split(':')
    if (!Object.hasOwn(TENSE_LABELS, tense) || !Object.hasOwn(PERSON_LABELS, person)) return { es: verb.id, translation: verb.sk.join(', ') }
    return {
      es: formText(conjugate(verb, tense as TableTense, person as Person, estar)),
      translation: `${verb.id} · ${PERSON_LABELS[person as Person]} · ${TENSE_LABELS[tense as TableTense]}`,
    }
  }
  return null
}

const same = (a: { es: string; translation: string }, b: { es: string; translation: string }) => a.es === b.es && a.translation === b.translation

/** The reports as plain text, one block per target, for pasting into a Claude session. */
export function copyText(groups: ReportGroup[], reasons: Record<ReportReason, string>): string {
  return groups
    .map(({ target, reports }) => {
      const newest = reports[0]
      const now = currentContent(target, newest.detail)
      return [
        `${target} (${reports.length}×)${newest.detail ? ` · ${newest.detail}` : ''} · ${newest.exercise}`,
        `Videné: ${newest.shown.es} — ${newest.shown.translation}`,
        `Teraz: ${!now ? 'už neexistuje' : same(now, newest.shown) ? 'rovnaké' : `${now.es} — ${now.translation}`}`,
        ...reports.map((r) => {
          const detail = r.detail && r.detail !== newest.detail ? `, ${r.detail}` : ''
          return `- ${reasons[r.reason]}${r.answer ? ` · odpoveď: ${r.answer}` : ''}${r.note ? `: ${r.note}` : ''} (${r.created_at.slice(0, 10)}${detail})`
        }),
      ].join('\n')
    })
    .join('\n\n')
}
