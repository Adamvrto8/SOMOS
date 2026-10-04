import { Eye, Snail, Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../../components/Button'
import { useT } from '../../../i18n'
import type { DictationTask, Grade } from '../../../lib/lesson'
import { SLOW_RATE, speak, ttsSupported } from '../../../lib/tts'
import type { Status } from './status'
import { TypedAnswer } from './TypedAnswer'

interface DictationViewProps {
  task: DictationTask
  answer: string
  onAnswer: (answer: string) => void
  onSubmit: () => void
  status?: Status
  hint?: Grade | null
}

/** Diktát: hear the sentence (normal or slow) and type it. The Slovak meaning stays hidden until asked for. */
export function DictationView({ task, answer, onAnswer, onSubmit, status, hint }: DictationViewProps) {
  // Without a voice the task still works as a translation.
  const [showMeaning, setShowMeaning] = useState(!ttsSupported)
  const text = task.sentence.es
  const labels = useT().lesson.task

  // Starting the lesson was a tap, so Chrome lets the page speak right away.
  useEffect(() => {
    speak(text)
  }, [text])

  return (
    <div className="space-y-5">
      {ttsSupported ? (
        <div className="grid grid-cols-2 gap-3">
          {/* preventDefault keeps the focus (and the phone keyboard) in the answer field. */}
          <Button variant="secondary" icon={Volume2} onPointerDown={(e) => e.preventDefault()} onClick={() => speak(text)}>
            {labels.play}
          </Button>
          <Button variant="secondary" icon={Snail} onPointerDown={(e) => e.preventDefault()} onClick={() => speak(text, { rate: SLOW_RATE })}>
            {labels.slowly}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">{labels.noTts}</p>
      )}

      {showMeaning || status ? (
        <p className="text-ink-muted">{task.sentence.sk}</p>
      ) : (
        <button
          type="button"
          onClick={() => setShowMeaning(true)}
          className="flex h-11 items-center gap-2 text-sm font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          <Eye size={16} strokeWidth={1.75} aria-hidden />
          {labels.showMeaning}
        </button>
      )}

      <TypedAnswer
        value={answer}
        onChange={onAnswer}
        onSubmit={onSubmit}
        status={status}
        hint={hint}
        label={labels.heardLabel}
        placeholder={labels.inSpanish}
        multiline
      />
    </div>
  )
}
