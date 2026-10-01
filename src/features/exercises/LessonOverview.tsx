import { Check } from 'lucide-react'
import { SectionTitle } from '../../components/SectionTitle'
import type { Task } from '../../lib/lesson'
import type { LessonRecord } from '../../lib/lessonProgress'
import { useMistakes } from '../../lib/mistakes'
import { exerciseInfo } from './exercises'
import { TaskAnswerList } from './TaskAnswerList'

interface LessonOverviewProps {
  lessonNumber: number
  record: LessonRecord
  tasks: Task[]
}

/** A passed lesson opens here first: its tasks with the correct answers, to read through before (or instead of) playing it again. */
export function LessonOverview({ lessonNumber, record, tasks }: LessonOverviewProps) {
  const mistakes = useMistakes()
  const mistakeKeys = new Set(mistakes?.map((m) => `${m.exercise}|${m.itemId}`))

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">
          Lekcia {lessonNumber} · {exerciseInfo(tasks[0].kind).label}
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">Prehľad lekcie</h1>
        <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-leaf/10 px-3 py-1.5 text-sm font-medium text-leaf">
          <Check size={16} strokeWidth={2.5} aria-hidden />
          Splnená ({record.bestScore}/{record.total})
        </p>
      </div>

      <section aria-labelledby="answers-heading">
        <SectionTitle id="answers-heading">Správne odpovede</SectionTitle>
        <TaskAnswerList tasks={tasks} isMistake={(task) => mistakeKeys.has(`${task.kind}|${task.itemId}`)} />
      </section>
    </div>
  )
}
