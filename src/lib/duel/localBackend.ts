import type { Level } from '../../data/types'
import { DuelError, newCode, normalizeCode, validNickname, type DuelBackend, type DuelPlayer, type DuelRoom, type DuelSnapshot } from './backend'
import { buildRounds, type DuelAnswer, type DuelResult } from './match'

// The dev server's duel "server": the tabs of one browser share localStorage, each tab is one player (its id lives
// in sessionStorage), and a BroadcastChannel tells the others at once. Two tabs side by side = a live duel.

const STORE_KEY = 'somos-duel-local-v1'
const PRESENCE_KEY = 'somos-duel-local-presence'
const ME_KEY = 'somos-duel-local-me'
const ONLINE_MS = 3000

interface StoredAnswer extends DuelAnswer {
  room: string
}

interface Store {
  rooms: Record<string, DuelRoom>
  answers: StoredAnswer[]
  nicknames: Record<string, string>
}

const read = (): Store => {
  try {
    return { rooms: {}, answers: [], nicknames: {}, ...(JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Partial<Store>) }
  } catch {
    return { rooms: {}, answers: [], nicknames: {} }
  }
}

const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('somos-duel-local')
const listeners = new Set<() => void>()
channel?.addEventListener('message', () => listeners.forEach((notify) => notify()))

function write(change: (store: Store) => void) {
  const store = read()
  change(store)
  localStorage.setItem(STORE_KEY, JSON.stringify(store))
  channel?.postMessage('changed')
  listeners.forEach((notify) => notify())
}

function myId(): string {
  let id = sessionStorage.getItem(ME_KEY)
  if (!id) {
    id = `local-${Math.random().toString(36).slice(2, 10)}`
    sessionStorage.setItem(ME_KEY, id)
  }
  return id
}

function heartbeat(id: string) {
  const seen = JSON.parse(localStorage.getItem(PRESENCE_KEY) ?? '{}') as Record<string, number>
  seen[id] = Date.now()
  localStorage.setItem(PRESENCE_KEY, JSON.stringify(seen))
}

function online(): string[] {
  const seen = JSON.parse(localStorage.getItem(PRESENCE_KEY) ?? '{}') as Record<string, number>
  return Object.entries(seen)
    .filter(([, at]) => Date.now() - at < ONLINE_MS)
    .map(([id]) => id)
}

export class LocalDuelBackend implements DuelBackend {
  private player(id: string): DuelPlayer {
    return { id, nickname: read().nicknames[id] ?? '' }
  }

  async me() {
    return this.player(myId())
  }

  async setNickname(nickname: string) {
    if (!validNickname(nickname)) throw new DuelError('nickname')
    const id = myId()
    const name = nickname.trim()
    if (Object.entries(read().nicknames).some(([other, n]) => other !== id && n.toLowerCase() === name.toLowerCase())) throw new DuelError('taken')
    write((store) => {
      store.nicknames[id] = name
    })
  }

  async createRoom(level: Level, guest: DuelPlayer | null = null) {
    const seed = Math.floor(Math.random() * 2 ** 31)
    const room: DuelRoom = {
      id: `room-${Math.random().toString(36).slice(2, 10)}`,
      code: newCode(),
      level,
      seed,
      rounds: buildRounds(level, seed),
      host: this.player(myId()),
      guest,
      status: 'lobby',
      startedAt: null,
      createdAt: Date.now(),
      rematch: null,
    }
    write((store) => {
      store.rooms[room.id] = room
    })
    return room
  }

  private byCode(code: string): DuelRoom {
    const room = Object.values(read().rooms).find((r) => r.code === normalizeCode(code))
    if (!room) throw new DuelError('not-found')
    return room
  }

  async joinRoom(code: string) {
    const room = this.byCode(code)
    const id = myId()
    if (room.host.id === id || room.guest?.id === id) return room
    if (room.guest || room.status !== 'lobby') throw new DuelError('full')
    const joined = { ...room, guest: this.player(id) }
    write((store) => {
      store.rooms[room.id] = joined
    })
    return joined
  }

  async start(roomId: string) {
    write((store) => {
      const room = store.rooms[roomId]
      if (room && room.status === 'lobby' && room.guest && room.host.id === myId()) store.rooms[roomId] = { ...room, status: 'playing', startedAt: Date.now() }
    })
  }

  async answer(roomId: string, task: number, result: DuelResult, ms: number) {
    const userId = myId()
    write((store) => {
      // The first answer of a player to a task counts, as on the server.
      if (store.answers.some((a) => a.room === roomId && a.task === task && a.userId === userId)) return
      store.answers.push({ room: roomId, task, userId, result, ms, at: Date.now() })
    })
  }

  async finish(roomId: string) {
    write((store) => {
      const room = store.rooms[roomId]
      if (room && room.status === 'playing') store.rooms[roomId] = { ...room, status: 'finished' }
    })
  }

  async rematch(roomId: string) {
    const old = read().rooms[roomId]
    if (!old) throw new DuelError('not-found')
    if (old.rematch) return this.byCode(old.rematch)
    const id = myId()
    const other = old.host.id === id ? old.guest : old.host
    const room = await this.createRoom(old.level, other ? this.player(other.id) : null)
    write((store) => {
      store.rooms[roomId] = { ...store.rooms[roomId], rematch: room.code }
    })
    return room
  }

  watch(code: string, onSnapshot: (snapshot: DuelSnapshot) => void, onError: (error: DuelError) => void) {
    const id = myId()
    const send = () => {
      try {
        const room = this.byCode(code)
        onSnapshot({ room, answers: roomAnswers(room.id), online: online() })
      } catch (error) {
        onError(error instanceof DuelError ? error : new DuelError('failed', String(error)))
      }
    }
    heartbeat(id)
    send()
    const timer = setInterval(() => {
      heartbeat(id)
      send()
    }, 1000)
    listeners.add(send)
    return () => {
      clearInterval(timer)
      listeners.delete(send)
    }
  }

  async clockOffset() {
    return 0
  }

  async history() {
    const id = myId()
    return Object.values(read().rooms)
      .filter((room) => room.status === 'finished' && (room.host.id === id || room.guest?.id === id))
      .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))
      .map((room) => ({ room, answers: roomAnswers(room.id), online: [] }))
  }
}

function roomAnswers(roomId: string): DuelAnswer[] {
  return read()
    .answers.filter((a) => a.room === roomId)
    .map(({ task, userId, result, ms, at }) => ({ task, userId, result, ms, at }))
}
