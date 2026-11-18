import { describe, expect, it, vi } from 'vitest'
vi.mock('../account', () => ({ getClient: () => Promise.reject(new Error('no client in tests')) }))
import type { SupabaseClient } from '@supabase/supabase-js'
import { feedbackRow, sendFeedback } from './feedback'

const turn = { question: 'Ako sa povie auto?', answer: 'El carro.', tools: [{ name: 'search_word', input: { query: 'auto' } }], page: 'Domov' }

describe('feedbackRow', () => {
  it('keeps the question, the answer, the tools and the page; a reason only with 👎', () => {
    expect(feedbackRow(turn, 'down', 'wrong')).toMatchObject({ rating: 'down', reason: 'wrong', question: turn.question, answer: turn.answer, tools: turn.tools, page: 'Domov' })
    expect(feedbackRow(turn, 'up', 'wrong').reason).toBeNull()
    expect(feedbackRow({ question: 'q', answer: 'a' }, 'up')).toMatchObject({ tools: [], page: null })
  })

  it('cuts what the table would refuse', () => {
    const big = { question: 'q'.repeat(900), answer: 'a'.repeat(9000), tools: Array.from({ length: 50 }, () => ({ name: 'x', input: { query: 'y'.repeat(300) } })) }
    const row = feedbackRow(big, 'down', 'long')
    expect(row.question).toHaveLength(600)
    expect(row.answer).toHaveLength(6000)
    expect(JSON.stringify(row.tools).length).toBeLessThanOrEqual(6000)
    expect(row.tools.length).toBeGreaterThan(0)
  })
})

describe('sendFeedback', () => {
  it('inserts the row and throws when the server refuses it', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    const client = Promise.resolve({ from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient)
    const row = feedbackRow(turn, 'up')
    await sendFeedback(row, client)
    expect(insert).toHaveBeenCalledWith(row)

    const refusing = Promise.resolve({ from: () => ({ insert: async () => ({ error: { message: 'relation does not exist' } }) }) } as unknown as SupabaseClient)
    await expect(sendFeedback(row, refusing)).rejects.toThrow('relation does not exist')
  })
})
