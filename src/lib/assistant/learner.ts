import { sentenceById, wordById } from '../../data'
import type { Level } from '../../data/types'
import { dayKey } from '../dates'
import type { Attempt, DiaryEntry, Mistake } from '../db'
import type { Language } from '../language'
import type { LessonProgressionMap } from '../lessonProgress'
import type { Motivation } from '../onboarding'
import { byExercise, computeHistory, FREEZE_MAX, summarizeDays } from '../stats'
import type { TestResultsMap } from '../testProgress'

// Who is asking, for the assistant's system prompt (api/chat.ts puts it in <profil_ucenika>): the numbers the app shows
// on Domov, Prehľad, Cesta and Testy, in a few lines. Built fresh for every question, never stored. The device is read
// in context.ts (loadLearnerSnapshot), so this file stays pure.

export interface LearnerSnapshot {
  now: Date
  language: Language
  variant: 'mx' | 'es'
  signedIn: boolean
  startLevel?: Level
  motivation?: Motivation
  goal: number
  attempts: Pick<Attempt, 'at' | 'correct' | 'exercise'>[]
  due: { today: number; tomorrow: number }
  mistakes: Mistake[]
  saved: number
  customWords: number
  diaryCount: number
  /** The newest entries first, at most 7. */
  diary: Pick<DiaryEntry, 'date' | 'learned'>[]
  lessons: LessonProgressionMap
  tests: TestResultsMap
  next?: { title: string; step: string; href: string }
  lastLesson?: { type: string; group: string; lesson: number; level?: string }
}

export const clip = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`
}

const pct = (part: number, all: number) => (all ? `${Math.round((part / all) * 100)} %` : '–')

/** A lesson task's item as the learner saw it: "s001#0" → the sentence, a word id → the word, "tener:preterito:yo" spaced. */
export function describeItem(itemId: string): string {
  const sentence = sentenceById.get(itemId.split('#')[0])
  if (sentence) return `„${sentence.es}“`
  const word = wordById.get(itemId)
  if (word) return word.es
  return itemId.replace(/:/g, ' · ')
}

export function learnerProfile(s: LearnerSnapshot): string {
  const history = computeHistory(s.attempts, s.now, s.goal)
  const { streak } = history
  const week = summarizeDays(s.attempts, s.now, 7)
  const today = week[6]
  const activeDays = summarizeDays(s.attempts, s.now, 30).filter((d) => d.count > 0).length
  const exercises = byExercise(s.attempts)
  const rated = exercises.filter((e) => e.exercise !== 'review' && e.count >= 20)
  const weakest = rated.length ? rated.reduce((a, b) => (b.correct / b.count < a.correct / a.count ? b : a)) : undefined
  const topMistakes = [...s.mistakes].sort((a, b) => b.wrongCount - a.wrongCount || b.lastWrongAt - a.lastWrongAt).slice(0, 5)
  const passedLessons = Object.values(s.lessons).filter((r) => r.passed).length
  const passedTests = Object.entries(s.tests).filter(([, r]) => r.passed).map(([key]) => key)
  const exams = passedTests.filter((key) => /^(A1|A2|B1|B2)$/.test(key))
  const left = Math.max(0, s.goal - today.correct)

  const lines = [
    `Jazyk appky: ${s.language} · Španielčina: ${s.variant === 'es' ? 'zo Španielska' : 'mexická'} · Účet: ${s.signedIn ? 'prihlásený' : 'bez účtu'}`,
    `Začiatočná úroveň (z uvítania): ${s.startLevel ?? 'neuvedená'}${s.motivation ? ` · Dôvod učenia: ${s.motivation}` : ''} · Denný cieľ: ${s.goal} správnych odpovedí`,
    `Dnes: ${today.correct}/${s.goal} (${left === 0 ? 'cieľ splnený' : `chýba ${left}`}) · Séria: ${streak.days} dní (najdlhšia ${history.longestStreak}) · Ochrana série: ${streak.freezes}/${FREEZE_MAX}`,
    `Kartičky na zopakovanie: dnes ${s.due.today}, zajtra ${s.due.tomorrow}`,
    history.total && history.firstDay
      ? `Spolu: ${history.total} odpovedí, ${pct(history.correct, history.total)} správne, od ${dayKey(history.firstDay)} · aktívne dni za posledných 30: ${activeDays}`
      : 'Spolu: zatiaľ žiadne odpovede',
    `Posledných 7 dní (dátum odpovede/správne): ${week.map((d) => `${d.key.slice(5)} ${d.count}/${d.correct}`).join(', ')}`,
    exercises.length ? `Cvičenia (počet, úspešnosť): ${exercises.map((e) => `${e.exercise} ${e.count} (${pct(e.correct, e.count)})`).join(', ')}` : '',
    weakest ? `Najslabšie cvičenie: ${weakest.exercise} (${pct(weakest.correct, weakest.count)})` : '',
    `Chyby na precvičenie: ${s.mistakes.length}${topMistakes.length ? `; najčastejšie: ${topMistakes.map((m) => `${clip(describeItem(m.itemId), 90)} [${m.exercise}, ${m.wrongCount}×]`).join('; ')}` : ''}`,
    `Môj slovník: ${s.saved} uložených, ${s.customWords} vlastných slov`,
    `Zvládnuté lekcie: ${passedLessons} · Zložené testy: ${passedTests.length}${exams.length ? ` (skúšky úrovne: ${exams.join(', ')})` : ''}`,
    s.next ? `Cesta, ďalší krok: ${s.next.title} · ${s.next.step} → ${s.next.href}` : 'Cesta: hotová alebo nezačatá',
    s.lastLesson
      ? `Naposledy hraná lekcia: ${s.lastLesson.type} · ${s.lastLesson.group}${s.lastLesson.level ? ` · ${s.lastLesson.level}` : ''} · lekcia ${s.lastLesson.lesson}`
      : '',
    s.diary.length
      ? `Denník: ${s.diaryCount} zápisov; posledné „čo som sa naučil“: ${s.diary.slice(0, 3).map((e) => `${e.date}: ${clip(e.learned, 160) || '–'}`).join(' | ')}`
      : 'Denník: zatiaľ bez zápisov',
  ]
  return lines.filter(Boolean).join('\n')
}
