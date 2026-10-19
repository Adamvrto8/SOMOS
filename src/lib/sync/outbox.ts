import type { Transaction } from 'dexie'
import { db } from '../db'
import { keyOf, TABLE_KINDS, tableOf, type TableKind } from './kinds'

// Every change of the learner's tables is noted here (kind + key) while an account is signed in, so the
// next sync round knows what to send. The row itself is read at push time: the latest state goes out.

/** Transactions that apply changes from the server: those are not noted, or they would echo back. */
const remote = new WeakSet<Transaction>()
let recording = false
const listeners = new Set<() => void>()

export const isRecording = () => recording

/** On while an account is signed in. */
export function setRecording(on: boolean): void {
  recording = on
}

/** Called after a change was noted (the scheduler syncs a little later). */
export function subscribeOutbox(notify: () => void): () => void {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

export async function enqueue(kind: TableKind, key: string, at: number): Promise<void> {
  await db.outbox.put({ kind, key, at })
}

function note(kind: TableKind, row: unknown, transaction: Transaction) {
  if (!recording || remote.has(transaction)) return
  const key = keyOf(kind, row)
  const at = Date.now()
  // After the change is in: a transaction that fails changed nothing.
  transaction.on('complete', () => {
    void enqueue(kind, key, at).then(() => listeners.forEach((notify) => notify()))
  })
}

let installed = false

/** Hooks the learner's tables once, at start. */
export function installSyncHooks(): void {
  if (installed) return
  installed = true
  for (const kind of TABLE_KINDS) {
    const table = tableOf(kind)
    table.hook('creating', (_key, obj, transaction) => note(kind, obj, transaction))
    table.hook('updating', (_mods, _key, obj, transaction) => note(kind, obj, transaction))
    table.hook('deleting', (_key, obj, transaction) => note(kind, obj, transaction))
  }
}

/** Runs writes from the server in one transaction that the hooks leave alone (the outbox may be changed in it too). */
export function runRemote<T>(fn: () => Promise<T>): Promise<T> {
  return db.transaction('rw', [...TABLE_KINDS.map(tableOf), db.outbox], (transaction) => {
    remote.add(transaction)
    return fn()
  })
}
