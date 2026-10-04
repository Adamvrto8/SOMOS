import { SpeakButton } from '../../components/SpeakButton'
import { useT } from '../../i18n'
import { useLanguage } from '../../lib/language'
import type { Task } from '../../lib/lesson'
import { taskSummary } from './taskSummary'

interface TaskAnswerListProps {
  tasks: Task[]
  /** Tasks to mark as being on the mistakes list. */
  isMistake?: (task: Task) => boolean
}

/** What each task asked and its correct answer, with 🔊. */
export function TaskAnswerList({ tasks, isMistake }: TaskAnswerListProps) {
  const text = useT().lesson.overview
  const language = useLanguage()
  return (
    <ul className="divide-y divide-line rounded-card border border-line bg-surface">
      {tasks.map((task, i) => {
        const { prompt, answer } = taskSummary(task)
        const isSlovakAnswer = task.kind === 'vocab' && task.direction === 'es-sk'
        return (
          <li key={`${task.itemId}-${i}`} className="flex items-start gap-1 py-3 pr-1 pl-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink-muted">{prompt}</p>
              <p lang={isSlovakAnswer ? language : 'es'} className="font-serif text-lg leading-snug">
                {answer}
              </p>
              {isMistake?.(task) && <p className="mt-0.5 text-xs font-medium text-error">{text.inMistakes}</p>}
            </div>
            <SpeakButton text={task.kind === 'vocab' ? task.word.es : answer} />
          </li>
        )
      })}
    </ul>
  )
}
