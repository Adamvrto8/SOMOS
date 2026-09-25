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
