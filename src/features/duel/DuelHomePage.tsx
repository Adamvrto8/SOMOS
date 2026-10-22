import { LogIn, Swords } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { Button } from '../../components/Button'
import { SectionTitle } from '../../components/SectionTitle'
import { Segmented } from '../../components/Segmented'
import type { Level } from '../../data/types'
import { useT } from '../../i18n'
import { DuelError, normalizeCode, type DuelSnapshot } from '../../lib/duel/backend'
import { DUEL_LEVELS, scoreOf, slotsOf } from '../../lib/duel/match'
import { NicknameForm } from './NicknameForm'
import { useDuelPlayer } from './useDuel'

type Outcome = 'won' | 'lost' | 'draw'

/** `/duel`: who you play as, a new room, joining one by its code, and the matches so far. */
export function DuelHomePage() {
  const dictionary = useT()
  const text = dictionary.duel
  const navigate = useNavigate()
  const { backend, me, error, saveNickname } = useDuelPlayer()
  const [editing, setEditing] = useState(false)
  const [level, setLevel] = useState<Level>('A1')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [history, setHistory] = useState<DuelSnapshot[] | null>(null)

  useEffect(() => {
    if (!backend || !me?.nickname) return
    let alive = true
    backend.history().then(
      (list) => alive && setHistory(list),
      () => alive && setHistory([]),
    )
    return () => {
      alive = false
    }
  }, [backend, me?.nickname])

  const run = async (action: () => Promise<string>) => {
    setBusy(true)
    setFailure(null)
    try {
      void navigate(`/duel/${await action()}`)
    } catch (e) {
      setFailure(text.errors[e instanceof DuelError ? e.code : 'failed'])
    } finally {
      setBusy(false)
    }
  }

  const outcomeOf = ({ room, answers }: DuelSnapshot): Outcome => {
    const winner = scoreOf(slotsOf(room.rounds), room.startedAt ?? 0, answers, [room.host.id, room.guest?.id ?? '']).winner
    return winner === null ? 'draw' : winner === me?.id ? 'won' : 'lost'
  }
  const outcomes = (history ?? []).map(outcomeOf)
  const count = (o: Outcome) => outcomes.filter((x) => x === o).length

  let body
  if (error) body = <p className="text-ink-muted">{text.errors[error.code]}</p>
  else if (me === undefined) body = null
  else if (me === null)
    body = (
      <div className="rounded-card border border-line bg-surface p-4">
        <p className="text-ink-muted">{text.signIn}</p>
        <Link to="/profile/sign-in" className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-brick px-5 font-semibold text-on-accent">
          {text.signInButton}
        </Link>
      </div>
    )
  else if (!me.nickname || editing)
    body = (
      <NicknameForm
        initial={me.nickname}
        onSave={async (nickname) => {
          await saveNickname(nickname)
          setEditing(false)
        }}
      />
    )
  else
    body = (
      <>
        <p className="text-sm text-ink-muted">
          {text.playingAs(me.nickname)} ·{' '}
          <button type="button" onClick={() => setEditing(true)} className="font-medium text-brick underline-offset-2 hover:underline">
            {text.change}
          </button>
        </p>

        <section aria-labelledby="duel-new" className="rounded-card border border-line bg-surface p-4">
          <h2 id="duel-new" className="font-semibold">
            {text.newRoom}
          </h2>
          <div className="mt-3">
            <Segmented mode="radio" label={text.level} idPrefix="duel-level" value={level} onChange={setLevel} options={DUEL_LEVELS.map((l) => ({ id: l, label: l }))} />
          </div>
          <Button icon={Swords} disabled={busy || !backend} onClick={() => void run(async () => (await backend!.createRoom(level)).code)} className="mt-4 w-full">
            {text.create}
          </Button>
        </section>

        <form
          className="rounded-card border border-line bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (normalizeCode(code).length === 6) void run(async () => (await backend!.joinRoom(code)).code)
          }}
        >
          <label className="block">
            <span className="font-semibold">{text.join}</span>
            <input
              value={code}
              onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, 6))}
              aria-label={text.codeLabel}
              placeholder="K7QF2M"
              autoCapitalize="characters"
              autoComplete="off"
              className="mt-3 h-12 w-full rounded-xl border border-line bg-surface-2 px-4 font-mono text-xl tracking-[0.2em] uppercase focus-visible:outline-2 focus-visible:outline-brick"
            />
          </label>
          <Button type="submit" variant="secondary" icon={LogIn} disabled={busy || normalizeCode(code).length !== 6} className="mt-3 w-full">
            {text.joinButton}
          </Button>
        </form>

        {failure && (
          <p role="alert" className="text-sm text-error">
            {failure}
          </p>
        )}

        <section aria-labelledby="duel-history">
          <div className="flex items-baseline justify-between">
            <SectionTitle id="duel-history">{text.history}</SectionTitle>
            {outcomes.length > 0 && (
              <span className="text-sm text-ink-muted tabular-nums" title={text.recordLegend}>
                {text.record(count('won'), count('lost'), count('draw'))}
              </span>
            )}
          </div>
          {history && history.length === 0 && <p className="text-sm text-ink-muted">{text.noHistory}</p>}
          {history && history.length > 0 && (
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
              {history.map((match, i) => {
                const { room, answers } = match
                const opponent = room.host.id === me.id ? room.guest : room.host
                const score = scoreOf(slotsOf(room.rounds), room.startedAt ?? 0, answers, [room.host.id, room.guest?.id ?? ''])
                const outcome = outcomes[i]
                return (
                  <li key={room.id}>
                    <Link to={`/duel/${room.code}`} className="flex min-h-13 items-center gap-3 px-4 py-2 hover:bg-surface-2/60">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{opponent?.nickname}</span>
                        <span className="block text-xs text-ink-muted">
                          {new Date(room.startedAt ?? room.createdAt).toLocaleDateString(dictionary.dateLocale)} · {room.level}
                        </span>
                      </span>
                      <span className="text-sm tabular-nums">
                        {score.players[me.id]?.points ?? 0} : {opponent ? (score.players[opponent.id]?.points ?? 0) : 0}
                      </span>
                      <span
                        className={`w-16 text-right text-sm font-semibold ${outcome === 'won' ? 'text-leaf' : outcome === 'lost' ? 'text-error' : 'text-ink-muted'}`}
                      >
                        {text[outcome]}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </>
    )

  return (
    <div className="space-y-5">
      <div>
        <BackButton fallback="/practice" />
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">{text.title}</h1>
        <p className="mt-2 text-ink-muted">{text.intro}</p>
      </div>
      {body}
    </div>
  )
}
