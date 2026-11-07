import pathJson from './path.json'
import sourcesJson from './sources.json'
import tipsJson from './tips.json'
import topicsJson from './topics.json'
import enTipsJson from './en/tips.json'
import enTopicsJson from './en/topics.json'
import esTipsJson from './es/tips.json'
import { applySentences, applyTips, applyTipsEn, applyWords, hiddenVerbIds, mergeById, otherVariantForms, type SentenceEs, type TipEs, type WordEs } from './applyVariant'
import { readVariant } from './variant'
import type { PathEntry, Sentence, SentenceEn, Source, Tip, TipEn, Topic, TopicEn, Verb, VerbEn, Word, WordEn } from './types'

// Content is split into one file per topic (words/, sentences/) and per batch (verbs/).
// Vite bundles every file matched here; order = file name, then order inside the file.
const collect = <T>(modules: Record<string, unknown>): T[] =>
  Object.keys(modules)
    .sort()
    .flatMap((path) => modules[path] as T[])

// JSON imports are typed loosely (string instead of literal unions);
// shape and content are enforced by `npm run validate:data`.
export const topics = topicsJson as Topic[]
export const sources = sourcesJson as Source[]
export const path = pathJson as PathEntry[]
/** Which Spanish is studied (Mexico by default); Spain lays src/data/es/ over the Mexican base, by id. */
export const variant = readVariant()
const esTips = esTipsJson as TipEs[]
export const tips = variant === 'es' ? applyTips(tipsJson as Tip[], esTips) : (tipsJson as Tip[])
const baseWords = collect<Word>(import.meta.glob('./words/*.json', { eager: true, import: 'default' }))
const esWords = mergeById(
  collect<WordEs>(import.meta.glob('./es/words/*.json', { eager: true, import: 'default' })),
  collect<WordEs>(import.meta.glob('./es/hand/words/*.json', { eager: true, import: 'default' })),
)
// Words and verbs only Spain says (conducir, aparcar…).
const esNewWords = collect<Word>(import.meta.glob('./es/new/words/*.json', { eager: true, import: 'default' }))
export const words = variant === 'es' ? [...applyWords(baseWords, esWords), ...esNewWords] : baseWords
/** Word id → the other variant's Spanish for it (coche ↔ carro), which the search finds too. */
export const otherForms = otherVariantForms(variant, baseWords, esWords, esNewWords)
const baseVerbs = collect<Verb>(import.meta.glob('./verbs/*.json', { eager: true, import: 'default' }))
const hiddenVerbs = hiddenVerbIds(baseWords, esWords)
export const verbs =
  variant === 'es'
    ? [...baseVerbs.filter((v) => !hiddenVerbs.has(v.id)), ...collect<Verb>(import.meta.glob('./es/new/verbs/*.json', { eager: true, import: 'default' }))]
    : baseVerbs
const baseSentences = collect<Sentence>(import.meta.glob('./sentences/*.json', { eager: true, import: 'default' }))
const esSentences =
  variant === 'es'
    ? mergeById(
        collect<SentenceEs>(import.meta.glob('./es/sentences/*.json', { eager: true, import: 'default' })),
        collect<SentenceEs>(import.meta.glob('./es/hand/sentences/*.json', { eager: true, import: 'default' })),
      )
    : []
// Sentences only Spain says (he comido hoy, vosotros, vale…), ids from s9001.
const esNewSentences = variant === 'es' ? collect<Sentence>(import.meta.glob('./es/new/sentences/*.json', { eager: true, import: 'default' })) : []
export const sentences = variant === 'es' ? [...applySentences(baseSentences, esSentences), ...esNewSentences] : baseSentences

/** The words vocab tasks ask: all but the articles (`drill: false`). */
export const vocabWords = words.filter((w) => w.drill !== false)

export const wordById = new Map(words.map((w) => [w.id, w]))
export const verbById = new Map(verbs.map((v) => [v.id, v]))
export const topicById = new Map(topics.map((t) => [t.id, t]))
export const sentenceById = new Map(sentences.map((s) => [s.id, s]))
export const tipById = new Map(tips.map((t) => [t.id, t]))
export const sourceById = new Map(sources.map((s) => [s.id, s]))
/** Verb id (infinitive) → its dictionary word id (a slug: "extrañar" → "extranar"). */
export const wordIdByVerb = new Map(words.flatMap((w) => (w.verbId ? [[w.verbId, w.id] as const] : [])))

// The English overlay, by id (see types.ts). Only src/lib/localized.ts reads it.
const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((item) => [item.id, item]))
// Spain adds English for its own words and drops the English notes that talk about Mexico (the overlay removed the Slovak ones).
const esNewEnWords = variant === 'es' ? collect<WordEn>(import.meta.glob('./es/new/en/words.json', { eager: true, import: 'default' })) : []
const esNewEnVerbs = variant === 'es' ? collect<VerbEn>(import.meta.glob('./es/new/en/verbs.json', { eager: true, import: 'default' })) : []
const esWordById = new Map(esWords.map((o) => [o.id, o]))
const dropMexicanNotes = (items: WordEn[]) =>
  variant === 'es'
    ? items.map((w) => {
        const o = esWordById.get(w.id)
        if (o?.noteEn) return { ...w, note: o.noteEn }
        return o?.note === null || (o?.note && !o.noteEn) ? { ...w, note: undefined } : w
      })
    : items
const esSentenceEn = new Map(esSentences.flatMap((o) => (o.en ? [[o.id, o.en] as const] : [])))
export const english = {
  words: byId([...dropMexicanNotes(collect<WordEn>(import.meta.glob('./en/words/*.json', { eager: true, import: 'default' }))), ...esNewEnWords]),
  verbs: byId([...collect<VerbEn>(import.meta.glob('./en/verbs/*.json', { eager: true, import: 'default' })), ...esNewEnVerbs]),
  sentences: byId([
    ...collect<SentenceEn>(import.meta.glob('./en/sentences/*.json', { eager: true, import: 'default' })).map((s) => {
      const en = esSentenceEn.get(s.id)
      return en ? { ...s, en } : s
    }),
    ...(variant === 'es' ? collect<SentenceEn>(import.meta.glob('./es/new/en/sentences.json', { eager: true, import: 'default' })) : []),
  ]),
  topics: byId(enTopicsJson as TopicEn[]),
  tips: byId(variant === 'es' ? applyTipsEn(enTipsJson as TipEn[], esTips) : (enTipsJson as TipEn[])),
}
