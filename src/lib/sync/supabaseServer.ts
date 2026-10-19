import type { SupabaseClient } from '@supabase/supabase-js'
import type { RemoteRecord, SyncKind, SyncRecord } from './kinds'
import type { SyncServer } from './server'

/** A row of public.records (supabase/schema.sql); row level security returns only the account's own. */
interface RecordRow {
  kind: SyncKind
  key: string
  data: unknown
  deleted: boolean
  changed_at: number
  rev: number
}

export class SupabaseServer implements SyncServer {
  private client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async pull(since: number, limit: number): Promise<RemoteRecord[]> {
    const { data, error } = await this.client
      .from('records')
      .select('kind,key,data,deleted,changed_at,rev')
      .gt('rev', since)
      .order('rev', { ascending: true })
      .limit(limit)
    if (error) throw new Error(error.message)
    return (data as RecordRow[]).map((row) => ({
      kind: row.kind,
      key: row.key,
      data: row.data,
      deleted: row.deleted,
      changedAt: Number(row.changed_at),
      rev: Number(row.rev),
    }))
  }

  async push(records: SyncRecord[]): Promise<void> {
    const { error } = await this.client.rpc('push_records', { items: records })
    if (error) throw new Error(error.message)
  }
}
