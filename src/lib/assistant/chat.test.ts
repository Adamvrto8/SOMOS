import { describe, expect, it, vi } from 'vitest'
vi.mock('../account', () => ({ accessToken: async () => null }))
import { ask, ChatFailure, MAX_CALLS, MAX_QUESTION_CHARS, MAX_TURNS_SENT, type ChatDeps, type Turn } from './chat'

type Reply = [number, unknown]

const answer = (text: string, stop_reason = 'end_turn'): Reply => [200, { content: [{ type: 'text', text }], stop_reason, usage: {} }]
const toolUse = (id: string, name: string, input: unknown): Reply => [
  200,
  { content: [{ type: 'text', text: 'Pozriem sa.' }, { type: 'tool_use', id, name, input }], stop_reason: 'tool_use', usage: {} },
]

function deps(replies: (Reply | Error)[], extra: Partial<ChatDeps> = {}) {
  const queue = [...replies]
  const sent: { messages: any[]; headers: Headers }[] = []
  const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push({ messages: JSON.parse(init!.body as string).messages, headers: new Headers(init!.headers) })
    const next = queue.shift()!
    if (next instanceof Error) throw next
    return Response.json(next[1], { status: next[0] })
  })
  const d: ChatDeps = {
    fetchImpl: fetchImpl as unknown as typeof fetch,
    token: async () => 'jwt',
    online: () => true,
    tool: (name, input) => ({ content: JSON.stringify({ name, input }), isError: false }),
    ...extra,
  }
  return { d, sent, fetchImpl }
}

const failure = async (promise: Promise<unknown>) => {
  try {
    await promise
  } catch (error) {
    expect(error).toBeInstanceOf(ChatFailure)
    return (error as ChatFailure).code
  }
  throw new Error('expected a ChatFailure')
}

describe('ask', () => {
  it('sends the question with the token and returns the answer', async () => {
    const { d, sent } = deps([answer('Dom je casa.')])
    const result = await ask([], 'Ako sa povie dom?', d)
    expect(result).toEqual({ text: 'Dom je casa.', truncated: false, calls: 1 })
    expect(sent[0].messages).toEqual([{ role: 'user', content: 'Ako sa povie dom?' }])
    expect(sent[0].headers.get('authorization')).toBe('Bearer jwt')
  })

  it('runs a tool and sends its result back, then answers', async () => {
    const tool = vi.fn(() => ({ content: '{"found":true}', isError: false }))
    const { d, sent } = deps([toolUse('t1', 'search_word', { query: 'dom' }), answer('Casa.')], { tool })
    const result = await ask([], 'dom?', d)
    expect(result).toMatchObject({ text: 'Casa.', calls: 2 })
    expect(tool).toHaveBeenCalledWith('search_word', { query: 'dom' })
    expect(sent[1].messages.at(-2).role).toBe('assistant')
    expect(sent[1].messages.at(-1)).toEqual({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 't1', content: '{"found":true}', is_error: false }],
    })
  })

  it('passes thinking blocks back unchanged and leaves them out of the answer', async () => {
    const thinking = { type: 'thinking', thinking: '', signature: 'sig==' }
    const redacted = { type: 'redacted_thinking', data: 'opaque' }
    const withThinking: Reply = [
      200,
      {
        content: [thinking, redacted, { type: 'text', text: 'Pozriem sa.' }, { type: 'tool_use', id: 't1', name: 'search_word', input: { query: 'dom' } }],
        stop_reason: 'tool_use',
        usage: {},
      },
    ]
    const final: Reply = [200, { content: [{ type: 'thinking', thinking: 'hmm', signature: 's2' }, { type: 'text', text: 'Casa.' }], stop_reason: 'end_turn', usage: {} }]
    const { d, sent } = deps([withThinking, final])
    const result = await ask([], 'dom?', d)
    expect(result.text).toBe('Casa.')
    expect(sent[1].messages.at(-2)).toEqual({
      role: 'assistant',
      content: [thinking, redacted, { type: 'text', text: 'Pozriem sa.' }, { type: 'tool_use', id: 't1', name: 'search_word', input: { query: 'dom' } }],
    })
  })

  it('answers several tool uses of one reply in one user message', async () => {
    const two: Reply = [
      200,
      {
        content: [
          { type: 'tool_use', id: 'a', name: 'search_word', input: { query: 'x' } },
          { type: 'tool_use', id: 'b', name: 'app_help', input: {} },
        ],
        stop_reason: 'tool_use',
        usage: {},
      },
    ]
    const { d, sent } = deps([two, answer('Hotovo')])
    await ask([], 'q', d)
    expect(sent[1].messages.at(-1).content.map((b: { tool_use_id: string }) => b.tool_use_id)).toEqual(['a', 'b'])
  })

  it('passes a tool error result on to the model instead of failing', async () => {
    const tool = () => ({ content: 'Unknown tool: nope', isError: true })
    const { d, sent } = deps([toolUse('t1', 'nope', {}), answer('Dobre.')], { tool })
    expect((await ask([], 'q', d)).text).toBe('Dobre.')
    expect(sent[1].messages.at(-1).content[0]).toMatchObject({ is_error: true, content: 'Unknown tool: nope' })
  })

  it('sends earlier turns as plain text only', async () => {
    const turns: Turn[] = [{ question: 'Čo je casa?', answer: 'Dom.' }]
    const { d, sent } = deps([answer('Auto.')])
    await ask(turns, 'A carro?', d)
    expect(sent[0].messages).toEqual([
      { role: 'user', content: 'Čo je casa?' },
      { role: 'assistant', content: 'Dom.' },
      { role: 'user', content: 'A carro?' },
    ])
  })

  it('sends only the last turns', async () => {
    const turns: Turn[] = Array.from({ length: MAX_TURNS_SENT + 3 }, (_, i) => ({ question: `q${i}`, answer: `a${i}` }))
    const { d, sent } = deps([answer('x')])
    await ask(turns, 'now', d)
    expect(sent[0].messages).toHaveLength(MAX_TURNS_SENT * 2 + 1)
    expect(sent[0].messages[0].content).toBe('q3')
  })

  it('stops after MAX_CALLS model calls', async () => {
    const loop = Array.from({ length: MAX_CALLS + 2 }, (_, i) => toolUse(`t${i}`, 'search_word', { query: 'x' }))
    const { d, fetchImpl } = deps(loop)
    expect(await failure(ask([], 'q', d))).toBe('too-many-steps')
    expect(fetchImpl).toHaveBeenCalledTimes(MAX_CALLS)
  })

  it('reports a refusal as its own code', async () => {
    const { d } = deps([answer('', 'refusal')])
    expect(await failure(ask([], 'q', d))).toBe('refused')
  })

  it('marks an answer cut off by the token limit as truncated', async () => {
    const { d } = deps([answer('Začiatok odpovede', 'max_tokens')])
    expect(await ask([], 'q', d)).toMatchObject({ text: 'Začiatok odpovede', truncated: true })
  })
})

describe('ask: input', () => {
  it('does not call anything for an empty or whitespace question', async () => {
    const { d, fetchImpl } = deps([])
    expect(await failure(ask([], '   ', d))).toBe('failed')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('cuts nothing silently: a too long question is refused', async () => {
    const { d, fetchImpl } = deps([])
    expect(await failure(ask([], 'x'.repeat(MAX_QUESTION_CHARS + 1), d))).toBe('failed')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports offline before calling', async () => {
    const { d, fetchImpl } = deps([], { online: () => false })
    expect(await failure(ask([], 'q', d))).toBe('offline')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('needs a signed-in account', async () => {
    const { d, fetchImpl } = deps([], { token: async () => null })
    expect(await failure(ask([], 'q', d))).toBe('not-signed-in')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('ask: errors', () => {
  const code = (reply: Reply | Error) => failure(ask([], 'q', deps([reply]).d))

  it('maps the server answers to codes', async () => {
    expect(await code([401, { error: 'unauthorized' }])).toBe('not-signed-in')
    expect(await code([403, { error: 'not-allowed' }])).toBe('not-allowed')
    expect(await code([503, { error: 'daily-limit' }])).toBe('daily-limit')
    expect(await code([503, { error: 'busy' }])).toBe('busy')
    expect(await code([503, { error: 'not-configured' }])).toBe('not-configured')
    expect(await code([502, { error: 'failed' }])).toBe('failed')
    expect(await code([200, { nothing: true }])).toBe('failed')
  })

  it('keeps the history when the network drops in the middle of the loop, so the same question can be sent again', async () => {
    const turns: Turn[] = [{ question: 'a', answer: 'b' }]
    const before = structuredClone(turns)
    const first = deps([toolUse('t1', 'search_word', { query: 'x' }), new Error('network down')])
    expect(await failure(ask(turns, 'q', first.d))).toBe('failed')
    expect(turns).toEqual(before)
    const second = deps([answer('Teraz to ide.')])
    expect((await ask(turns, 'q', second.d)).text).toBe('Teraz to ide.')
  })

  it('reports a dropped connection as offline when the browser says so', async () => {
    let online = true
    const { d } = deps([new Error('network down')], { online: () => online })
    const pending = ask([], 'q', d)
    online = false
    expect(await failure(pending)).toBe('offline')
  })
})
