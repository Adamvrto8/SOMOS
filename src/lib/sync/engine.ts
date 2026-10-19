import { db } from '../db'
import { clearLessonProgress } from '../lessonProgress'
import { clearTestResults } from '../testProgress'
import { deleteRow, isTableKind, keyOf, readRow, TABLE_KINDS, tableOf, writeRow, type RemoteRecord, type SyncRecord } from './kinds'
import { runRemote, setRecording } from './outbox'
import type { SyncServer } from './server'
import { clearSyncState, loadSyncState, saveSyncState } from './state'
import { applyStoreRecord, markStoresPushed, storeChanges } from './stores'

// One sync round: pull what the other devices changed, then push what changed here.
// Pulling first lets the server's version win where the first sign-in took over the device's rows.

export const PULL_PAGE = 1000
export const PUSH_BATCH = 500

/** Applies one page of table records in one transaction; a change still pending here and newer stays. */
async function applyTableRecords(records: RemoteRecord[]): Promise<void> {
  if (records.length === 0) return
  await runRemote(async () => {
    for (const record of records) {
      if (!isTableKind(record.kind)) continue
      const pending = await db.outbox.get([record.kind, record.key])
      if (pending && pending.at > record.changedAt) continue
      if (record.deleted) await deleteRow(record.kind, record.key)
      else await writeRow(record.kind, record.key, record.data)
      if (pending) await db.outbox.delete([record.kind, record.key])
    }
  })
}

async function pullAll(server: SyncServer): Promise<number> {
  let pulled = 0
  for (;;) {
    let state = loadSyncState()
    const page = await server.pull(state.cursor, PULL_PAGE)
    if (page.length === 0) break
    await applyTableRecords(page.filter((r) => isTableKind(r.kind)))
    for (const record of page) if (!isTableKind(record.kind)) state = await applyStoreRecord(state, record)
    saveSyncState({ ...state, cursor: page[page.length - 1].rev })
    pulled += page.length
    if (page.length < PULL_PAGE) break
  }
  return pulled
}

async function pushAll(server: SyncServer, now: number): Promise<number> {
  const entries = await db.outbox.toArray()
  const tableRecords: SyncRecord[] = []
  for (const entry of entries) {
    const data = await readRow(entry.kind, entry.key)
    tableRecords.push({ kind: entry.kind, key: entry.key, data: data ?? null, deleted: data === undefined, changedAt: entry.at })
  }
  const records = [...tableRecords, ...storeChanges(loadSyncState(), now)]

  for (let start = 0; start < records.length; start += PUSH_BATCH) {
    const batch = records.slice(start, start + PUSH_BATCH)
    await server.push(batch)
    // A row changed again while this was on its way keeps its entry (a newer `at`): it goes next round.
    for (const record of batch) {
      if (!isTableKind(record.kind)) continue
      const entry = await db.outbox.get([record.kind, record.key])
      if (entry && entry.at === record.changedAt) await db.outbox.delete([record.kind, record.key])
    }
    saveSyncState(markStoresPushed(loadSyncState(), batch.filter((r) => !isTableKind(r.kind))))
  }
  return records.length
}

export async function syncOnce(server: SyncServer, now = Date.now()): Promise<{ pulled: number; pushed: number }> {
  const pulled = await pullAll(server)
  const pushed = await pushAll(server, now)
  return { pulled, pushed }
}

/**
 * The first sign-in on this device: every row it has goes to the account. Their time is 0, so where the
 * account has the same row already, its version wins; the stores merge by the better result.
 */
export async function adoptDevice(): Promise<void> {
  clearSyncState()
  for (const kind of TABLE_KINDS) {
    const rows: unknown[] = await tableOf(kind).toArray()
    const entries = rows.map((row) => ({ kind, key: keyOf(kind, row), at: 0 }))
    const existing = await db.outbox.bulkGet(entries.map((e) => [e.kind, e.key] as [string, string]))
    await db.outbox.bulkPut(entries.filter((_, i) => existing[i] === undefined))
  }
}

/** Changes not sent yet: what signing out now would lose. */
export async function pendingChanges(now = Date.now()): Promise<number> {
  return (await db.outbox.count()) + storeChanges(loadSyncState(), now).length
}

/** Signing out or deleting the account: the learner's data leaves this device. Device settings stay. */
export async function wipeLearnerData(): Promise<void> {
  setRecording(false)
  await db.transaction('rw', [...TABLE_KINDS.map(tableOf), db.outbox, db.lookups], async () => {
    await Promise.all([...TABLE_KINDS.map((kind) => tableOf(kind).clear()), db.outbox.clear(), db.lookups.clear()])
  })
  clearLessonProgress()
  clearTestResults()
  clearSyncState()
}
