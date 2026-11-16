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

/**
 * Hľadať: the few tips whose title holds every word of the query ("ser" → ser a estar), for a row under the words.
 * Only titles: a word like "casa" in an example or "čas" in a rule title would bring tips nobody looked for.
 */
export function searchTipTitles(tips: readonly Tip[], query: string, limit = 3): Tip[] {
  const wanted = words(query)
  if (wanted.join('').length < 3) return []
  return tips.filter((tip) => wanted.every((word) => starts(entryOf(tip).title, word))).slice(0, limit)
}

/** Question words and fillers the assistant's model puts in a query ("rozdiel medzi por a para"); no tip is about them. */
const FILLERS = new Set(
  ['a', 'e', 'i', 'o', 'u', 'y', 'v', 'vs', 'na', 'sa', 'je', 'co', 'ci', 'ako', 'aky', 'aka', 'ake', 'kedy', 'medzi', 'rozdiel',
    'pouzit', 'pouziva', 'pouzivat', 'pouzitie', 'vysvetli', 'pravidla', 'pravidlo', 'tip', 'gramatika', 'the', 'and', 'or',
    'when', 'how', 'use', 'difference', 'between'],
)

/**
 * The assistant's search (get_grammar_tip): a word no tip holds does not drop a tip, it just adds nothing, so a whole
 * question still finds its tip. A tip needs at least one word in its title or rule titles, so a word met only in an
 * example ("saber" in a sentence) brings nothing.
 */
export function rankTips(tips: readonly Tip[], query: string): Tip[] {
  const wanted = words(query).filter((word) => !FILLERS.has(word))
  if (wanted.length === 0) return []
  const scored: { tip: Tip; score: number; order: number }[] = []
  tips.forEach((tip, order) => {
    const entry = entryOf(tip)
    let score = 0
    let headed = false
    for (const word of wanted) {
      const points = starts(entry.title, word) ? 3 : starts(entry.rules, word) ? 2 : starts(entry.rest, word) ? 1 : 0
      score += points
      if (points >= 2) headed = true
    }
    if (headed) scored.push({ tip, score, order })
  })
  return scored.sort((a, b) => b.score - a.score || a.order - b.order).map((s) => s.tip)
}
