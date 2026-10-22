import type { Level } from '../../data/types'
import { accountsAvailable } from '../account'
import type { DuelAnswer, DuelResult, DuelRound } from './match'

// What a duel needs from a server: rooms, both players' answers as they come, and who is connected.
// Two of them: Supabase (the real one, signed-in learners) and a local one for the dev server and the browser
// tests, which joins the tabs of one browser (docs/duel-spec.md).

export type DuelStatus = 'lobby' | 'playing' | 'finished'

export interface DuelPlayer {
  id: string
  nickname: string
}

export interface DuelRoom {
  id: string
  code: string // 6 letters and digits, for the link /duel/K7QF2M
  level: Level
  seed: number
  rounds: DuelRound[]
  host: DuelPlayer
  guest: DuelPlayer | null
  status: DuelStatus
  startedAt: number | null // server time the countdown began
  createdAt: number
  rematch: string | null // the code of the next room, once one of them asked for a rematch
}

export interface DuelSnapshot {
  room: DuelRoom
  answers: DuelAnswer[]
  online: string[] // player ids connected now
}

export type DuelErrorCode = 'not-found' | 'full' | 'taken' | 'nickname' | 'signed-out' | 'offline' | 'failed'

export class DuelError extends Error {
  readonly code: DuelErrorCode

  constructor(code: DuelErrorCode, detail?: string) {
    super(detail ?? code)
    this.code = code
  }
}

export interface DuelBackend {
  /** The player on this device; nickname '' until one is set. null when signed out. */
  me(): Promise<DuelPlayer | null>
  setNickname(nickname: string): Promise<void>
  createRoom(level: Level): Promise<DuelRoom>
  /** Joins as the guest; the host or the guest opening the link again just gets the room. */
  joinRoom(code: string): Promise<DuelRoom>
  start(roomId: string): Promise<void>
  answer(roomId: string, task: number, result: DuelResult, ms: number): Promise<void>
  finish(roomId: string): Promise<void>
  /** A new room for the same two, linked from this one. */
  rematch(roomId: string): Promise<DuelRoom>
  /** The room as it changes, and who is in it; returns the function that stops watching. */
  watch(code: string, onSnapshot: (snapshot: DuelSnapshot) => void, onError: (error: DuelError) => void): () => void
  /** Server time minus this phone's time, in ms. */
  clockOffset(): Promise<number>
  /** Finished duels of this player, newest first. */
  history(): Promise<DuelSnapshot[]>
}

export const NICKNAME_MIN = 3
export const NICKNAME_MAX = 20
export const validNickname = (nickname: string) => {
  const n = nickname.trim()
  return n.length >= NICKNAME_MIN && n.length <= NICKNAME_MAX
}

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O, 1/I: read out over the phone
export function newCode(random: () => number = Math.random): string {
  return Array.from({ length: 6 }, () => CODE_LETTERS[Math.floor(random() * CODE_LETTERS.length)]).join('')
}
export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

/** Local on the dev server without Supabase, and in the browser tests (VITE_DUEL_BACKEND=local). */
const useLocal = import.meta.env.DEV && (!accountsAvailable || import.meta.env.VITE_DUEL_BACKEND === 'local')

/** Duels are there with accounts, or on the dev server; otherwise hidden, like accounts. */
export const duelsAvailable = accountsAvailable || useLocal

let backend: Promise<DuelBackend> | undefined

export function getDuelBackend(): Promise<DuelBackend> {
  backend ??= useLocal
    ? import('./localBackend').then(({ LocalDuelBackend }) => new LocalDuelBackend())
    : import('./supabaseBackend').then(({ createSupabaseDuelBackend }) => createSupabaseDuelBackend())
  return backend
}
