import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseSoundSet, playSound, soundForVerdict } from './sound'

describe('soundForVerdict', () => {
  it('tells right, right but not quite, and wrong apart', () => {
    expect(soundForVerdict('correct')).toBe('correct')
    expect(soundForVerdict('accent')).toBe('almost')
    expect(soundForVerdict('typo')).toBe('almost')
    expect(soundForVerdict('wrong')).toBe('wrong')
  })
})

describe('parseSoundSet', () => {
  it('knows the sets and "off", nothing else', () => {
    expect(parseSoundSet('suave')).toBe('suave')
    expect(parseSoundSet('marimba')).toBe('marimba')
    expect(parseSoundSet('off')).toBe('off')
    expect(parseSoundSet('guitarra')).toBeUndefined()
    expect(parseSoundSet(null)).toBeUndefined()
  })
})

describe('playSound', () => {
  afterEach(() => vi.unstubAllGlobals())

  /** Counts what is scheduled, like a browser's AudioContext would play it. */
  function fakeAudio() {
    const started: number[] = []
    const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() })
    const node = () => ({ connect: (next: unknown) => next })
    class FakeContext {
      currentTime = 10
      state = 'running'
      destination = node()
      createGain = () => ({ ...node(), gain: param() })
      createOscillator = () => ({ ...node(), type: 'sine', frequency: param(), start: (at: number) => started.push(at), stop: vi.fn() })
      resume = vi.fn()
    }
    vi.stubGlobal('window', { AudioContext: FakeContext })
    vi.stubGlobal('AudioContext', FakeContext)
    return started
  }

  it('is silent without an audio device, and when turned off', () => {
    expect(() => playSound('correct', 0, 'suave')).not.toThrow()
    const started = fakeAudio()
    playSound('correct', 0, 'off')
    expect(started).toEqual([])
  })

  it('plays every sound of every set, at the time asked for', () => {
    const started = fakeAudio()
    for (const set of ['suave', 'marimba'] as const) {
      for (const event of ['correct', 'almost', 'wrong', 'tap', 'lesson', 'goal'] as const) {
        started.length = 0
        playSound(event, 0.5, set)
        expect(started.length, `${set} ${event}`).toBeGreaterThan(0)
        expect(Math.min(...started)).toBeCloseTo(10.52)
      }
    }
  })
})
