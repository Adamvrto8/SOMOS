import { Mic, Square, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../../../i18n'
import { SpeechFailure, startRecording, type Recording, type SpeechError } from '../../../lib/speech'
import { bestMatch, type SpeechMatch } from '../../../lib/speechMatch'
import type { SpeakingTask } from '../../../lib/lesson'
import { speak, stopSpeaking } from '../../../lib/tts'
import { SpeechWords } from './SpeechWords'
import type { Status } from './status'

// Only a recording that was recognized uses up a try; errors (nothing heard, offline…) don't.
const MAX_TRIES = 3

interface SpeakingViewProps {
  task: SpeakingTask
  onAnswer: (answer: string) => void
  onSubmit: (answer: string) => void
  onSkipRest?: () => void
  /** Skontrolovať waits while the mic is open, so the attempt being spoken isn't skipped. */
  onRecordingChange?: (recording: boolean) => void
  status?: Status
}

/** Vyslovovanie: read the sentence aloud; up to 3 recordings, the best one is submitted. */
export function SpeakingView({ task, onAnswer, onSubmit, onSkipRest, onRecordingChange, status }: SpeakingViewProps) {
  const labels = useT().lesson.task
  const [tries, setTries] = useState(0)
  const [recording, setRecording] = useState(false)
  const [last, setLast] = useState<{ transcript: string; match: SpeechMatch } | null>(null)
  const [error, setError] = useState<SpeechError | null>(null)
  const current = useRef<Recording | null>(null)
  const best = useRef<{ transcript: string; missed: number } | null>(null)
  const graded = status !== undefined

  // Leaving the task (next task, ✕) throws away a recording in progress.
  useEffect(
    () => () => {
      current.current?.abort()
      current.current = null // tells the pending recording its task is gone
    },
    [],
  )

  useEffect(() => {
    onRecordingChange?.(recording)
    return () => onRecordingChange?.(false)
  }, [recording, onRecordingChange])

  // Graded: a recording still running must not change the answer any more.
  useEffect(() => {
    if (!graded || !current.current) return
    current.current.abort()
    current.current = null
    setRecording(false)
  }, [graded])

  const record = async () => {
    if (recording) return current.current?.stop()
    stopSpeaking() // the recognizer must not hear the phone itself
    setError(null)
    setRecording(true)
    const rec = startRecording()
    current.current = rec
    try {
      const result = bestMatch(await rec.result, task.sentence.es)
      if (current.current !== rec) return // unmounted meanwhile
      const used = tries + 1
      setTries(used)
      setLast(result)
      if (!best.current || result.match.missed < best.current.missed) {
        best.current = { transcript: result.transcript, missed: result.match.missed }
        onAnswer(result.transcript)
      }
      if (used >= MAX_TRIES) onSubmit(best.current.transcript)
    } catch (e) {
      if (current.current !== rec) return
      setError(e instanceof SpeechFailure ? e.code : 'failed')
    } finally {
      if (current.current === rec) {
        current.current = null
        setRecording(false)
      }
    }
  }

  const micBlocked = error === 'denied'

  return (
    <div className="space-y-5">
      <div className="rounded-card border border-line bg-surface p-5">
        <div className="flex items-start gap-2">
          {last ? (
            <div className="min-w-0 flex-1">
              <SpeechWords words={last.match.words} />
            </div>
          ) : (
            <p lang="es" className="min-w-0 flex-1 font-serif text-2xl leading-snug font-semibold">
              {task.sentence.es}
            </p>
          )}
          <button
            type="button"
            onClick={() => speak(task.sentence.es)}
            // The open mic would hear the phone read the sentence.
            disabled={recording}
            aria-label={labels.playSentence}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
          >
            <Volume2 size={20} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <p className="mt-2 text-ink-muted">{task.sentence.sk}</p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => void record()}
          disabled={graded || micBlocked}
          aria-label={recording ? labels.stopRecording : labels.record}
          className={[
            'flex size-20 items-center justify-center rounded-full text-on-accent shadow-md transition duration-150',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick',
            'disabled:pointer-events-none disabled:opacity-50',
            recording ? 'animate-pulse bg-error' : 'bg-brick active:scale-95',
          ].join(' ')}
        >
          {recording ? <Square size={28} strokeWidth={1.75} aria-hidden /> : <Mic size={32} strokeWidth={1.75} aria-hidden />}
        </button>
        <p role="status" className="min-h-5 text-sm text-ink-muted">
          {recording ? labels.listening : tries > 0 && !graded ? labels.attempt(tries, MAX_TRIES) : ''}
        </p>
        {last && !recording && (
          <p className="text-center text-sm text-ink-muted">
            {labels.recognized} <span lang="es">{last.transcript}</span>
          </p>
        )}
        {error && <p className="text-center text-sm text-error">{labels.speechErrors[error]}</p>}
      </div>

      {onSkipRest && !graded && (
        <button
          type="button"
          onClick={onSkipRest}
          className="h-11 w-full text-sm font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          {labels.cantSpeak}
        </button>
      )}
    </div>
  )
}
