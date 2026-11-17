import { Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import { useAccount } from '../../lib/account'
import { answerParts } from '../../lib/assistant/answerText'
import { ask, ChatFailure, MAX_QUESTION_CHARS } from '../../lib/assistant/chat'
import { addTurn, useTurns } from '../../lib/assistant/history'
import { useDevMode } from '../../lib/devMode'

/** An answer with its links woven into the sentences: "otvor [opakovanie](/review)" shows "opakovanie" as a link. */
function AnswerText({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap">
      {answerParts(text).map((part, i) =>
        part.type === 'text' ? (
          part.text
        ) : (
          <Link
            key={i}
            to={part.to}
            className="font-medium text-brick underline decoration-brick/40 underline-offset-2 hover:decoration-brick focus-visible:outline-2 focus-visible:outline-brick"
          >
            {part.label}
          </Link>
        ),
      )}
    </p>
  )
}

/** Three dots that rise one after another while SOMO thinks; screen readers hear the label once. */
function Thinking({ label }: { label: string }) {
  return (
    <div role="status" className="flex w-fit items-center gap-1.5 rounded-card border border-line px-4 py-3 motion-safe:animate-fade-in">
      <span className="sr-only">{label}</span>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          aria-hidden="true"
          className="size-2 rounded-full bg-ink-muted opacity-35 animate-typing-dot"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}

/** /assistant — a prototype chat reachable from developer tools; the history lives in memory only (src/lib/assistant/history.ts). */
export function AssistantPage() {
  const text = useT().assistant
  const devMode = useDevMode()
  const account = useAccount()
  const turns = useTurns()
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryable, setRetryable] = useState(true)
  const [copied, setCopied] = useState(false)
  const busy = useRef(false)
  const end = useRef<HTMLDivElement>(null)

  // Keep the newest message in view.
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' })
  }, [turns, pending, error])

  // The prototype is reachable from developer tools only; anyone else lands on Domov.
  if (!devMode) return <Navigate to="/" replace />

  const send = async (question: string) => {
    const trimmed = question.trim()
    if (!trimmed || busy.current) return
    busy.current = true
    setError(null)
    setPending(trimmed)
    setDraft('')
    try {
      const answer = await ask(turns, trimmed)
      addTurn({ question: trimmed, answer: answer.text, truncated: answer.truncated, calls: answer.calls })
      setPending(null)
    } catch (failure) {
      // The question stays visible with "Skúsiť znova"; the history is untouched.
      const code = failure instanceof ChatFailure ? failure.code : 'failed'
      // A refused question is not sent again: the learner types a new one.
      setRetryable(code !== 'refused')
      setError(text.errors[code] ?? text.errors.failed)
    } finally {
      busy.current = false
    }
  }

  const copy = async () => {
    const all = turns.map((turn) => `${text.you}: ${turn.question}\n${text.assistant}: ${turn.answer}`).join('\n\n')
    try {
      await navigator.clipboard.writeText(all)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked: nothing to do.
    }
  }

  const waiting = pending !== null && error === null

  // Full-screen like the lesson player: no tab bar, so the input bar needs no offset above it.
  return (
    <div className="mx-auto flex h-dvh max-w-[480px] flex-col px-4">
      <header className="shrink-0 pt-2">
        <BackButton fallback="/profile" />
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{text.title}</h1>
      </header>

      {!account ? (
        <p className="mt-4 text-ink-muted">{text.needsAccount}</p>
      ) : (
        <>
          <main className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
            {turns.length === 0 && pending === null && <p className="text-ink-muted">{text.intro}</p>}

            {turns.map((turn, i) => (
              <section key={i} className="flex flex-col gap-2">
                <p className="max-w-[85%] self-end whitespace-pre-wrap rounded-card bg-surface-2 px-3 py-2">{turn.question}</p>
                <div className="rounded-card border border-line px-3 py-2">
                  <AnswerText text={turn.answer} />
                  {turn.truncated && <p className="mt-1 text-sm text-ink-muted">{text.truncated}</p>}
                  {turn.calls !== undefined && <p className="mt-1 text-xs text-ink-muted">{text.calls(turn.calls)}</p>}
                </div>
              </section>
            ))}

            {pending !== null && (
              <section className="flex flex-col gap-2">
                <p className="max-w-[85%] self-end whitespace-pre-wrap rounded-card bg-surface-2 px-3 py-2">{pending}</p>
                {waiting && <Thinking label={text.thinking} />}
                {error && (
                  <div role="alert" className="flex flex-col gap-2 rounded-card border border-line px-3 py-2">
                    <p>{error}</p>
                    {retryable && (
                      <Button variant="secondary" onClick={() => void send(pending)}>
                        {text.retry}
                      </Button>
                    )}
                  </div>
                )}
              </section>
            )}

            {turns.length > 0 && (
              <Button variant="secondary" onClick={() => void copy()}>
                {copied ? text.copied : text.copy}
              </Button>
            )}
            <div ref={end} />
          </main>

          <form
            className="flex shrink-0 items-center gap-2 border-t border-line py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            onSubmit={(event) => {
              event.preventDefault()
              void send(draft)
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={MAX_QUESTION_CHARS}
              placeholder={text.placeholder}
              aria-label={text.placeholder}
              disabled={waiting}
              className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-brick disabled:opacity-50"
            />
            <Button type="submit" icon={Send} className="w-12 shrink-0 px-0" disabled={waiting || draft.trim() === ''} aria-label={text.send} />
          </form>
        </>
      )}
    </div>
  )
}
