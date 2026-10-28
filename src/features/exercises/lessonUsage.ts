import type { Level } from '../../data/types'
import type { ExerciseType, LessonFilter } from '../../lib/lesson'
import type { TestId } from '../../lib/tests'
import { track, type UsageProps } from '../../lib/usage'

// The lesson events of the usage statistics (src/lib/usage.ts, api/usage.ts): one lesson_start when a fresh
// lesson begins and exactly one lesson_end for it, however it ends (result screen, ✕, the phone's back button).

export type LessonSource = 'lesson' | 'mistakes' | 'test' | 'first' | 'path'

export interface LessonUsage {
  /** 'mixed': the mistakes list and test preparation mix exercise types (their URL has no type). */
  type: ExerciseType | 'mixed'
  level: Level | null
  topic: string | null
  source: LessonSource
}

/** `unit`: a step of the path (src/lib/path.ts), which mixes exercise types too. */
export function lessonUsage(filter: LessonFilter, source: LessonSource, test?: TestId, unit?: { level: Level; topic: string }): LessonUsage {
  if (unit) return { type: 'mixed', level: unit.level, topic: unit.topic, source }
  if (source === 'mistakes') return { type: 'mixed', level: null, topic: null, source }
  if (source === 'test') return { type: test?.type ?? 'mixed', level: test?.level ?? null, topic: test?.topic ?? null, source }
  const topic = filter.topic && filter.topic !== 'all' ? filter.topic : null
  return { type: filter.type, level: filter.level ?? null, topic, source }
}

export interface LessonRun {
  /** One more task answered in this lesson; ignored once it has ended (correction rounds). */
  answered(): void
  /** Reports the end the first time only. */
  end(finished: boolean): void
}

/** Starts a lesson's statistics; null for a lesson without tasks. Counts are capped as the server takes them. */
export function createLessonRun(usage: LessonUsage, total: number, send: (name: string, props: UsageProps) => void = track): LessonRun | null {
  if (total <= 0) return null
  const { type, level, topic, source } = usage
  send('lesson_start', { type, level, topic, source })
  let answered = 0
  let ended = false
  return {
    answered() {
      if (!ended) answered++
    },
    end(finished) {
      if (ended) return
      ended = true
      send('lesson_end', { type, level, total: Math.min(total, 100), answered: Math.min(answered, 100), finished })
    },
  }
}
