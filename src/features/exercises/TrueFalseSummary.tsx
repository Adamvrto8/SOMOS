import { Check, X } from 'lucide-react'
import { SpeakButton } from '../../components/SpeakButton'
import { useT } from '../../i18n'
import { learnerAnswerText, taskSubject } from '../../lib/contentReport'
import type { TrueFalseTask } from '../../lib/lesson'
import { sentenceTranslation } from '../../lib/localized'
import { ReportButton } from '../report/ReportButton'

interface TrueFalseSummaryProps {
  answers: { task: TrueFalseTask; correct: boolean }[]
}

/** The verdicts of a pravda/nepravda lesson, which waited for its end: every card, what was said, and the right sentence. */
export function TrueFalseSummary({ answers }: TrueFalseSummaryProps) {
  const lesson = useT().lesson
  const text = lesson.result
  return (
    <ul className="divide-y divide-line rounded-card border border-line bg-surface">
      {answers.map(({ task, correct }, i) => {
        // A right verdict says what the card was; a wrong one the opposite.
        const said = correct === task.truth ? 'true' : 'false'
        return (
          <li key={`${task.itemId}-${i}`} className="flex items-start gap-3 py-3 pr-1 pl-4">
            {correct ? (
              <Check size={20} strokeWidth={2.5} className="mt-1 shrink-0 text-leaf" aria-label={text.tfRight} />
            ) : (
              <X size={20} strokeWidth={2.5} className="mt-1 shrink-0 text-error" aria-label={text.tfWrong} />
            )}
            <div className="min-w-0 flex-1">
              <p lang="es" className={`font-serif text-lg leading-snug ${task.corrupted ? 'text-ink-muted line-through decoration-error/60' : ''}`}>
                {task.corrupted?.es ?? task.sentence.es}
              </p>
              {task.corrupted && (
                <>
                  <p lang="es" className="font-serif text-lg leading-snug">
                    {task.sentence.es}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-muted">{lesson.changedWord(task.corrupted.wrong, task.corrupted.right)}</p>
                </>
              )}
              <p className="mt-0.5 text-sm text-ink-muted">{sentenceTranslation(task.sentence)}</p>
              <p className={`mt-1 text-sm font-medium ${correct ? 'text-leaf' : 'text-error'}`}>
                {text.tfSaid(said === 'true' ? lesson.task.tfTrue : lesson.task.tfFalse)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-center">
              <SpeakButton text={task.sentence.es} />
              <ReportButton subject={taskSubject(task)} answer={correct ? null : learnerAnswerText(task, said)} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
