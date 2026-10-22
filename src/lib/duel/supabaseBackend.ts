import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { Level } from '../../data/types'
import { getAccount, getClient } from '../account'
import { DuelError, newCode, normalizeCode, validNickname, type DuelBackend, type DuelPlayer, type DuelRoom, type DuelSnapshot, type DuelStatus } from './backend'
import { buildRounds, type DuelAnswer, type DuelResult, type DuelRound } from './match'

// Duels on Supabase (supabase/schema.sql): rooms and answers in tables that only the two players can read,
// changes only through the functions there, and Realtime to send every change to both phones at once.

interface DuelRow {
  id: string
  code: string
  host: string
  guest: string | null
  level: Level
  seed: number
  rounds: DuelRound[]
  status: DuelStatus
  started_at: number | null
  created_at: number
  rematch: string | null
}

interface AnswerRow {
  duel_id: string
  user_id: string
  task: number
  result: DuelResult
  ms: number
  at: number
}

const toAnswer = (row: AnswerRow): DuelAnswer => ({ task: row.task, userId: row.user_id, result: row.result, ms: row.ms, at: Number(row.at) })

/** What a failed call means for the screens. */
function failure(error: { message: string; code?: string } | null): DuelError {
  const message = error?.message ?? ''
  if (message.includes('not-found')) return new DuelError('not-found')
  if (message.includes('full')) return new DuelError('full')
  if (error?.code === '23505') return new DuelError('taken', message)
  if (typeof navigator !== 'undefined' && !navigator.onLine) return new DuelError('offline')
  return new DuelError('failed', message)
}

export async function createSupabaseDuelBackend(): Promise<DuelBackend> {
  return new SupabaseDuelBackend(await getClient())
}

class SupabaseDuelBackend implements DuelBackend {
  private nicknames = new Map<string, string>()
  private readonly supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  private myId(): string {
    const account = getAccount()
    if (!account) throw new DuelError('signed-out')
    return account.userId
  }

  private async loadNicknames(ids: string[]): Promise<void> {
    const missing = ids.filter((id) => !this.nicknames.has(id))
    if (missing.length === 0) return
    const { data, error } = await this.supabase.from('profiles').select('user_id, nickname').in('user_id', missing)
    if (error) throw failure(error)
    for (const row of data as { user_id: string; nickname: string }[]) this.nicknames.set(row.user_id, row.nickname)
  }

  private player = (id: string): DuelPlayer => ({ id, nickname: this.nicknames.get(id) ?? '' })

  private async toRoom(row: DuelRow): Promise<DuelRoom> {
    await this.loadNicknames([row.host, ...(row.guest ? [row.guest] : [])])
    return {
      id: row.id,
      code: row.code,
      level: row.level,
      seed: row.seed,
      rounds: row.rounds,
      host: this.player(row.host),
      guest: row.guest ? this.player(row.guest) : null,
      status: row.status,
      startedAt: row.started_at === null ? null : Number(row.started_at),
      createdAt: Number(row.created_at),
      rematch: row.rematch,
    }
  }

  private async call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.supabase.rpc(fn, args)
    if (error) throw failure(error)
    return data as T
  }

  async me() {
    const account = getAccount()
    if (!account) return null
    this.nicknames.delete(account.userId)
    await this.loadNicknames([account.userId])
    return this.player(account.userId)
  }

  async setNickname(nickname: string) {
    if (!validNickname(nickname)) throw new DuelError('nickname')
    const { error } = await this.supabase.from('profiles').upsert({ user_id: this.myId(), nickname: nickname.trim() })
    if (error) throw failure(error)
    this.nicknames.set(this.myId(), nickname.trim())
  }

  /** A fresh code, again if it happens to be taken. */
  private async withCode(create: (code: string) => Promise<DuelRow>): Promise<DuelRow> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await create(newCode())
      } catch (error) {
        if (!(error instanceof DuelError && error.code === 'taken') || attempt === 4) throw error
      }
    }
  }

  async createRoom(level: Level) {
    const seed = Math.floor(Math.random() * 2 ** 31)
    const row = await this.withCode((code) =>
      this.call<DuelRow>('create_duel', { p_code: code, p_level: level, p_seed: seed, p_rounds: buildRounds(level, seed) }),
    )
    return this.toRoom(row)
  }

  async joinRoom(code: string) {
    return this.toRoom(await this.call<DuelRow>('join_duel', { p_code: normalizeCode(code) }))
  }

  async start(roomId: string) {
    await this.call('start_duel', { p_id: roomId })
  }

  async answer(roomId: string, task: number, result: DuelResult, ms: number) {
    await this.call('answer_duel', { p_id: roomId, p_task: task, p_result: result, p_ms: Math.round(ms) })
  }

  async finish(roomId: string) {
    await this.call('finish_duel', { p_id: roomId })
  }

  async rematch(roomId: string) {
    const { data, error } = await this.supabase.from('duels').select('level').eq('id', roomId).single()
    if (error) throw failure(error)
    const seed = Math.floor(Math.random() * 2 ** 31)
    const rounds = buildRounds((data as { level: Level }).level, seed)
    const row = await this.withCode((code) => this.call<DuelRow>('rematch_duel', { p_id: roomId, p_code: code, p_seed: seed, p_rounds: rounds }))
    return this.toRoom(row)
  }

  private async load(code: string): Promise<{ room: DuelRoom; answers: DuelAnswer[] }> {
    const { data, error } = await this.supabase.from('duels').select('*').eq('code', normalizeCode(code)).maybeSingle()
    if (error) throw failure(error)
    if (!data) throw new DuelError('not-found')
    const row = data as DuelRow
    const answers = await this.supabase.from('duel_answers').select('*').eq('duel_id', row.id)
    if (answers.error) throw failure(answers.error)
    return { room: await this.toRoom(row), answers: (answers.data as AnswerRow[]).map(toAnswer) }
  }

  watch(code: string, onSnapshot: (snapshot: DuelSnapshot) => void, onError: (error: DuelError) => void) {
    let stopped = false
    let state: { room: DuelRoom; answers: DuelAnswer[] } | null = null
    let online: string[] = []
    let channel: RealtimeChannel | null = null
    const send = () => {
      if (!stopped && state) onSnapshot({ room: state.room, answers: state.answers, online })
    }
    // Everything again: at the start and after the connection came back (changes in between were not sent).
    const reload = () =>
      this.load(code).then(
        (loaded) => {
          state = loaded
          send()
        },
        (error: unknown) => !stopped && onError(error instanceof DuelError ? error : failure(null)),
      )

    void reload().then(() => {
      if (stopped || !state) return
      const roomId = state.room.id
      channel = this.supabase
        .channel(`duel:${roomId}`, { config: { presence: { key: this.myId() } } })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'duels', filter: `id=eq.${roomId}` }, (payload) => {
          void this.toRoom(payload.new as DuelRow).then((room) => {
            if (state) state = { ...state, room }
            send()
          })
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'duel_answers', filter: `duel_id=eq.${roomId}` }, (payload) => {
          const answer = toAnswer(payload.new as AnswerRow)
          if (state && !state.answers.some((a) => a.task === answer.task && a.userId === answer.userId)) {
            state = { ...state, answers: [...state.answers, answer] }
            send()
          }
        })
        .on('presence', { event: 'sync' }, () => {
          online = Object.keys(channel?.presenceState() ?? {})
          send()
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            void channel?.track({ at: Date.now() })
            void reload()
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            onError(new DuelError('offline'))
          }
        })
    })

    return () => {
      stopped = true
      if (channel) void this.supabase.removeChannel(channel)
    }
  }

  /** From the quickest of three round trips: half of it is the way there. */
  async clockOffset() {
    let best = { rtt: Infinity, offset: 0 }
    for (let i = 0; i < 3; i++) {
      const sent = Date.now()
      const server = Number(await this.call<number>('now_ms', {}))
      const back = Date.now()
      if (back - sent < best.rtt) best = { rtt: back - sent, offset: server - (sent + back) / 2 }
    }
    return best.offset
  }

  async history() {
    const { data, error } = await this.supabase.from('duels').select('*').eq('status', 'finished').order('started_at', { ascending: false }).limit(50)
    if (error) throw failure(error)
    const rows = data as DuelRow[]
    if (rows.length === 0) return []
    const answers = await this.supabase
      .from('duel_answers')
      .select('*')
      .in(
        'duel_id',
        rows.map((r) => r.id),
      )
    if (answers.error) throw failure(answers.error)
    const all = answers.data as AnswerRow[]
    await this.loadNicknames([...new Set(rows.flatMap((r) => [r.host, ...(r.guest ? [r.guest] : [])]))])
    return Promise.all(
      rows.map(async (row): Promise<DuelSnapshot> => ({ room: await this.toRoom(row), answers: all.filter((a) => a.duel_id === row.id).map(toAnswer), online: [] })),
    )
  }
}
