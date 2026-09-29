import { Dumbbell, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { SpeakButton } from '../../components/SpeakButton'
import type { Mistake } from '../../lib/db'
import { taskFromItem, type ExerciseType, type Task } from '../../lib/lesson'
import { clearMistakes, removeMistake } from '../../lib/mistakes'
import { exerciseInfo } from '../exercises/exercises'
import { taskSummary } from '../exercises/taskSummary'
import { ArchiveFilters, NoMatches } from './ArchiveFilters'
import { EmptyState } from './EmptyState'
import { useArchiveFilter } from './useArchiveFilter'

const taskTopics = (task: Task): string[] => {
  if (task.kind === 'conjugation') return []
  if (task.kind === 'vocab') return task.word.topics
  return task.sentence.topics
}

/** "Chyby": exercises answered wrong, kept until the learner removes them. */
export function MistakesTab({ mistakes }: { mistakes: Mistake[] }) {
  const [confirmClear, setConfirmClear] = useState(false)

  // The clear-all confirmation expires so a later stray tap can't wipe the list.
  useEffect(() => {
    if (!confirmClear) return
    const timer = setTimeout(() => setConfirmClear(false), 4000)
    return () => clearTimeout(timer)
  }, [confirmClear])

  const rows = mistakes.flatMap((m) => {
    const task = taskFromItem(m.exercise as ExerciseType, m.itemId)
    return task ? [{ mistake: m, task, ...taskSummary(task) }] : []
  })
  const topicIds = new Set(rows.flatMap(({ task }) => taskTopics(task)))
  const filter = useArchiveFilter(topicIds)

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Žiadne chyby"
        text="Keď v lekcii odpovieš zle, úloha sa uloží sem. Precvičíš si ju, kedy chceš, a keď ju budeš vedieť, odstrániš ju."
      />
    )
  }

  const visible = rows.filter(
    ({ task, prompt, answer }) =>
      (!filter.topic || taskTopics(task).includes(filter.topic)) && filter.matches([prompt, answer]),
  )

  return (
    <>
      <Link
        to="/practice/lesson?mistakes=1"
        className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-brick px-5 font-semibold text-on-accent transition duration-150 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
      >
        <Dumbbell size={18} strokeWidth={1.75} aria-hidden />
        Precvičiť chyby
      </Link>

      <ArchiveFilters filter={filter} />

      {visible.length === 0 ? (
        <NoMatches />
      ) : (
        <ul className="divide-y divide-line">
          {visible.map(({ mistake, task, prompt, answer }) => (
            <li key={`${mistake.exercise}:${mistake.itemId}`} className="flex items-start gap-1 py-3">
              <div className="min-w-0 flex-1 pt-1">
                <p className="text-xs text-ink-muted">
                  {exerciseInfo(task.kind).label} · {mistake.wrongCount}× zle
                </p>
                <p className="text-sm text-ink-muted">{prompt}</p>
                <p lang="es" className="font-serif text-lg leading-snug">
                  {answer}
                </p>
              </div>
              <SpeakButton text={answer} />
              <button
                type="button"
                onClick={() => void removeMistake(mistake.exercise, mistake.itemId)}
                aria-label={`Odstrániť z chýb: ${answer}`}
                title="Odstrániť z chýb"
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick"
              >
                <X size={18} strokeWidth={1.75} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button
        variant={confirmClear ? 'danger-solid' : 'danger'}
        icon={Trash2}
        onClick={() => (confirmClear ? void clearMistakes() : setConfirmClear(true))}
        className="w-full"
      >
        {confirmClear ? 'Naozaj vymazať všetky?' : 'Vymazať všetky chyby'}
      </Button>
    </>
  )
}
