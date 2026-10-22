import { Repeat, Swords } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import type { DuelBackend, DuelPlayer, DuelSnapshot } from '../../lib/duel/backend'
import { scoreOf, slotsOf } from '../../lib/duel/match'
import { exerciseInfo } from '../exercises/exercises'
import { DuelSuns } from './DuelSuns'

/** The end of a match: who won, the points round by round, and a rematch for the same two. */
export function DuelResult({ backend, snapshot, me }: { backend: DuelBackend; snapshot: DuelSnapshot; me: DuelPlayer }) {
  const text = useT().duel
  const navigate = useNavigate()
  const { room, answers } = snapshot
  const opponent = room.host.id === me.id ? room.guest! : room.host
  const score = scoreOf(slotsOf(room.rounds), room.startedAt ?? 0, answers, [room.host.id, room.guest!.id])
  const mine = score.players[me.id]
  const theirs = score.players[opponent.id]
  const [busy, setBusy] = useState(false)

  const title = score.winner === null ? text.itsDraw : score.winner === me.id ? text.youWon : text.youLost
  const rematch = async () => {
    setBusy(true)
    try {
      const next = await backend.rematch(room.id)
      void navigate(`/duel/${next.code}`, { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="pt-4 text-center">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">{title}</h1>
        {score.winner !== null && score.leader === null && <p className="mt-1 text-sm text-ink-muted">{text.byTime}</p>}
      </div>

      <DuelSuns
        me={{ name: me.nickname, points: mine.points, leads: score.winner === me.id }}
        opponent={{ name: opponent.nickname, points: theirs.points, leads: score.winner === opponent.id }}
      />

      <table className="w-full overflow-hidden rounded-card border border-line bg-surface text-sm">
        <thead>
          <tr className="border-b border-line text-ink-muted">
            <th className="px-4 py-2 text-left font-medium" />
            <th className="px-2 py-2 text-right font-medium">{me.nickname}</th>
            <th className="px-4 py-2 text-right font-medium">{opponent.nickname}</th>
          </tr>
        </thead>
        <tbody>
          {room.rounds.map((round, r) => (
            <tr key={r} className="border-b border-line last:border-0">
              <th className="px-4 py-2.5 text-left font-normal">
                {text.round(r + 1)} · <span className="text-ink-muted">{exerciseInfo(round.type).label}</span>
              </th>
              <td className="px-2 py-2.5 text-right tabular-nums">{mine.rounds[r]}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{theirs.rounds[r]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-auto grid gap-3 pb-[env(safe-area-inset-bottom)]">
        {room.rematch ? (
          <>
            <p className="text-center text-sm text-ink-muted">{text.rematchReady(opponent.nickname)}</p>
            <Button icon={Swords} onClick={() => void navigate(`/duel/${room.rematch}`, { replace: true })}>
              {text.enterRematch}
            </Button>
          </>
        ) : (
          <Button icon={Repeat} disabled={busy} onClick={() => void rematch()}>
            {text.rematch}
          </Button>
        )}
        <Button variant="secondary" onClick={() => void navigate('/duel', { replace: true })}>
          {text.backToDuel}
        </Button>
      </div>
    </div>
  )
}
