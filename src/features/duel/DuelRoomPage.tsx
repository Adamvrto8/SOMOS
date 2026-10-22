import { Play, Share2, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import { normalizeCode, type DuelBackend, type DuelPlayer, type DuelSnapshot } from '../../lib/duel/backend'
import { DuelPlay } from './DuelPlay'
import { DuelResult } from './DuelResult'
import { NicknameForm } from './NicknameForm'
import { useDuelPlayer, useDuelRoom, useServerNow } from './useDuel'

/** `/duel/:code`, full screen: the room before the match, the match itself, and its result. */
export function DuelRoomPage() {
  const text = useT().duel
  const navigate = useNavigate()
  const code = normalizeCode(useParams().code ?? '')
  const { backend, me, error: playerError, saveNickname } = useDuelPlayer()
  const ready = Boolean(me?.nickname)
  const { snapshot, error, offset } = useDuelRoom(backend, code, ready)
  const playing = snapshot?.room.status === 'playing'
  const now = useServerNow(offset, playing)
  // Stays on the result once the match is over here, also when the room in the list says "finished".
  const [over, setOver] = useState(false)

  let body
  if (playerError || (error && !snapshot)) {
    body = <Notice text={text.errors[(playerError ?? error)!.code]} />
  } else if (me === null) {
    body = (
      <Notice text={text.signIn}>
        <Link to="/profile/sign-in" className="mt-4 inline-flex h-12 items-center rounded-2xl bg-brick px-5 font-semibold text-on-accent">
          {text.signInButton}
        </Link>
      </Notice>
    )
  } else if (me && !me.nickname) {
    body = <NicknameForm onSave={saveNickname} />
  } else if (!backend || !me || !snapshot) {
    body = <p className="mt-10 text-center text-ink-muted">…</p>
  } else if (snapshot.room.status === 'finished' || over) {
    body = <DuelResult backend={backend} snapshot={snapshot} me={me} />
  } else if (playing && snapshot.room.guest) {
    body = <DuelPlay backend={backend} snapshot={snapshot} me={me} now={now} onFinished={() => setOver(true)} />
  } else {
    body = <Lobby backend={backend} snapshot={snapshot} me={me} />
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col sm:border-x sm:border-line">
      <header className="sticky top-0 z-10 box-content flex h-14 items-center gap-2 bg-bg px-2 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={() => void navigate('/duel')}
          aria-label={text.leave}
          title={text.leave}
          className="flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick"
        >
          <X size={22} strokeWidth={1.75} aria-hidden />
        </button>
        <p className="flex-1 text-center font-serif text-lg font-semibold">{text.title}</p>
        <span className="size-11" />
      </header>
      {error && snapshot && (
        <p role="alert" className="mx-4 rounded-xl bg-error/10 px-3 py-2 text-sm text-error">
          {text.errors[error.code]}
        </p>
      )}
      <div className="flex flex-1 flex-col px-4 pb-4">{body}</div>
    </div>
  )
}

function Notice({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="mt-10 text-center">
      <p className="text-ink-muted">{text}</p>
      {children}
    </div>
  )
}

/** Before the match: the code to pass on, who is here, and Štart for the one who opened the room. */
function Lobby({ backend, snapshot, me }: { backend: DuelBackend; snapshot: DuelSnapshot; me: DuelPlayer }) {
  const text = useT().duel
  const { room, online } = snapshot
  const isHost = room.host.id === me.id
  const [note, setNote] = useState<string | null>(null)
  const link = `${window.location.origin}/duel/${room.code}`
  const guestHere = room.guest !== null && online.includes(room.guest.id)

  const invite = async () => {
    const message = text.inviteText(me.nickname)
    try {
      if (navigator.share) return await navigator.share({ title: 'SOMOS', text: message, url: link })
      await navigator.clipboard.writeText(`${message} ${link}`)
      setNote(text.copied)
    } catch {
      // Sharing cancelled: nothing to say.
    }
  }

  const seat = (player: DuelPlayer | null) =>
    player ? (
      <li className="flex min-h-13 items-center gap-3 px-4 py-2">
        <span className={`size-2.5 rounded-full ${online.includes(player.id) ? 'bg-leaf' : 'bg-line'}`} aria-hidden />
        <span className="flex-1 font-medium">
          {player.nickname}
          {player.id === me.id && <span className="font-normal text-ink-muted"> ({text.you})</span>}
        </span>
        {!online.includes(player.id) && <span className="text-xs text-ink-muted">{text.notConnected}</span>}
      </li>
    ) : (
      <li className="flex min-h-13 items-center gap-3 px-4 py-2 text-ink-muted">
        <span className="size-2.5 rounded-full border border-dashed border-ink-muted" aria-hidden />…
      </li>
    )

  return (
    <div className="flex flex-1 flex-col gap-6 pt-4">
      <div className="text-center">
        <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">
          {text.code} · {room.level}
        </p>
        <p className="mt-1 font-mono text-5xl font-semibold tracking-[0.2em]" aria-label={room.code.split('').join(' ')}>
          {room.code}
        </p>
      </div>

      <Button variant="secondary" icon={Share2} onClick={() => void invite()}>
        {text.invite}
      </Button>
      {note && (
        <p role="status" className="-mt-4 text-center text-sm text-leaf">
          {note}
        </p>
      )}

      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {seat(room.host)}
        {seat(room.guest)}
      </ul>

      <p className="text-center text-sm text-ink-muted">{!room.guest ? text.waitingGuest : !isHost ? text.waitingHost(room.host.nickname) : ' '}</p>

      {isHost && (
        <Button icon={Play} disabled={!guestHere} onClick={() => void backend.start(room.id)} className="mt-auto">
          {text.start}
        </Button>
      )}
    </div>
  )
}
