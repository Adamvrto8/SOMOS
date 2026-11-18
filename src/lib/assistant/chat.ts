import { variant } from '../../data'
import { accessToken } from '../account'
import { checkAnswer } from './answerCheck'
import { buildChatContext, type ChatContext } from './context'
import { runTool, type ToolOutcome } from './tools'

// The assistant's conversation (docs/superpowers/specs/2026-11-15-chat-assistant-prototype-design.md): POST /api/chat
// is one model call; when the model asks for a tool, the app runs it over its own data and sends the conversation again
// with the result. The history the screen keeps is plain questions and answers, so no tool traffic piles up in it.
// Every POST also carries `context`: the app map and the learner's profile (context.ts), built once per question.
// A finished answer is checked in code (answerCheck.ts); when the check finds something, the model gets one more call
// with a note on what to fix, and the second answer is shown whatever it says.

export type ChatErrorCode = 'offline' | 'not-signed-in' | 'not-allowed' | 'daily-limit' | 'busy' | 'not-configured' | 'too-many-steps' | 'refused' | 'failed'

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
  /** The tools the model called and with what, in order: sent along with 👍 / 👎 (feedback.ts). */
  tools: ToolCall[]
}

export interface ToolCall {
  name: string
  input: unknown
}

/** Same as the server (api/chat.ts) where they must be. */
export const MAX_CALLS = 5
import { MAX_QUESTION_CHARS } from './limits'
export { MAX_QUESTION_CHARS }
/** Earlier turns sent along: the newest ones, so the conversation stays cheap. */
export const MAX_TURNS_SENT = 6
/** A context that takes longer (a database blocked by another tab) is left out, so the question still goes. */
export const CONTEXT_TIMEOUT_MS = 2000

type Block =
  | { type: 'text'; text: string }
  // Thinking blocks go back to the server unchanged with the tool results (the model needs them intact).
  | { type: 'thinking'; thinking: string; signature: string }
  | { type: 'redacted_thinking'; data: string }
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
  tool?: (name: string, input: unknown) => ToolOutcome | Promise<ToolOutcome>
  context?: () => Promise<ChatContext | undefined>
  /** What the learner was looking at when they opened SOMO (page.ts); goes along even when the rest of the context is late. */
  page?: string
  /** Notes on a finished answer (answerCheck.ts); empty = shown as it is. */
  check?: (answer: string, question: string) => string[]
}

/** The note sent back with a checked answer: marked as the app's, so the model does not take it for the learner. */
export const checkNote = (notes: string[]) =>
  `[Kontrola appky, nie otázka učiaceho] ${notes.join(' ')} Napíš celú odpoveď na moju predchádzajúcu otázku znova, opravenú, bez zmienky o kontrole.`.slice(
    0,
    MAX_QUESTION_CHARS,
  )

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

async function callModel(
  messages: Message[],
  context: ChatContext | undefined,
  token: string,
  fetchImpl: typeof fetch,
  online: () => boolean,
): Promise<ApiAnswer> {
  let res: Response
  try {
    res = await fetchImpl('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(context ? { messages, context } : { messages }),
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
  const {
    fetchImpl = fetch,
    token = accessToken,
    online = () => navigator.onLine,
    tool = runTool,
    context: buildContext = buildChatContext,
    page,
    check = (answer, asked) => checkAnswer(answer, asked, variant),
  } = deps
  const trimmed = question.trim()
  if (!trimmed || trimmed.length > MAX_QUESTION_CHARS) throw new ChatFailure('failed')
  if (!online()) throw new ChatFailure('offline')
  const jwt = await token()
  if (!jwt) throw new ChatFailure('not-signed-in')
  // Once per question: the app map and the learner's numbers do not change while the model calls tools.
  let timer: ReturnType<typeof setTimeout> | undefined
  const built = await Promise.race([
    buildContext().catch(() => undefined),
    new Promise<undefined>((resolve) => {
      timer = setTimeout(() => resolve(undefined), CONTEXT_TIMEOUT_MS)
    }),
  ])
  clearTimeout(timer)
  const context: ChatContext | undefined = page ? { app: built?.app ?? '', learner: built?.learner ?? '', page } : built

  let messages: Message[] = [
    ...turns.slice(-MAX_TURNS_SENT).flatMap((turn): Message[] => [
      { role: 'user', content: turn.question },
      { role: 'assistant', content: turn.answer },
    ]),
    { role: 'user', content: trimmed },
  ]

  let checked = false
  const used: ToolCall[] = []
  for (let calls = 1; calls <= MAX_CALLS; calls++) {
    const reply = await callModel(messages, context, jwt, fetchImpl, online)
    if (reply.stop_reason === 'refusal') throw new ChatFailure('refused')
    if (reply.stop_reason !== 'tool_use') {
      const text = textOf(reply.content)
      if (!text) throw new ChatFailure('failed')
      const truncated = reply.stop_reason === 'max_tokens'
      // One second try per question, and only while a call is left for it.
      const notes = checked || truncated || calls === MAX_CALLS ? [] : check(text, trimmed)
      if (notes.length === 0) return { text, truncated, calls, tools: used }
      checked = true
      messages = [...messages, { role: 'assistant', content: reply.content }, { role: 'user', content: checkNote(notes) }]
      continue
    }
    const results: Block[] = []
    for (const block of reply.content) {
      if (block.type !== 'tool_use') continue
      used.push({ name: block.name, input: block.input })
      const outcome = await tool(block.name, block.input)
      results.push({ type: 'tool_result', tool_use_id: block.id, content: outcome.content, is_error: outcome.isError })
    }
    if (results.length === 0) throw new ChatFailure('failed')
    messages = [...messages, { role: 'assistant', content: reply.content }, { role: 'user', content: results }]
  }
  throw new ChatFailure('too-many-steps')
}
