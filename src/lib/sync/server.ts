import type { RemoteRecord, SyncRecord } from './kinds'

/** Where an account's records live. Supabase in the app (supabaseServer.ts), memory in the tests. */
export interface SyncServer {
  /** Records changed after `since` (a rev), oldest first, at most `limit`. */
  pull(since: number, limit: number): Promise<RemoteRecord[]>
  /**
   * Stores records; on the same key the newer `changedAt` wins, except lessons and tests, which the
   * device has already merged by the better result. Throws when it did not get through.
   */
  push(records: SyncRecord[]): Promise<void>
}

/** Merged on the device by the better result: the server takes what comes. */
export const MERGED_KINDS: ReadonlySet<string> = new Set(['lesson', 'test'])

const recordKey = (r: Pick<SyncRecord, 'kind' | 'key'>) => `${r.kind} ${r.key}`
/** Through JSON, as over the network: dates become strings. */
const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/** The server's rules in memory, for the tests. */
export class MemoryServer implements SyncServer {
  private rows = new Map<string, RemoteRecord>()
  private rev = 0
  /** Requests that got through. */
  pushes = 0
  /** The next push fails, as when the phone went offline. */
  failNext = false
  /** Runs while a push is on its way (before it is stored). */
  duringPush?: () => Promise<void>

  async pull(since: number, limit: number): Promise<RemoteRecord[]> {
    return wire(
      [...this.rows.values()]
        .filter((r) => r.rev > since)
        .sort((a, b) => a.rev - b.rev)
        .slice(0, limit),
    )
  }

  async push(records: SyncRecord[]): Promise<void> {
    if (this.failNext) {
      this.failNext = false
      throw new Error('offline')
    }
    await this.duringPush?.()
    this.pushes++
    for (const record of wire(records)) {
      const current = this.rows.get(recordKey(record))
      if (current && !MERGED_KINDS.has(record.kind) && current.changedAt > record.changedAt) continue
      this.rows.set(recordKey(record), { ...record, rev: ++this.rev })
    }
  }

  /** What the server holds for a key. */
  get(kind: string, key: string): RemoteRecord | undefined {
    return this.rows.get(`${kind} ${key}`)
  }

  get size(): number {
    return this.rows.size
  }
}
