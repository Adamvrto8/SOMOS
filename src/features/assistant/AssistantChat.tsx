import { History, MessageSquarePlus, NotebookPen, Send, ThumbsDown, ThumbsUp, Trash2, Volume2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import { useAccount } from '../../lib/account'
import { answerBlocks, finishedPart, freshFollowUps, type AnswerPart, type ListItem } from '../../lib/assistant/answerText'
import { ask, ChatFailure, MAX_QUESTION_CHARS } from '../../lib/assistant/chat'
import { FEEDBACK_REASONS, feedbackRow, sendFeedback } from '../../lib/assistant/feedback'
import { addTurn, deleteChat, freshenChat, listChats, openChat, rateTurn, restoreLastChat, saveTurnToDiary, startNewChat, takeQueued, useChat } from '../../lib/assistant/history'
import { suggestionsFor, type Suggestion } from '../../lib/assistant/suggestions'
import type { ChatThread, ChatTurn, FeedbackReason } from '../../lib/db'
import { useDiaryNote } from '../../lib/diary'
import { speak, ttsSupported } from '../../lib/tts'
import { AnswerCardView } from './AnswerCards'

/** Text with its links woven into the sentences: "otvor [opakovanie](/review)" shows "opakovanie" as a link. */
function Paragraph({ parts }: { parts: AnswerPart[] }) {
  return (
    <p className="whitespace-pre-wrap">
      {parts.map((part, i) =>
        part.type === 'text' ? (
          part.text
        ) : part.type === 'strong' ? (
          <strong key={i} className="font-semibold">
            {part.text}
          </strong>
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

/** Examples as on a word's page: the Spanish to hear, the translation under it; other items as a plain list. */
function List({ items }: { items: ListItem[] }) {
  const text = useT().assistant
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) =>
        item.type === 'example' ? (
          <li key={i} className="flex items-start gap-1 border-l-2 border-line pl-3">
            <div className="min-w-0 flex-1">
              <p lang="es" className="font-serif text-lg leading-snug">
                {item.es}
              </p>
              <p className="text-sm text-ink-muted">{item.text}</p>
            </div>
            {ttsSupported && (
              <button
                type="button"
                onClick={() => speak(item.es)}
                aria-label={text.listen(item.es)}
                className="-mt-1 flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick"
              >
                <Volume2 size={18} strokeWidth={1.75} aria-hidden />
              </button>
            )}
          </li>
        ) : (
          <li key={i} className="ml-5 list-disc">
            <Paragraph parts={item.parts} />
          </li>
        ),
      )}
    </ul>
  )
}

/** An answer: its paragraphs and examples, and the cards the app draws from its data where the model put a marker. */
function AnswerView({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2">
      {answerBlocks(text).map((block, i) =>
        block.type === 'card' ? (
          <AnswerCardView key={i} card={block.card} />
        ) : block.type === 'list' ? (
          <List key={i} items={block.items} />
        ) : (
          <Paragraph key={i} parts={block.parts} />
        ),
      )}
    </div>
  )
}

/** Questions to tap instead of typing: by the page in an empty chat, the model's follow-ups under its newest answer. */
function QuestionChips({ label, questions, onPick }: { label: string; questions: string[]; onPick: (question: string) => void }) {
  if (questions.length === 0) return null
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {questions.map((question) => (
        <button
          key={question}
          type="button"
          onClick={() => onPick(question)}
          className="min-h-11 rounded-2xl border border-line bg-surface px-3 py-2 text-left text-sm font-medium text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brick active:bg-surface-2"
        >
          {question}
        </button>
      ))}
    </div>
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

/** Saves the question and the answer as a new note of today; a second tap adds nothing. */
function SaveToDiary({ turn, index }: { turn: ChatTurn; index: number }) {
  const text = useT().assistant
  const { noteId } = useChat()
  // A note deleted in the diary since: the answer can be saved again (to a new note).
  const note = useDiaryNote(noteId ?? '')
  const [busy, setBusy] = useState(false)
  const savedId = turn.saved && note ? note.id : undefined

  const save = async () => {
    setBusy(true)
    try {
      await saveTurnToDiary(index, text.noteQuestion)
    } finally {
      setBusy(false)
    }
  }

  if (savedId)
    return (
      <p className="mt-1 flex min-h-11 items-center gap-1.5 text-xs text-ink-muted">
        <NotebookPen size={14} strokeWidth={1.75} aria-hidden />
        {text.savedToDiary} ·{' '}
        <Link to={`/diary/${savedId}`} className="font-medium text-brick underline focus-visible:outline-2 focus-visible:outline-brick">
          {text.openDiary}
        </Link>
      </p>
    )
  return (
    <div className="mt-1">
      <button type="button" onClick={() => void save()} disabled={busy} aria-label={text.saveToDiary} title={text.saveToDiary} className={RATE_BUTTON}>
        <NotebookPen size={18} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  )
}

const RATE_BUTTON =
  'flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick disabled:opacity-50'

/** 👍 / 👎 under an answer; 👎 asks what was wrong. Sent to the server, kept on the turn once it got there. */
function Rating({ turn, index }: { turn: ChatTurn; index: number }) {
  const text = useT().assistant
  const [asking, setAsking] = useState(false)
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)

  const rate = async (rating: 'up' | 'down', reason?: FeedbackReason) => {
    setSending(true)
    setFailed(false)
    try {
      await sendFeedback(feedbackRow(turn, rating, reason))
      await rateTurn(index, rating, reason)
      setAsking(false)
    } catch (error) {
      console.error('SOMO: the rating was not sent', error)
      setFailed(true)
    } finally {
      setSending(false)
    }
  }

  if (turn.rating) {
    const Icon = turn.rating === 'up' ? ThumbsUp : ThumbsDown
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
        <Icon size={14} strokeWidth={1.75} aria-hidden />
        {text.rated}
      </p>
    )
  }
  return (
    <div className="mt-1">
      <div className="-ml-2 flex items-center">
        <button type="button" onClick={() => void rate('up')} disabled={sending} aria-label={text.rateUp} className={RATE_BUTTON}>
          <ThumbsUp size={18} strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setAsking(!asking)}
          disabled={sending}
          aria-label={text.rateDown}
          aria-expanded={asking}
          className={`${RATE_BUTTON} ${asking ? 'bg-surface-2 text-ink' : ''}`}
        >
          <ThumbsDown size={18} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      {asking && (
        <div role="group" aria-label={text.reasonsLabel} className="mt-1 flex flex-wrap gap-2">
          {FEEDBACK_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => void rate('down', reason)}
              disabled={sending}
              className="min-h-11 rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brick disabled:opacity-50"
            >
              {text.reasons[reason]}
            </button>
          ))}
        </div>
      )}
      {failed && (
        <p role="alert" className="mt-1 text-sm text-error">
          {text.rateFailed}
        </p>
      )}
    </div>
  )
}

const TOOL_BUTTON =
  'flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick disabled:opacity-50'

/** The stored conversations, newest first: tap one to go on with it. */
function ChatList({ currentId, onOpen, onBack }: { currentId: string | null; onOpen: (id: string) => void; onBack: () => void }) {
  const text = useT().assistant
  const [chats, setChats] = useState<ChatThread[] | null>(null)
  const reload = () => {
    void listChats().then(setChats, () => setChats([]))
  }
  useEffect(reload, [])

  const when = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })
  return (
    <div className="mt-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{text.historyTitle}</h3>
        <button type="button" onClick={onBack} className={`${TOOL_BUTTON} -mr-3`}>
          {text.backToChat}
        </button>
      </div>
      {chats?.length === 0 && <p className="text-ink-muted">{text.historyEmpty}</p>}
      {chats && chats.length > 0 && (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {chats.map((chat) => (
            <li key={chat.id} className="flex items-center">
              <button
                type="button"
                onClick={() => onOpen(chat.id)}
                aria-current={chat.id === currentId ? 'true' : undefined}
                className="min-h-13 min-w-0 flex-1 px-3 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brick active:bg-surface-2"
              >
                <span className={`block truncate ${chat.id === currentId ? 'font-semibold' : ''}`}>{chat.title}</span>
                <span className="block text-sm text-ink-muted">
                  {when.format(chat.updatedAt)} · {text.questions(chat.turns.length)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void deleteChat(chat.id).then(reload)}
                aria-label={text.deleteChat(chat.title)}
                className="flex size-11 shrink-0 items-center justify-center text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-brick"
              >
                <Trash2 size={18} strokeWidth={1.75} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-ink-muted">{text.deviceOnly}</p>
    </div>
  )
}

interface AssistantChatProps {
  /** What the learner was looking at when they opened SOMO (lib/assistant/page.ts). */
  page?: string
  /** The address of that page: the suggested questions of an empty chat follow it. */
  pathname?: string
}

/**
 * The conversation and the question field, for the /assistant page and the sheet over any screen. The conversation on
 * screen is shared by both and stored on the device (src/lib/assistant/history.ts): coming back within half an hour
 * opens it again, later SOMO starts empty, and "Rozhovory" lists the earlier ones.
 */
export function AssistantChat({ page, pathname }: AssistantChatProps) {
  const text = useT().assistant
  const account = useAccount()
  const chat = useChat()
  const { turns } = chat
  const [view, setView] = useState<'chat' | 'list'>('chat')
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryable, setRetryable] = useState(true)
  const [copied, setCopied] = useState(false)
  /** The answer of the question on its way, as far as the model has written it. */
  const [streaming, setStreaming] = useState('')
  /**
   * The height the newest exchange takes at least once a question is sent, so the question can sit at the top of the
   * conversation while the answer is written under it (null = no question sent since the conversation was opened).
   */
  const [anchorHeight, setAnchorHeight] = useState<number | null>(null)
  const busy = useRef(false)
  const box = useRef<HTMLDivElement>(null)
  const latest = useRef<HTMLDivElement>(null)
  const end = useRef<HTMLDivElement>(null)

  // An old conversation gives way to an empty chat: at the app start, when SOMO opens and when the app comes back.
  useEffect(() => {
    freshenChat()
    void restoreLastChat()
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || busy.current) return
      if (freshenChat()) {
        setPending(null)
        setError(null)
        setAnchorHeight(null)
        setView('chat')
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // A conversation opened (restored, from the list, back from the list) shows its end.
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' })
  }, [chat.id, view])

  // A question sent goes to the top, and the answer is written under it; the learner scrolls down when they want.
  useLayoutEffect(() => {
    const scroller = box.current
    const question = latest.current
    if (pending === null || anchorHeight === null || !scroller || !question) return
    const top = scroller.scrollTop + question.getBoundingClientRect().top - scroller.getBoundingClientRect().top
    scroller.scrollTo?.({ top, behavior: 'smooth' })
  }, [pending, anchorHeight])

  // "Prečo?" from a lesson or Chyby: its question goes by itself once the chat is ready.
  useEffect(() => {
    if (!account || !chat.ready || chat.queued === null || busy.current) return
    const question = takeQueued()
    if (question) void send(question)
  })

  if (!account) return <p className="mt-4 text-ink-muted">{text.needsAccount}</p>

  async function send(question: string) {
    const trimmed = question.trim()
    if (!trimmed || busy.current) return
    busy.current = true
    setError(null)
    setPending(trimmed)
    setDraft('')
    setStreaming('')
    if (box.current) setAnchorHeight(box.current.clientHeight)
    try {
      const answer = await ask(turns, trimmed, { page, onText: setStreaming })
      // addTurn puts the turn on screen before it stores it: drop the waiting question in the same render, so the
      // question is never shown twice.
      const stored = addTurn({ question: trimmed, answer: answer.text, truncated: answer.truncated, calls: answer.calls, tools: answer.tools, page })
      setPending(null)
      setStreaming('')
      await stored
    } catch (failure) {
      setStreaming('')
      // The question stays visible with "Skúsiť znova"; the conversation is untouched.
      const code = failure instanceof ChatFailure ? failure.code : 'failed'
      // A refused question is not sent again: the learner types a new one.
      setRetryable(code !== 'refused')
      setError(text.errors[code] ?? text.errors.failed)
    } finally {
      busy.current = false
    }
  }

  /** Leaving the conversation drops a failed question that was waiting for "Skúsiť znova". */
  const dropPending = () => {
    setPending(null)
    setError(null)
    setAnchorHeight(null)
  }

  // Copied as the model wrote it, links as [label](/path) and cards as markers: the eval checks exactly that.
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
  const suggestionText = (suggestion: Suggestion) => ('name' in suggestion ? text.suggest[suggestion.kind](suggestion.name) : text.suggest[suggestion.kind])
  const followUps = pending === null ? freshFollowUps(turns) : []
  // The newest finished turn is drawn with its chips in the newest exchange, unless a question is on its way.
  const earlier = pending === null ? turns.slice(0, -1) : turns
  const newest = pending === null ? turns.at(-1) : undefined
  const shownSoFar = finishedPart(streaming)

  const turnView = (turn: ChatTurn, i: number) => (
    <section key={i} className="flex flex-col gap-2">
      <p className="max-w-[85%] self-end whitespace-pre-wrap rounded-card bg-surface-2 px-3 py-2">{turn.question}</p>
      <div className="rounded-card border border-line px-3 py-2">
        <AnswerView text={turn.answer} />
        {turn.truncated && <p className="mt-1 text-sm text-ink-muted">{text.truncated}</p>}
        {turn.calls !== undefined && <p className="mt-1 text-xs text-ink-muted">{text.calls(turn.calls)}</p>}
        <div className="flex flex-wrap items-start gap-x-1">
          <Rating turn={turn} index={i} />
          <SaveToDiary turn={turn} index={i} />
        </div>
      </div>
    </section>
  )

  if (view === 'list') {
    return (
      <ChatList
        currentId={chat.id}
        onBack={() => setView('chat')}
        onOpen={(id) => {
          dropPending()
          void openChat(id).then(() => setView('chat'))
        }}
      />
    )
  }

  return (
    <>
      <div className="mt-1 flex shrink-0 items-center justify-between">
        <button type="button" onClick={() => setView('list')} disabled={waiting} className={`${TOOL_BUTTON} -ml-3`}>
          <History size={18} strokeWidth={1.75} aria-hidden />
          {text.history}
        </button>
        {(turns.length > 0 || pending !== null) && (
          <button
            type="button"
            onClick={() => {
              dropPending()
              startNewChat()
            }}
            disabled={waiting}
            className={`${TOOL_BUTTON} -mr-3`}
          >
            <MessageSquarePlus size={18} strokeWidth={1.75} aria-hidden />
            {text.newChat}
          </button>
        )}
      </div>

      <div ref={box} className="mt-2 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
        {turns.length === 0 && pending === null && (
          <div className="flex flex-col gap-3">
            <p className="text-ink-muted">{text.intro}</p>
            <QuestionChips label={text.suggestionsLabel} questions={suggestionsFor(pathname).map(suggestionText)} onPick={(question) => void send(question)} />
          </div>
        )}

        {earlier.map((turn, i) => turnView(turn, i))}

        <div ref={latest} className="flex flex-col gap-4" style={anchorHeight !== null ? { minHeight: anchorHeight } : undefined}>
          {newest && turnView(newest, turns.length - 1)}

          <QuestionChips label={text.followUpsLabel} questions={followUps} onPick={(question) => void send(question)} />

          {pending !== null && (
            <section className="flex flex-col gap-2">
              <p className="max-w-[85%] self-end whitespace-pre-wrap rounded-card bg-surface-2 px-3 py-2">{pending}</p>
              {waiting && shownSoFar.trim() !== '' && (
                <div className="rounded-card border border-line px-3 py-2">
                  <AnswerView text={shownSoFar} />
                </div>
              )}
              {waiting && shownSoFar.trim() === '' && <Thinking label={text.thinking} />}
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
        </div>
        <div ref={end} />
      </div>

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
          disabled={waiting || !chat.ready}
          className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-brick disabled:opacity-50"
        />
        <Button
          type="submit"
          icon={Send}
          className="w-12 shrink-0 px-0"
          disabled={waiting || !chat.ready || draft.trim() === ''}
          aria-label={text.send}
        />
      </form>
    </>
  )
}
