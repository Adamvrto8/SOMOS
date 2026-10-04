import tipsJson from './tips.json'
import topicsJson from './topics.json'
import enTipsJson from './en/tips.json'
import enTopicsJson from './en/topics.json'
import type { Sentence, SentenceEn, Tip, TipEn, Topic, TopicEn, Verb, VerbEn, Word, WordEn } from './types'

// Content is split into one file per topic (words/, sentences/) and per batch (verbs/).
// Vite bundles every file matched here; order = file name, then order inside the file.
const collect = <T>(modules: Record<string, unknown>): T[] =>
  Object.keys(modules)
    .sort()
    .flatMap((path) => modules[path] as T[])

// JSON imports are typed loosely (string instead of literal unions);
// shape and content are enforced by `npm run validate:data`.
export const topics = topicsJson as Topic[]
export const tips = tipsJson as Tip[]
export const words = collect<Word>(import.meta.glob('./words/*.json', { eager: true, import: 'default' }))
export const verbs = collect<Verb>(import.meta.glob('./verbs/*.json', { eager: true, import: 'default' }))
export const sentences = collect<Sentence>(import.meta.glob('./sentences/*.json', { eager: true, import: 'default' }))

export const wordById = new Map(words.map((w) => [w.id, w]))
export const verbById = new Map(verbs.map((v) => [v.id, v]))
export const topicById = new Map(topics.map((t) => [t.id, t]))
export const sentenceById = new Map(sentences.map((s) => [s.id, s]))
export const tipById = new Map(tips.map((t) => [t.id, t]))
/** Verb id (infinitive) → its dictionary word id (a slug: "extrañar" → "extranar"). */
export const wordIdByVerb = new Map(words.flatMap((w) => (w.verbId ? [[w.verbId, w.id] as const] : [])))

// The English overlay, by id (see types.ts). Only src/lib/localized.ts reads it.
const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((item) => [item.id, item]))
export const english = {
  words: byId(collect<WordEn>(import.meta.glob('./en/words/*.json', { eager: true, import: 'default' }))),
  verbs: byId(collect<VerbEn>(import.meta.glob('./en/verbs/*.json', { eager: true, import: 'default' }))),
  sentences: byId(collect<SentenceEn>(import.meta.glob('./en/sentences/*.json', { eager: true, import: 'default' }))),
  topics: byId(enTopicsJson as TopicEn[]),
  tips: byId(enTipsJson as TipEn[]),
}
