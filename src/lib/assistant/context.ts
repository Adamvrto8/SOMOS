import { readVariant } from '../../data/variant'
import { accountsAvailable, getAccount } from '../account'
import { getDailyGoal } from '../dailyGoal'
import { db } from '../db'
import { duelsAvailable } from '../duel/backend'
import { getLanguage } from '../language'
import { getLastActiveLesson, getProgressionSnapshot } from '../lessonProgress'
import { getOnboarding } from '../onboarding'
import { learnerUnits, nextStep, pathState, startLevelOf, stepHref, unitTitle } from '../path'
import { reminderSupport } from '../reminder'
import { loadDueCounts } from '../srs'
import { getTestResults } from '../testProgress'
import { buildAppMap, type AppFlags } from './appMap'
import { learnerProfile, type LearnerSnapshot } from './learner'
import { MAX_APP_CHARS, MAX_LEARNER_CHARS } from './limits'

// The device side of the assistant's context: reads the settings and tables that appMap.ts and learner.ts turn into
// text. Kept apart so those two stay pure (and testable without a browser).

export interface ChatContext {
  app: string
  learner: string
}

export const appFlags = (): AppFlags => ({
  duels: duelsAvailable,
  accounts: accountsAvailable,
  // 'denied' and 'unsupported' mean no reminder can arrive on this device either.
  reminders: reminderSupport() === 'ok',
})

/** Everything learnerProfile reads, from the device's tables and settings. */
export async function loadLearnerSnapshot(now = new Date()): Promise<LearnerSnapshot> {
  const [attempts, due, mistakes, saved, customWords, diaryCount, diary] = await Promise.all([
    db.attempts.toArray(),
    loadDueCounts(now),
    db.mistakes.toArray(),
    db.savedItems.count(),
    db.customWords.count(),
    db.diary.count(),
    db.diary.orderBy('date').reverse().limit(7).toArray(),
  ])
  const onboarding = getOnboarding()
  const lessons = getProgressionSnapshot()
  const tests = getTestResults()
  // As usePathState does it, without React.
  const next = nextStep(pathState(learnerUnits(onboarding), lessons, (key) => tests[key]?.passed === true, startLevelOf(onboarding)))
  const last = getLastActiveLesson()
  return {
    now,
    language: getLanguage(),
    variant: readVariant(),
    signedIn: getAccount() !== null,
    startLevel: onboarding?.level,
    motivation: onboarding?.motivation,
    goal: getDailyGoal(),
    attempts: attempts.map(({ at, correct, exercise }) => ({ at, correct, exercise })),
    due,
    mistakes,
    saved,
    customWords,
    diaryCount,
    diary: diary.map(({ date, learned }) => ({ date, learned })),
    lessons,
    tests,
    next: next && { title: unitTitle(next.unit.unit), step: next.step.id, href: stepHref(next.unit.unit, next.step.id) },
    lastLesson: last && { type: last.type, group: last.group, lesson: last.lesson, level: last.level },
  }
}

/** The app map and the learner's profile for one question; a profile that cannot be read is left out, the question still goes. */
export async function buildChatContext(): Promise<ChatContext> {
  const app = buildAppMap(appFlags()).slice(0, MAX_APP_CHARS)
  let learner = ''
  try {
    learner = learnerProfile(await loadLearnerSnapshot()).slice(0, MAX_LEARNER_CHARS)
  } catch (error) {
    console.error('assistant profile failed', error)
  }
  return { app, learner }
}
