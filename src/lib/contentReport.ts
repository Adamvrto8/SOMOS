import type { Sentence, Word } from '../data/types'
import { PERSON_LABELS, TENSE_LABELS } from './conjugate'
import { dayKey } from './dates'
import { getLanguage, type Language } from './language'
import type { ExerciseType, Task } from './lesson'
import { sentenceTranslation, wordTranslations } from './localized'

// "Nahlásiť chybu" (docs/superpowers/specs/2026-10-25-content-reports-design.md): what a report names, and sending
// it to api/report.ts. Anonymous: no account, nothing about the learner but what they chose and wrote.

export type ReportReason = 'spanish' | 'translation' | 'answer' | 'other'
export const REPORT_REASONS: ReportReason[] = ['spanish', 'translation', 'answer', 'other']

/** The server's pattern for a target (api/report.ts). */
export const TARGET_PATTERN = /^(sentence|word|verb):[a-z0-9ñ-]{1,60}$/

export interface ReportSubject {
  target: string // sentence:s001, word:casa, verb:tener
  detail: string // cloze index, verb form (preterito:yo), vocab direction
  exercise: ExerciseType | 'word'
  shown: { es: string; translation: string } // as on screen
}

export interface ContentReport extends ReportSubject {
  reason: ReportReason
  note: string
  answer: string | null
  version: string
  language: Language
}

const NOTE_MAX = 500
const ANSWER_MAX = 200
const SHOWN_MAX = 300

const sentenceShown = (sentence: Sentence) => ({ es: sentence.es, translation: sentenceTranslation(sentence) })
const wordShown = (word: Word) => ({
  es: word.gender ? `${word.gender === 'm' ? 'el' : 'la'} ${word.es}` : word.es,
  translation: wordTranslations(word).join(', '),
})

export function taskSubject(task: Task): ReportSubject {
  switch (task.kind) {
    case 'cloze':
    case 'choice':
      return { target: `sentence:${task.sentence.id}`, detail: task.itemId.split('#')[1] ?? '', exercise: task.kind, shown: sentenceShown(task.sentence) }
    case 'builder':
    case 'translation':
    case 'dictation':
    case 'speaking':
      return { target: `sentence:${task.sentence.id}`, detail: '', exercise: task.kind, shown: sentenceShown(task.sentence) }
    case 'vocab':
      return { target: `word:${task.word.id}`, detail: task.direction, exercise: 'vocab', shown: wordShown(task.word) }
    case 'conjugation':
      return {
        target: `verb:${task.verb.id}`,
        detail: `${task.tense}:${task.person}`,
        exercise: 'conjugation',
        shown: { es: task.answer, translation: `${task.verb.id} · ${PERSON_LABELS[task.person]} · ${TENSE_LABELS[task.tense]}` },
      }
  }
}

export function wordSubject(word: Word): ReportSubject {
  return { target: `word:${word.id}`, detail: '', exercise: 'word', shown: wordShown(word) }
}

/** The learner's answer as text: builder tiles joined with spaces. */
export function answerText(answer: string | string[]): string {
  return (Array.isArray(answer) ? answer.join(' ') : answer).trim()
}

export function buildReport(subject: ReportSubject, reason: ReportReason, note: string, answer: string | null): ContentReport {
  return {
    ...subject,
    shown: { es: subject.shown.es.slice(0, SHOWN_MAX), translation: subject.shown.translation.slice(0, SHOWN_MAX) },
    reason,
    note: note.trim().slice(0, NOTE_MAX),
    answer: reason === 'answer' && answer ? answer.slice(0, ANSWER_MAX) : null,
    // Tests run without the build's define.
    version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev',
    language: getLanguage(),
  }
}

export async function sendReport(report: ContentReport): Promise<'sent' | 'too-many' | 'failed'> {
  try {
    const res = await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) })
    if (res.ok) return 'sent'
    return res.status === 429 ? 'too-many' : 'failed'
  } catch {
    return 'failed'
  }
}

// Which targets this device reported today: the flag shows filled (a second report is still possible).
const REPORTED_KEY = 'somos-reported'

function readReported(): { day: string; targets: string[] } {
  const day = dayKey(new Date())
  try {
    const parsed = JSON.parse(localStorage.getItem(REPORTED_KEY) ?? 'null') as { day?: unknown; targets?: unknown } | null
    if (parsed?.day === day && Array.isArray(parsed.targets)) return { day, targets: parsed.targets.filter((t): t is string => typeof t === 'string') }
  } catch {
    // Unreadable or blocked: nothing reported.
  }
  return { day, targets: [] }
}

export const reportedToday = (target: string) => readReported().targets.includes(target)

export function markReported(target: string) {
  const { day, targets } = readReported()
  try {
    localStorage.setItem(REPORTED_KEY, JSON.stringify({ day, targets: [...new Set([...targets, target])] }))
  } catch {
    // The flag just won't stay filled.
  }
}
