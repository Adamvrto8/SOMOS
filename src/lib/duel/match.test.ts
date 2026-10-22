import { describe, expect, it } from 'vitest'
import { sentenceById, verbById, wordById } from '../../data'
import {
  buildRounds,
  COUNTDOWN_MS,
  duelTask,
  phaseAt,
  pointsFor,
  REVEAL_MS,
  ROUND_BREAK_MS,
  roundTypes,
  scoreOf,
  slotsOf,
  TASKS_PER_ROUND,
  type DuelAnswer,
} from './match'

const A = 'ana'
const B = 'ben'
const players = [A, B]
const T0 = 1_000_000

describe('buildRounds', () => {
  it('makes three rounds of five tasks of the level, round 2 taking turns', () => {
    for (const seed of [1, 2]) {
      const rounds = buildRounds('A1', seed)
      expect(rounds.map((r) => r.type)).toEqual(roundTypes(seed))
      expect(rounds.map((r) => r.items.length)).toEqual([TASKS_PER_ROUND, TASKS_PER_ROUND, TASKS_PER_ROUND])
      expect(rounds.map((r) => r.seconds)).toEqual([10, seed % 2 === 0 ? 15 : 15, 25])
    }
    expect(roundTypes(2)[1]).toBe('conjugation')
    expect(roundTypes(3)[1]).toBe('vocab')
  })

  it('takes its tasks from the level only, and no sentence twice', () => {
    for (const level of ['A1', 'A2', 'B1'] as const) {
      const [choice, middle, builder] = buildRounds(level, 7)
      const sentences = [...choice.items.map((id) => id.split('#')[0]), ...builder.items]
      expect(new Set(sentences).size).toBe(sentences.length)
      for (const id of sentences) expect(sentenceById.get(id)?.level).toBe(level)
      for (const id of middle.items) {
        const level2 = middle.type === 'vocab' ? wordById.get(id.split(':')[0])?.level : verbById.get(id.split(':')[0])?.level
        expect(level2).toBe(level)
      }
    }
  })

  it('always builds what the server accepts (valid_duel in supabase/schema.sql): 3 × 5 items, the allowed type and time', () => {
    const allowed: Record<string, number> = { choice: 10, conjugation: 15, vocab: 15, builder: 25 }
    for (const level of ['A1', 'A2', 'B1'] as const) {
      for (let seed = 0; seed < 40; seed++) {
        const rounds = buildRounds(level, seed * 7919)
        expect(rounds).toHaveLength(3)
        for (const round of rounds) {
          expect(round.items).toHaveLength(TASKS_PER_ROUND)
          expect(round.seconds).toBe(allowed[round.type])
          for (const item of round.items) expect(item.length).toBeLessThanOrEqual(60)
        }
        expect(JSON.stringify(rounds).length).toBeLessThan(4000)
      }
    }
  })

  it('gives the same seed the same duel, another seed another one', () => {
    expect(buildRounds('A2', 99)).toEqual(buildRounds('A2', 99))
    expect(buildRounds('A2', 99)).not.toEqual(buildRounds('A2', 101))
  })

  it('builds every task with the same options and tiles on both phones', () => {
    const seed = 12
    const slots = slotsOf(buildRounds('A1', seed))
    expect(slots).toHaveLength(15)
    for (const slot of slots) {
      const one = duelTask(slot, seed)
      expect(one).toBeDefined()
      expect(duelTask(slot, seed)).toEqual(one)
    }
  })
})

describe('pointsFor', () => {
  it('gives 10 and up to 5 for speed, 7 for a slip, 0 for wrong', () => {
    expect(pointsFor('right', 0, 10)).toBe(15)
    expect(pointsFor('right', 5000, 10)).toBe(13)
    expect(pointsFor('right', 10_000, 10)).toBe(10)
    expect(pointsFor('almost', 100, 10)).toBe(7)
    expect(pointsFor('wrong', 100, 10)).toBe(0)
  })
})

describe('phaseAt', () => {
  const slots = slotsOf(buildRounds('A1', 4))
  const first = T0 + COUNTDOWN_MS
  const answer = (task: number, userId: string, at: number, result: DuelAnswer['result'] = 'right'): DuelAnswer => ({ task, userId, result, ms: 1000, at })

  it('counts down, then the first task until its time is up', () => {
    expect(phaseAt(slots, T0, [], players, T0 + 10)).toEqual({ kind: 'countdown', until: first })
    const phase = phaseAt(slots, T0, [], players, first + 9000)
    expect(phase).toMatchObject({ kind: 'task', slot: { index: 0 }, startedAt: first, deadline: first + 10_000 })
    expect(phaseAt(slots, T0, [], players, first + 10_000)).toMatchObject({ kind: 'reveal', slot: { index: 0 }, until: first + 10_000 + REVEAL_MS })
  })

  it('goes on as soon as both have answered, not when only one has', () => {
    const one = [answer(0, A, first + 2000)]
    expect(phaseAt(slots, T0, one, players, first + 3000)).toMatchObject({ kind: 'task', slot: { index: 0 } })
    const both = [...one, answer(0, B, first + 4000)]
    expect(phaseAt(slots, T0, both, players, first + 4000)).toMatchObject({ kind: 'reveal', slot: { index: 0 } })
    expect(phaseAt(slots, T0, both, players, first + 4000 + REVEAL_MS)).toMatchObject({ kind: 'task', slot: { index: 1 }, startedAt: first + 4000 + REVEAL_MS })
  })

  it('ignores an answer that came after the deadline', () => {
    const late = [answer(0, A, first + 2000), answer(0, B, first + 11_000)]
    expect(phaseAt(slots, T0, late, players, first + 5000)).toMatchObject({ kind: 'task', slot: { index: 0 } })
    expect(scoreOf(slots, T0, late, players, 1).players[B].points).toBe(0)
  })

  it('pauses between rounds and ends after the last task', () => {
    // Nobody answers: every task takes its whole time.
    let t = first
    for (const slot of slots.slice(0, 5)) t += slot.seconds * 1000 + REVEAL_MS
    expect(phaseAt(slots, T0, [], players, t)).toEqual({ kind: 'break', round: 0, until: t + ROUND_BREAK_MS })
    expect(phaseAt(slots, T0, [], players, t + ROUND_BREAK_MS)).toMatchObject({ kind: 'task', slot: { index: 5, round: 1 } })
    expect(phaseAt(slots, T0, [], players, T0 + 10_000_000).kind).toBe('done')
  })
})

describe('scoreOf', () => {
  const slots = slotsOf(buildRounds('A1', 6))

  /** Both answer every task at once: `a` and `b` say how. */
  function play(a: (i: number) => DuelAnswer['result'], b: (i: number) => DuelAnswer['result'], msA = 1000, msB = 1000): DuelAnswer[] {
    const answers: DuelAnswer[] = []
    let start = T0 + COUNTDOWN_MS
    for (const slot of slots) {
      const at = start + Math.max(msA, msB)
      answers.push({ task: slot.index, userId: A, result: a(slot.index), ms: msA, at: start + msA })
      answers.push({ task: slot.index, userId: B, result: b(slot.index), ms: msB, at: start + msB })
      start = at + REVEAL_MS + (slots[slot.index + 1] && slots[slot.index + 1].round !== slot.round ? ROUND_BREAK_MS : 0)
    }
    return answers
  }

  it('adds up the points per round, and who leads and wins', () => {
    const answers = play(() => 'right', (i) => (i < 5 ? 'right' : 'wrong'))
    const score = scoreOf(slots, T0, answers, players)
    expect(score.players[A].rounds[1]).toBeGreaterThan(0)
    expect(score.players[B].rounds[1]).toBe(0)
    expect(score.players[A].points).toBeGreaterThan(score.players[B].points)
    expect(score.leader).toBe(A)
    expect(score.winner).toBe(A)
  })

  it('shows the score so far: after the first round both are level', () => {
    const answers = play(() => 'right', (i) => (i < 5 ? 'right' : 'wrong'))
    const early = scoreOf(slots, T0, answers, players, 5)
    expect(early.players[A].points).toBe(early.players[B].points)
    expect(early.leader).toBeNull()
  })

  it('breaks a tie on points by time, or calls it a draw', () => {
    // Both right every time; the slower one still gets the full bonus when the speed rounds to the same points.
    const same = scoreOf(slots, T0, play(() => 'right', () => 'right'), players)
    expect(same.leader).toBeNull()
    expect(same.winner).toBeNull()
    const wrongs = scoreOf(slots, T0, play(() => 'wrong', () => 'wrong', 1000, 2000), players)
    expect(wrongs.leader).toBeNull()
    expect(wrongs.winner).toBe(A)
  })

  it('counts a task not answered as its whole time and no points', () => {
    const score = scoreOf(slots, T0, [], players)
    expect(score.players[A].points).toBe(0)
    expect(score.players[A].ms).toBe(slots.reduce((n, s) => n + s.seconds * 1000, 0))
    expect(score.players[A].tasks.every((t) => t.result === null)).toBe(true)
  })
})
