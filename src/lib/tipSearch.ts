import type { Tip } from '../data/types.ts'
import { localizedTip } from './localized'
import { fold } from './text'

// The search of the grammar screen: every word of the query must start a word of the tip (accents and capitals ignored).
// The tip's own title ranks first, then its rule titles, then everything else it says.

const words = (text: string) => fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean)

interface Entry {
  tip: Tip
  title: string[]
  rules: string[]
  rest: string[]
}

function entryOf(tip: Tip): Entry {
  const local = localizedTip(tip)
  const rules = local.rules.map((rule) => rule.title).join(' ')
  const rest = [local.intro, ...local.rules.flatMap((rule) => [rule.text ?? '', ...rule.examples.flatMap((example) => [example.es, example.text])]), ...tip.ideas].join(' ')
  return { tip, title: words(local.title), rules: words(rules), rest: words(rest) }
}

const starts = (haystack: string[], word: string) => haystack.some((h) => h.startsWith(word))

/** The tips matching `query`, best first; an empty query returns them all in their order. */
export function searchTips(tips: readonly Tip[], query: string): Tip[] {
  const wanted = words(query)
  if (wanted.length === 0) return [...tips]
  const scored: { tip: Tip; score: number; order: number }[] = []
  tips.forEach((tip, order) => {
    const entry = entryOf(tip)
    let score = 0
    for (const word of wanted) {
      if (starts(entry.title, word)) score += 3
      else if (starts(entry.rules, word)) score += 2
      else if (starts(entry.rest, word)) score += 1
      else return
    }
    scored.push({ tip, score, order })
  })
  return scored.sort((a, b) => b.score - a.score || a.order - b.order).map((s) => s.tip)
}
