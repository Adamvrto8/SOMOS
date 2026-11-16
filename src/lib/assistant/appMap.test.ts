import { describe, expect, it } from 'vitest'
import { tips, topics } from '../../data'
import { EXERCISE_TYPES } from '../exerciseOrder'
import { buildAppMap } from './appMap'
import { MAX_APP_CHARS } from './limits'

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
    expect(map).toContain('Denník (/diary)')
    expect(map).toContain('Duel: áno, pripomienky: nie')
  })

  it('stays under the limit the server accepts', () => {
    expect(map.length).toBeLessThan(MAX_APP_CHARS)
  })
})
