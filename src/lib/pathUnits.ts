import { path, sentences, words } from '../data'
import type { Level, PathEntry, Sentence, Word } from '../data/types'

// The units of the guided path ("Cesta", docs/guided-path-spec.md) and what each one teaches. No other
// module of the path here, so tests.ts can use it for the tests of a topic's parts.

export interface PathUnit extends PathEntry {
  id: string // "a1-food-2"
  parts: number // how many units the topic has at the level
}

/** A unit teaches at most this many new words (validate:data). */
export const MAX_UNIT_WORDS = 20

const entries = path

export const unitId = ({ level, topic, part }: Pick<PathEntry, 'level' | 'topic' | 'part'>) => `${level.toLowerCase()}-${topic}-${part}`

const partCount = (level: Level, topic: string) => entries.filter((e) => e.level === level && e.topic === topic).length

/** The units in the order of path.json. */
export const pathUnits: PathUnit[] = entries.map((entry) => ({ ...entry, id: unitId(entry), parts: partCount(entry.level, entry.topic) }))
export const pathUnitById = new Map(pathUnits.map((unit) => [unit.id, unit]))

/** Part `part` (1…n) of n of a list, in its order, the parts as even as they go. */
function partOf<T>(items: T[], part: number, parts: number): T[] {
  const at = (i: number) => Math.round((i * items.length) / parts)
  return items.slice(at(part - 1), at(part))
}

/** An item belongs to the topic it names first: a word in two topics is taught once. */
const ofTopic = (item: Word | Sentence, level: Level, topic: string) => item.level === level && item.topics[0] === topic

const materialCache = new Map<string, { words: Word[]; sentences: Sentence[] }>()

/** The words and sentences of a unit: its topic's at its level, in data order, the unit's part of them. */
export function unitMaterial(unit: Pick<PathEntry, 'level' | 'topic' | 'part'>): { words: Word[]; sentences: Sentence[] } {
  const id = unitId(unit)
  let material = materialCache.get(id)
  if (!material) {
    const parts = partCount(unit.level, unit.topic)
    material = {
      words: partOf(words.filter((w) => ofTopic(w, unit.level, unit.topic)), unit.part, parts),
      sentences: partOf(sentences.filter((s) => ofTopic(s, unit.level, unit.topic)), unit.part, parts),
    }
    materialCache.set(id, material)
  }
  return material
}

/**
 * The units of the path for a learner: the topic picked in the welcome comes right after the first two
 * units of the level the learner starts at.
 */
export function orderedUnits(topic?: string, level: Level = 'A1'): PathUnit[] {
  const start = pathUnits.findIndex((unit) => unit.level === level)
  const first = pathUnits.findIndex((unit) => unit.level === level && unit.topic === topic && unit.part === 1)
  if (start < 0 || first <= start + 2) return pathUnits
  const rest = pathUnits.filter((_, i) => i !== first)
  return [...rest.slice(0, start + 2), pathUnits[first], ...rest.slice(start + 2)]
}
