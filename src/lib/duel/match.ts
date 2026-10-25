import type { Level } from '../../data/types'
import type { Verdict } from '../checkAnswer'
import { getStablePool, seededRandom, taskFromItem, type ExerciseType, type Task } from '../lesson'

// A duel: 3 rounds × 5 tasks, both players get the same tasks at the same moment (docs/duel-spec.md).
// Everything here is pure: both phones compute the same match, schedule and score from the same data.

export const DUEL_LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2']
export const TASKS_PER_ROUND = 5

/** Seconds per task: shorter to pick, longer to type or build. */
export const DUEL_SECONDS: Partial<Record<ExerciseType, number>> = { choice: 10, conjugation: 15, vocab: 15, builder: 25 }

/** The 3 – 2 – 1 before the first task. */
export const COUNTDOWN_MS = 3000
/** The right answer and both players' points, after each task. */
export const REVEAL_MS = 1800
/** The subtotal after a round, and the next round's name. */
export const ROUND_BREAK_MS = 3500

export interface DuelRound {
  type: ExerciseType
  seconds: number
  items: string[] // itemIds as in Chyby: "s001#0", "tener:preterito:yo", "casa:sk-es"
}

/** Round 2 takes turns between Časovanie and Slovná zásoba, from one duel to the next. */
export function roundTypes(seed: number): ExerciseType[] {
  return ['choice', seed % 2 === 0 ? 'conjugation' : 'vocab', 'builder']
}

const sentenceOf = (type: ExerciseType, itemId: string) => (type === 'choice' ? itemId.split('#')[0] : type === 'builder' ? itemId : undefined)

/** The tasks of a new duel: five of each round's type from the level, no sentence twice. */
export function buildRounds(level: Level, seed: number): DuelRound[] {
  const random = seededRandom(seed)
  const usedSentences = new Set<string>()
  return roundTypes(seed).map((type) => {
    const filter = type === 'conjugation' ? { type, level, tense: 'all' as const } : { type, level, topic: 'all' }
    const pool = getStablePool(filter).map((task) => task.itemId)
    // Fisher–Yates with the duel's own numbers: the same seed, the same pick.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const items: string[] = []
    for (const itemId of pool) {
      if (items.length === TASKS_PER_ROUND) break
      const sentence = sentenceOf(type, itemId)
      if (sentence && usedSentences.has(sentence)) continue
      if (sentence) usedSentences.add(sentence)
      items.push(itemId)
    }
    return { type, seconds: DUEL_SECONDS[type] ?? 15, items }
  })
}

export interface DuelSlot {
  index: number // 0 … 14, over all rounds
  round: number // 0 … 2
  type: ExerciseType
  seconds: number
  itemId: string
}

export const slotsOf = (rounds: DuelRound[]): DuelSlot[] =>
  rounds.flatMap((round, r) => round.items.map((itemId) => ({ round: r, type: round.type, seconds: round.seconds, itemId }))).map((slot, index) => ({ ...slot, index }))

/** The task of each slot, with options and tiles in the same order on both phones; undefined if the content has it no more. */
export const duelTask = (slot: DuelSlot, seed: number): Task | undefined => taskFromItem(slot.type, slot.itemId, seededRandom(seed + slot.index * 7919))

// ---------- answers and points ----------

export type DuelResult = 'right' | 'almost' | 'wrong'

export const resultOf = (verdict: Verdict): DuelResult => (verdict === 'typo' ? 'almost' : verdict === 'wrong' ? 'wrong' : 'right')

export interface DuelAnswer {
  task: number // slot index
  userId: string
  result: DuelResult
  ms: number // how long the player took (as measured on the phone)
  at: number // server time it arrived (ms)
}

export const MAX_POINTS = 15

/** 10 for a right answer and up to 5 more the faster it came; a slip 7; wrong or too late 0. */
export function pointsFor(result: DuelResult, ms: number, seconds: number): number {
  if (result === 'almost') return 7
  if (result === 'wrong') return 0
  const left = Math.max(0, 1 - ms / (seconds * 1000))
  return 10 + Math.round(5 * left)
}

// ---------- the schedule ----------

export type DuelPhase =
  | { kind: 'countdown'; until: number }
  | { kind: 'task'; slot: DuelSlot; startedAt: number; deadline: number }
  | { kind: 'reveal'; slot: DuelSlot; until: number }
  | { kind: 'break'; round: number; until: number } // after round `round`
  | { kind: 'done'; at: number }

/** The answers that count: the first of each player on each task, if it came before the deadline. */
function answersOn(slot: DuelSlot, start: number, answers: DuelAnswer[], players: string[]): DuelAnswer[] {
  const deadline = start + slot.seconds * 1000
  return players.flatMap((player) => {
    const answer = answers.find((a) => a.task === slot.index && a.userId === player)
    return answer && answer.at <= deadline ? [answer] : []
  })
}

interface SlotTimes {
  start: number
  end: number // both answered, or the time ran out
  revealEnd: number
  next: number // when the following task starts (after the round break, if one follows)
}

/**
 * When each task starts and ends: every task starts for both at once; it ends when both have answered or its time
 * is up, then the right answer shows for a moment, and a round ends with its subtotal. Both phones get the same
 * from the same start time and answers (server times), whenever a message reaches them.
 */
function timeline(slots: DuelSlot[], startedAt: number, answers: DuelAnswer[], players: string[]): SlotTimes[] {
  const times: SlotTimes[] = []
  let start = startedAt + COUNTDOWN_MS
  for (const slot of slots) {
    const counted = answersOn(slot, start, answers, players)
    const end = counted.length === players.length ? Math.max(start, ...counted.map((a) => a.at)) : start + slot.seconds * 1000
    const revealEnd = end + REVEAL_MS
    const following = slots[slot.index + 1]
    const next = following && following.round !== slot.round ? revealEnd + ROUND_BREAK_MS : revealEnd
    times.push({ start, end, revealEnd, next })
    start = next
  }
  return times
}

/** Where the match is at `now`. */
export function phaseAt(slots: DuelSlot[], startedAt: number, answers: DuelAnswer[], players: string[], now: number): DuelPhase {
  const times = timeline(slots, startedAt, answers, players)
  if (now < startedAt + COUNTDOWN_MS) return { kind: 'countdown', until: startedAt + COUNTDOWN_MS }
  for (const slot of slots) {
    const { start, end, revealEnd, next } = times[slot.index]
    if (now < end) return { kind: 'task', slot, startedAt: start, deadline: start + slot.seconds * 1000 }
    if (now < revealEnd) return { kind: 'reveal', slot, until: revealEnd }
    if (now < next) return { kind: 'break', round: slot.round, until: next }
  }
  return { kind: 'done', at: times.at(-1)?.next ?? startedAt + COUNTDOWN_MS }
}

// ---------- the score ----------

export interface PlayerScore {
  points: number
  rounds: number[] // points per round
  ms: number // time over all tasks; a task not answered in time counts its whole time
  tasks: { result: DuelResult | null; points: number; ms: number }[] // null = no answer in time
}

export interface DuelScore {
  players: Record<string, PlayerScore>
  leader: string | null // ahead on points now; null when level
  winner: string | null // at the end: more points, then less time; null for a draw
}

/** The score after the tasks up to `upTo` (all by default): what the suns show and who won. */
export function scoreOf(slots: DuelSlot[], startedAt: number, answers: DuelAnswer[], players: string[], upTo = slots.length): DuelScore {
  const times = timeline(slots, startedAt, answers, players)
  const scores: Record<string, PlayerScore> = {}
  for (const player of players) {
    const score: PlayerScore = { points: 0, rounds: [0, 0, 0], ms: 0, tasks: [] }
    for (const slot of slots.slice(0, upTo)) {
      const answer = answersOn(slot, times[slot.index].start, answers, [player])[0]
      const limit = slot.seconds * 1000
      const ms = answer ? Math.min(answer.ms, limit) : limit
      const points = answer ? pointsFor(answer.result, ms, slot.seconds) : 0
      score.points += points
      score.rounds[slot.round] += points
      score.ms += ms
      score.tasks.push({ result: answer?.result ?? null, points, ms })
    }
    scores[player] = score
  }
  const [a, b] = players
  const leader = b === undefined ? (a ?? null) : scores[a].points === scores[b].points ? null : scores[a].points > scores[b].points ? a : b
  let winner = leader
  if (b !== undefined && leader === null && scores[a].ms !== scores[b].ms) winner = scores[a].ms < scores[b].ms ? a : b
  return { players: scores, leader, winner }
}
