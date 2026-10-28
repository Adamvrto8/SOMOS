import { topicById } from '../../data'
import { t } from '../../i18n'
import { topicName } from '../../lib/localized'
import { testToParams, type TestId } from '../../lib/tests'
import { exerciseInfo } from '../exercises/exercises'

/** "Jedlo a pitie · A1" for a topic test ("Jedlo a pitie 2 · A1" for a part of it), "Test: Slovná zásoba · A1" for an exercise test, "Skúška A1" for the level exam. */
export function testTitle({ level, topic, type, part }: TestId): string {
  if (type) return t().tests.exerciseTest(exerciseInfo(type).label, level)
  const found = topic ? topicById.get(topic) : undefined
  return found ? t().tests.topicTest(`${topicName(found)}${part ? ` ${part}` : ''}`, level) : t().tests.exam(level)
}

/** A day as the learner's language writes it: "18. 10. 2026". */
export const shortDate = (at: number) => new Date(at).toLocaleDateString(t().dateLocale)

export const testHref = (test: TestId) => `/practice/test?${testToParams(test)}`
