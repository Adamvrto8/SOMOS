import { describe, expect, it } from 'vitest'
import appSource from '../../App.tsx?raw'
import { GUIDE, guideText } from './appGuide'

// Screens the guide leaves out on purpose: redirects, players and details opened from a screen it describes, dev pages.
const NOT_GUIDED = new Set([
  '*', 'practice/path', 'archive/settings', 'archive/settings/:section', 'archive/account', 'profile/:section',
  'archive/custom/:id', 'diary/:date', '/practice/test', '/duel/:code', '/assistant', '/welcome', '/welcome/restore', '/dev/crash',
])

const routes = [...appSource.matchAll(/path: '([^']+)'/g)].map((m) => m[1]).filter((path) => !NOT_GUIDED.has(path))
const links = GUIDE.flatMap((section) => section.links)

/** "word/:id" is covered by a link "/word…"; "practice/lesson" by "/practice/lesson?mixed=A1". */
const covered = (route: string) => {
  const prefix = `/${route.replace(/^\//, '').split('/:')[0]}`
  return links.some((link) => link === prefix || link.startsWith(`${prefix}/`) || link.startsWith(`${prefix}?`))
}

describe('app guide', () => {
  it('has a section for every screen of the app', () => {
    expect(routes.length).toBeGreaterThan(15)
    expect(routes.filter((route) => !covered(route))).toEqual([])
  })

  it('covers Domov, which is an index route without a path', () => {
    expect(links).toContain('/')
  })

  it('has unique ids and a title and text in every section', () => {
    expect(new Set(GUIDE.map((s) => s.id)).size).toBe(GUIDE.length)
    for (const section of GUIDE) {
      expect(section.title.length).toBeGreaterThan(2)
      expect(section.text.length).toBeGreaterThan(20)
    }
  })

  it('renders one line per section', () => {
    expect(guideText().split('\n')).toHaveLength(GUIDE.length)
    expect(guideText()).toContain('Denník (/diary)')
  })
})
