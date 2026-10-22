import { useCallback, useEffect, useState } from 'react'
import { DuelError, getDuelBackend, type DuelBackend, type DuelPlayer, type DuelSnapshot } from '../../lib/duel/backend'

const asDuelError = (error: unknown) => (error instanceof DuelError ? error : new DuelError('failed', String(error)))

/** The duel server and the player on this device (null = signed out; nickname '' = none yet). */
export function useDuelPlayer() {
  const [backend, setBackend] = useState<DuelBackend | null>(null)
  const [me, setMe] = useState<DuelPlayer | null | undefined>(undefined)
  const [error, setError] = useState<DuelError | null>(null)

  useEffect(() => {
    let alive = true
    getDuelBackend()
      .then(async (b) => {
        const player = await b.me()
        if (!alive) return
        setBackend(b)
        setMe(player)
      })
      .catch((e: unknown) => alive && setError(asDuelError(e)))
    return () => {
      alive = false
    }
  }, [])

  const saveNickname = useCallback(
    async (nickname: string) => {
      if (!backend) return
      await backend.setNickname(nickname)
      setMe(await backend.me())
    },
    [backend],
  )

  return { backend, me, error, saveNickname }
}

/** One room: joins it (as the guest, if the seat is free), then follows it live; also this phone's clock against the server. */
export function useDuelRoom(backend: DuelBackend | null, code: string, ready: boolean) {
  const [snapshot, setSnapshot] = useState<DuelSnapshot | null>(null)
  const [error, setError] = useState<DuelError | null>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (!backend || !ready) return
    let stop: (() => void) | undefined
    let alive = true
    backend
      .joinRoom(code)
      .then(() => {
        if (!alive) return
        stop = backend.watch(
          code,
          (next) => {
            setSnapshot(next)
            setError(null)
          },
          (e) => setError(e),
        )
      })
      .catch((e: unknown) => alive && setError(asDuelError(e)))
    backend
      .clockOffset()
      .then((o) => alive && setOffset(o))
      .catch(() => {}) // the phone's own clock, then
    return () => {
      alive = false
      stop?.()
    }
  }, [backend, code, ready])

  return { snapshot, error, offset }
}

/** Server time, ticking: what the schedule of a match is computed from. */
export function useServerNow(offset: number, active: boolean, every = 100): number {
  const [now, setNow] = useState(() => Date.now() + offset)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now() + offset), every)
    return () => clearInterval(id)
  }, [offset, active, every])
  return now
}
