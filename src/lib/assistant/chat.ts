import { accessToken } from '../account'
import { runTool, type ToolOutcome } from './tools'

// The assistant's conversation (docs/superpowers/specs/2026-11-15-chat-assistant-prototype-design.md): POST /api/chat
// is one model call; when the model asks for a tool, the app runs it over its own data and sends the conversation again
// with the result. The history the screen keeps is plain questions and answers, so no tool traffic piles up in it.

export type ChatErrorCode = 'offline' | 'not-signed-in' | 'not-allowed' | 'daily-limit' | 'busy' | 'not-configured' | 'too-many-steps' | 'failed'

export class ChatFailure extends Error {
  code: ChatErrorCode
  constructor(code: ChatErrorCode) {
    super(code)
    this.code = code
  }
}

export interface Turn {
  question: string
  answer: string
}

export interface Answer {
  text: string
  /** The model ran out of its token limit: the answer ends in the middle. */
  truncated: boolean
  /** Model calls this question took (for the screen's cost hint). */
  calls: number
}

/** Same as the server (api/chat.ts) where they must be. */
export const MAX_CALLS = 5
export const MAX_QUESTION_CHARS = 500
/** Earlier turns sent along: the newest ones, so the conversation stays cheap. */
export const MAX_TURNS_SENT = 6

type Block =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error: boolean }
interface Message {
  role: 'user' | 'assistant'
  content: string | Block[]
}
interface ApiAnswer {
  content: Block[]
  stop_reason: string
}

export interface ChatDeps {
  fetchImpl?: typeof fetch
  token?: () => Promise<string | null>
  online?: () => boolean
  tool?: (name: string, input: unknown) => ToolOutcome
}

const isBlockList = (value: unknown): value is Block[] =>
  Array.isArray(value) && value.every((b) => typeof b === 'object' && b !== null && typeof (b as { type?: unknown }).type === 'string')

function codeOf(status: number, error: unknown): ChatErrorCode {
  if (status === 401) return 'not-signed-in'
  if (status === 403) return error === 'not-allowed' ? 'not-allowed' : 'failed'
  if (status === 503) {
    if (error === 'daily-limit') return 'daily-limit'
    if (error === 'busy') return 'busy'
    if (error === 'not-configured') return 'not-configured'
  }
  return 'failed'
}

async function callModel(messages: Message[], token: string, fetchImpl: typeof fetch, online: () => boolean): Promise<ApiAnswer> {
  let res: Response
  try {
    res = await fetchImpl('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages }),
    })
  } catch {
    throw new ChatFailure(online() ? 'failed' : 'offline')
  }
  const body: unknown = await res.json().catch(() => undefined)
  if (!res.ok) throw new ChatFailure(codeOf(res.status, (body as { error?: unknown } | undefined)?.error))
  const data = body as { content?: unknown; stop_reason?: unknown } | undefined
  if (!data || !isBlockList(data.content) || typeof data.stop_reason !== 'string') throw new ChatFailure('failed')
  return { content: data.content, stop_reason: data.stop_reason }
}

const textOf = (blocks: Block[]) =>
  blocks
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('\n')
    .trim()

/**
 * Asks one question. `turns` is never changed: on a failure the caller still has the conversation as it was and can send
 * the same question again.
 */
export async function ask(turns: readonly Turn[], question: string, deps: ChatDeps = {}): Promise<Answer> {
  const { fetchImpl = fetch, token = accessToken, online = () => navigator.onLine, tool = runTool } = deps
  const trimmed = question.trim()
  if (!trimmed || trimmed.length > MAX_QUESTION_CHARS) throw new ChatFailure('failed')
  if (!online()) throw new ChatFailure('offline')
  const jwt = await token()
  if (!jwt) throw new ChatFailure('not-signed-in')

  let messages: Message[] = [
    ...turns.slice(-MAX_TURNS_SENT).flatMap((turn): Message[] => [
      { role: 'user', content: turn.question },
      { role: 'assistant', content: turn.answer },
    ]),
    { role: 'user', content: trimmed },
  ]

  for (let calls = 1; calls <= MAX_CALLS; calls++) {
    const reply = await callModel(messages, jwt, fetchImpl, online)
    if (reply.stop_reason !== 'tool_use') {
      const text = textOf(reply.content)
      if (!text) throw new ChatFailure('failed')
      return { text, truncated: reply.stop_reason === 'max_tokens', calls }
    }
    const results = reply.content.flatMap((block): Block[] => {
      if (block.type !== 'tool_use') return []
      const outcome = tool(block.name, block.input)
      return [{ type: 'tool_result', tool_use_id: block.id, content: outcome.content, is_error: outcome.isError }]
    })
    if (results.length === 0) throw new ChatFailure('failed')
    messages = [...messages, { role: 'assistant', content: reply.content }, { role: 'user', content: results }]
  }
  throw new ChatFailure('too-many-steps')
}
