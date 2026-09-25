import sentencesJson from './sentences.json'
import topicsJson from './topics.json'
import verbsJson from './verbs.json'
import wordsJson from './words.json'
import type { Sentence, Topic, Verb, Word } from './types'

// JSON imports are typed loosely (string instead of literal unions);
// shape and content are enforced by `npm run validate:data`.
export const topics = topicsJson as Topic[]
export const words = wordsJson as Word[]
export const verbs = verbsJson as Verb[]
export const sentences = sentencesJson as Sentence[]

export const wordById = new Map(words.map((w) => [w.id, w]))
export const verbById = new Map(verbs.map((v) => [v.id, v]))
export const topicById = new Map(topics.map((t) => [t.id, t]))
export const sentenceById = new Map(sentences.map((s) => [s.id, s]))
