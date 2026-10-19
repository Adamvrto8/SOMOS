import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../backup', () => ({ currentSettings: () => ({}), applySettings: async () => false }))

import type { RemoteRecord, SyncRecord } from './kinds'
import { getSyncStatus, startSync, stopSync, syncNow } from './scheduler'
import type { SyncServer } from './server'

/** Counts rounds (one pull each, nothing to pull) and can fail. */
class CountingServer implements SyncServer {
  rounds = 0
  fail = false
  async pull(): Promise<RemoteRecord[]> {
    this.rounds++
    await new Promise((resolve) => setTimeout(resolve, 20))
    if (this.fail) throw new Error('500')
    return []
  }
  async push(_records: SyncRecord[]): Promise<void> {}
}

afterEach(() => stopSync())

describe('the sync schedule', () => {
  it('runs one more round for requests made during a round, not one per request', async () => {
    const server = new CountingServer()
    startSync(server)
    const first = syncNow()
    void syncNow()
    void syncNow()
    await first
    expect(server.rounds).toBe(2)
    expect(getSyncStatus().state).toBe('idle')
  })

  it('reports a failed round and keeps the time of the last good one', async () => {
    const server = new CountingServer()
    startSync(server)
    await syncNow()
    const last = getSyncStatus().lastSyncedAt
    expect(last).toBeTypeOf('number')
    server.fail = true
    await syncNow()
    expect(getSyncStatus()).toMatchObject({ state: 'error', lastSyncedAt: last, error: '500' })
  })
})
