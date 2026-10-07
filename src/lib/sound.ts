import { useSyncExternalStore } from 'react'
import type { Verdict } from './checkAnswer'

// Sound effects: short synthesized sounds (Web Audio), no files, so they work offline and cost
// nothing to load. The learner picks a set or turns them off in Nastavenia; stored per device.
// A web page cannot see the phone's silent mode: the sounds follow the media volume.

export const SOUND_SETS = ['off', 'suave', 'marimba'] as const
export type SoundSet = (typeof SOUND_SETS)[number]
export type SoundEvent = 'correct' | 'almost' | 'wrong' | 'tap' | 'lesson' | 'goal'

const STORAGE_KEY = 'somos-sound'
const DEFAULT_SET: SoundSet = 'suave'

export const parseSoundSet = (value: unknown): SoundSet | undefined => SOUND_SETS.find((set) => set === value)

function readSet(): SoundSet {
  try {
    return parseSoundSet(localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_SET
  } catch {
    return DEFAULT_SET
  }
}

let current = readSet()
const listeners = new Set<() => void>()

/** Current set outside React (the backup). */
export const getSoundSet = () => current

export function setSoundSet(set: SoundSet) {
  current = set
  try {
    localStorage.setItem(STORAGE_KEY, set)
  } catch {
    // The choice just won't survive a reload.
  }
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

export function useSoundSet(): SoundSet {
  return useSyncExternalStore(subscribe, () => current)
}

/** The sound for a checked answer: an accent slip or a forgiven typo is right, but not quite. */
export function soundForVerdict(verdict: Verdict): SoundEvent {
  if (verdict === 'wrong') return 'wrong'
  return verdict === 'correct' ? 'correct' : 'almost'
}

// ---------- the instrument: every voice schedules one note on `ctx` into `out` at time `t` ----------

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

/** [ratio to the fundamental, level, share of the note's length it rings for] */
type Partial = [ratio: number, level: number, life: number]
const MARIMBA: Partial[] = [
  [1, 1, 1],
  [4, 0.28, 0.35],
  [10, 0.07, 0.12],
]

/** A struck wooden bar: sine partials, each dying away at its own pace. */
function struck(ctx: BaseAudioContext, out: AudioNode, t: number, freq: number, dur: number, gain: number) {
  for (const [ratio, level, life] of MARIMBA) {
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    const end = t + dur * life
    osc.frequency.value = freq * ratio
    amp.gain.setValueAtTime(0, t)
    amp.gain.linearRampToValueAtTime(gain * level, t + 0.004)
    amp.gain.exponentialRampToValueAtTime(0.0001, end)
    osc.connect(amp).connect(out)
    osc.start(t)
    osc.stop(end + 0.02)
  }
}

/** A soft blip whose pitch slides from one frequency to another. */
function glide(ctx: BaseAudioContext, out: AudioNode, t: number, type: OscillatorType, from: number, to: number, dur: number, gain: number) {
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, t)
  osc.frequency.exponentialRampToValueAtTime(to, t + dur * 0.7)
  amp.gain.setValueAtTime(0, t)
  amp.gain.linearRampToValueAtTime(gain, t + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(amp).connect(out)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

type Voice = (ctx: BaseAudioContext, out: AudioNode, t: number) => void

/** The sets as Adam chose them by ear (2026-10-07); the numbers are notes (MIDI) or frequencies (Hz). */
const SOUNDS: Record<Exclude<SoundSet, 'off'>, Record<SoundEvent, Voice>> = {
  // Quiet, soft blips: the least intrusive.
  suave: {
    correct: (c, o, t) => {
      glide(c, o, t, 'sine', 660, 990, 0.16, 0.4)
      glide(c, o, t + 0.1, 'sine', 990, 1320, 0.26, 0.4)
    },
    almost: (c, o, t) => glide(c, o, t, 'sine', 660, 880, 0.24, 0.38),
    wrong: (c, o, t) => glide(c, o, t, 'triangle', 233, 165, 0.3, 0.55),
    tap: (c, o, t) => glide(c, o, t, 'sine', 1200, 1100, 0.05, 0.22),
    lesson: (c, o, t) => [523, 659, 784, 1047].forEach((f, i) => glide(c, o, t + i * 0.11, 'sine', f, f * 1.02, i === 3 ? 0.6 : 0.2, 0.36)),
    goal: (c, o, t) => {
      ;[523, 659, 784, 1047, 1319].forEach((f, i) => glide(c, o, t + i * 0.09, 'sine', f, f * 1.02, 0.2, 0.32))
      ;[523, 784, 1047].forEach((f) => glide(c, o, t + 0.55, 'sine', f, f, 1.1, 0.24))
    },
  },
  // Wooden keys: warm, short, playful.
  marimba: {
    correct: (c, o, t) => {
      struck(c, o, t, hz(79), 0.45, 0.5)
      struck(c, o, t + 0.1, hz(84), 0.6, 0.5)
    },
    almost: (c, o, t) => {
      struck(c, o, t, hz(79), 0.4, 0.42)
      struck(c, o, t + 0.1, hz(81), 0.5, 0.42)
    },
    wrong: (c, o, t) => {
      struck(c, o, t, hz(67), 0.35, 0.5)
      struck(c, o, t + 0.14, hz(64), 0.5, 0.5)
    },
    tap: (c, o, t) => struck(c, o, t, hz(88), 0.09, 0.3),
    lesson: (c, o, t) => [72, 76, 79, 84].forEach((m, i) => struck(c, o, t + i * 0.1, hz(m), i === 3 ? 0.9 : 0.45, 0.45)),
    goal: (c, o, t) => {
      ;[67, 72, 76, 79, 84, 88].forEach((m, i) => struck(c, o, t + i * 0.075, hz(m), 0.4, 0.4))
      ;[72, 76, 79, 84].forEach((m) => struck(c, o, t + 0.62, hz(m), 1.3, 0.3))
    },
  },
}

/** One volume for everything, low enough that the fullest chord stays clear of clipping. */
const VOLUME = 0.6

let ctx: AudioContext | undefined
let out: GainNode | undefined

function output(): { ctx: AudioContext; out: GainNode } | undefined {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return undefined
  if (!ctx || !out) {
    ctx = new AudioContext()
    out = ctx.createGain()
    out.gain.value = VOLUME
    out.connect(ctx.destination)
  }
  // The browser keeps a context asleep until the learner has touched the page; sounds follow a tap anyway.
  if (ctx.state === 'suspended') void ctx.resume()
  return { ctx, out }
}

/**
 * Plays a sound of the chosen set, `delay` seconds from now. Never throws and never waits:
 * a sound that cannot play is simply not heard.
 */
export function playSound(event: SoundEvent, delay = 0, set: SoundSet = current): void {
  if (set === 'off') return
  try {
    const audio = output()
    if (audio) SOUNDS[set][event](audio.ctx, audio.out, audio.ctx.currentTime + 0.02 + delay)
  } catch {
    // No audio device, or the browser refused: silence.
  }
}
