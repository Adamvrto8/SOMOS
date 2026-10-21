import { useSearchParams } from 'react-router'
import { ExercisePage } from './ExercisePage'
import { PracticeHub } from './PracticeHub'

/**
 * Cvičiť: the hub (`/practice`), or one exercise with its lessons (`/practice?type=…`).
 * The tab bar always leads to the hub; lessons and tests lead back to their exercise.
 */
export function PracticePage() {
  const [params] = useSearchParams()
  return params.has('type') ? <ExercisePage /> : <PracticeHub />
}
