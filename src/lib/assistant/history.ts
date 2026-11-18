import { useSyncExternalStore } from 'react'
import { db, type ChatThread, type ChatTurn, type FeedbackReason } from '../db'

// SOMO's conversations. The one on screen lives in this module, so it survives in-app navigation (a link in an answer
// closes the sheet) and both the sheet and /assistant show it. Every finished turn is also stored in Dexie `chats`, so
// after the app was closed the chat opens on the last conversation again, and older ones can be reopened from the list.
// Device only: not synced, not in the backup, cleared on sign-out (sync/engine.ts wipeLearnerData).

export type Shown = ChatTurn

/** Conversations kept on the device; the oldest go first. */
export const MAX_THREADS = 30
const TITLE_CHARS = 80

export interface ChatState {
  /** The stored conversation on screen; null = a new one, stored with its first answer. */
  id: string | null
  turns: readonly Shown[]
  /** The last conversation has been looked for (the input waits for it, so a question never forks it). */
  ready: boolean
  /** A question the chat sends by itself once it is open ("Prečo?" from a lesson or Chyby). */
  queued: string | null
}

let state: ChatState = { id: null, turns: [], ready: false, queued: null }
let restoring: Promise<void> | undefined
const listeners = new Set<() => void>()

function set(next: Partial<ChatState>) {
  state = { ...state, ...next }
  listeners.forEach((notify) => notify())
}

const newId = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

export const titleOf = (question: string) => {
  const line = question.replace(/\s+/g, ' ').trim()
  return line.length <= TITLE_CHARS ? line : `${line.slice(0, TITLE_CHARS - 1).trimEnd()}…`
}

/** Stored conversations, newest first. */
export const listChats = (): Promise<ChatThread[]> => db.chats.orderBy('updatedAt').reverse().toArray()

/** Opens the last conversation once per app start, unless the learner has already begun another. */
export function restoreLastChat(): Promise<void> {
  restoring ??= (async () => {
    try {
      const last = await db.chats.orderBy('updatedAt').last()
      if (last && state.id === null && state.turns.length === 0 && state.queued === null) set({ id: last.id, turns: last.turns })
    } catch (error) {
      console.error('SOMO: the last conversation could not be read', error)
    } finally {
      set({ ready: true })
    }
  })()
  return restoring
}

/** Adds a finished turn to the conversation on screen and stores it, dropping conversations past MAX_THREADS. */
export async function addTurn(turn: Shown, now = Date.now()): Promise<void> {
  const id = state.id ?? newId()
  const turns = [...state.turns, turn]
  set({ id, turns })
  try {
    await db.transaction('rw', db.chats, async () => {
      const stored = await db.chats.get(id)
      await db.chats.put({ id, title: stored?.title ?? titleOf(turns[0].question), turns, createdAt: stored?.createdAt ?? now, updatedAt: now })
      const extra = (await db.chats.count()) - MAX_THREADS
      if (extra > 0) await db.chats.bulkDelete(await db.chats.orderBy('updatedAt').limit(extra).primaryKeys())
    })
  } catch (error) {
    // Not stored: the conversation still goes on in memory.
    console.error('SOMO: the conversation could not be stored', error)
  }
}

/** Keeps 👍 / 👎 on a turn of the conversation on screen, also in its stored copy. */
export async function rateTurn(index: number, rating: 'up' | 'down', reason?: FeedbackReason): Promise<void> {
  const turn = state.turns[index]
  if (!turn) return
  const turns = state.turns.map((t, i) => (i === index ? { ...t, rating, reason } : t))
  set({ turns })
  const id = state.id
  if (!id) return
  try {
    await db.chats.update(id, { turns: [...turns] })
  } catch (error) {
    console.error('SOMO: the rating could not be stored', error)
  }
}

/** A new, empty conversation on screen; the previous one stays in the list. */
export function startNewChat() {
  set({ id: null, turns: [] })
}

/** A new conversation that starts with `question`, sent as soon as the chat is open. */
export function askInNewChat(question: string) {
  set({ id: null, turns: [], queued: question })
}

/** The queued question, once: the chat that takes it sends it. */
export function takeQueued(): string | null {
  const question = state.queued
  if (question !== null) set({ queued: null })
  return question
}

/** Puts a stored conversation back on screen, to read or to go on with. */
export async function openChat(id: string): Promise<boolean> {
  const thread = await db.chats.get(id)
  if (!thread) return false
  set({ id: thread.id, turns: thread.turns, ready: true })
  return true
}

export async function deleteChat(id: string): Promise<void> {
  await db.chats.delete(id)
  if (state.id === id) startNewChat()
}

/** Sign-out: the caller clears the stored conversations, this drops the one on screen. */
export function forgetChat() {
  set({ id: null, turns: [], queued: null })
}

export const getChat = () => state

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

export function useChat(): ChatState {
  return useSyncExternalStore(subscribe, getChat)
}

/** For tests: the module as at an app start. */
export function resetChatModule() {
  state = { id: null, turns: [], ready: false, queued: null }
  restoring = undefined
}
