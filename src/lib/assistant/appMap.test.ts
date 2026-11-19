import { describe, expect, it } from 'vitest'
import chatSource from '../../../api/chat.ts?raw'
import { tips, topics } from '../../data'
import { EXERCISE_TYPES } from '../exerciseOrder'
import { buildAppMap } from './appMap'
import { MAX_APP_CHARS, MAX_LEARNER_CHARS, MAX_PAGE_CHARS } from './limits'

const map = buildAppMap({ duels: true, accounts: true, reminders: false })

describe('app map', () => {
  it('names every grammar tip by id, so the model can ask for it exactly', () => {
    for (const tip of tips) expect(map).toContain(`- ${tip.id} · ${tip.level} · `)
  })

  it('lists every exercise with its address and every topic', () => {
    for (const type of EXERCISE_TYPES) expect(map).toContain(`/practice?type=${type})`)
    for (const topic of topics) expect(map).toContain(`- ${topic.id}: `)
  })

  it('includes the guide and what is available on this device', () => {
    expect(map).toContain('Denník (/diary, /diary/new)')
    expect(map).toContain('Duel: áno, pripomienky: nie')
  })

  it('gives the number of tips per level', () => {
    for (const level of ['A1', 'A2', 'B1', 'B2'] as const) {
      expect(map).toContain(`## ${level}: ${tips.filter((tip) => tip.level === level).length} tipov`)
    }
  })

  it('stays under the limit the server accepts', () => {
    expect(map.length).toBeLessThan(MAX_APP_CHARS)
  })

  it('uses the same limits as the server', () => {
    const server = (name: string) => Number(chatSource.match(new RegExp(`${name} = ([\\d_]+)`))![1].replace(/_/g, ''))
    expect(server('MAX_APP_CHARS')).toBe(MAX_APP_CHARS)
    expect(server('MAX_LEARNER_CHARS')).toBe(MAX_LEARNER_CHARS)
    expect(server('MAX_PAGE_CHARS')).toBe(MAX_PAGE_CHARS)
  })
})
