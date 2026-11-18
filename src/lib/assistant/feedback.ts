import type { SupabaseClient } from '@supabase/supabase-js'
import { getClient } from '../account'
import type { ChatTurn, FeedbackReason } from '../db'

// 👍 / 👎 under a SOMO answer (docs/chat-assistant-improvements.md S3): stored in Supabase chat_feedback
// (supabase/schema.sql) with the question, the answer as the model wrote it, the tools it called and the page, so
// the eval set grows from real questions. Row level security lets a learner insert only their own rows.

export const FEEDBACK_REASONS: FeedbackReason[] = ['wrong', 'unclear', 'long', 'other']

const MAX_QUESTION = 600
const MAX_ANSWER = 6000
const MAX_TOOLS_JSON = 6000
const MAX_PAGE = 300

export interface FeedbackRow {
  rating: 'up' | 'down'
  reason: FeedbackReason | null
  question: string
  answer: string
  tools: { name: string; input: unknown }[]
  page: string | null
  app_version: string | null
}

const version = () => (typeof __APP_VERSION__ === 'string' ? __APP_VERSION__.slice(0, 40) : null)

/** The row for one rated turn, cut to what the table takes. */
export function feedbackRow(turn: ChatTurn, rating: 'up' | 'down', reason?: FeedbackReason): FeedbackRow {
  let tools = turn.tools ?? []
  // The newest calls go first when they do not fit: the first ones show how the model began.
  while (tools.length > 0 && JSON.stringify(tools).length > MAX_TOOLS_JSON) tools = tools.slice(0, -1)
  return {
    rating,
    reason: rating === 'down' ? (reason ?? null) : null,
    question: turn.question.slice(0, MAX_QUESTION),
    answer: turn.answer.slice(0, MAX_ANSWER),
    tools,
    page: turn.page?.slice(0, MAX_PAGE) ?? null,
    app_version: version(),
  }
}

/** Sends a rating; throws when it did not get there (the screen says so, the rating stays on the device). */
export async function sendFeedback(row: FeedbackRow, client: Promise<SupabaseClient> = getClient()): Promise<void> {
  const { error } = await (await client).from('chat_feedback').insert(row)
  if (error) throw new Error(error.message)
}
