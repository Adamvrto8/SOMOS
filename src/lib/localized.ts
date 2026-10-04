import { english } from '../data'
import type { Cloze, Sentence, Tip, Topic, Verb, Word } from '../data/types'
import { getLanguage } from './language'

// The teaching content in the learner's language. The only place that knows there are two:
// Slovak is the base data, English the overlay in src/data/en, and whatever English does not
// have yet is shown in Slovak. Called while rendering, so a screen follows the language.

const isEnglish = () => getLanguage() === 'en'

/** An example sentence with its translation. */
export interface LocalExample {
  es: string
  text: string
}

export function wordTranslations(word: Word): string[] {
  if (!isEnglish()) return word.sk
  // A verb's dictionary entry means what the verb means: one translation serves both.
  return english.words.get(word.id)?.en ?? (word.verbId ? english.verbs.get(word.verbId)?.en : undefined) ?? word.sk
}

export function wordExamples(word: Word): LocalExample[] {
  const translated = isEnglish() ? english.words.get(word.id)?.examples : undefined
  return word.examples.map((example, i) => ({ es: example.es, text: translated?.[i] ?? example.sk }))
}

/** A translated word's note is the English one, or none: Slovak notes explain things a Slovak trips over. */
export function wordNote(word: Word): string | undefined {
  const entry = isEnglish() ? english.words.get(word.id) : undefined
  return entry ? entry.note : word.note
}

export function verbTranslations(verb: Verb): string[] {
  return (isEnglish() && english.verbs.get(verb.id)?.en) || verb.sk
}

export function sentenceTranslation(sentence: Sentence): string {
  return (isEnglish() && english.sentences.get(sentence.id)?.en) || sentence.sk
}

/** The hint to show for a blank. tipFor() keeps reading the base hint, which decides the grammar tip. */
export function clozeHint(sentence: Sentence, cloze: Cloze): string | undefined {
  const hints = isEnglish() ? english.sentences.get(sentence.id)?.hints : undefined
  return hints?.[sentence.cloze?.indexOf(cloze) ?? -1] ?? cloze.hint
}

export function topicName(topic: Topic): string {
  return (isEnglish() && english.topics.get(topic.id)?.en) || topic.sk
}

/** A rule of a tip as it is shown. */
export interface LocalRule {
  id: string
  title: string
  text?: string
  because?: string // ser-estar only: the reason said for one sentence
  verb?: 'ser' | 'estar'
  examples: LocalExample[]
}

export interface LocalTip {
  id: string
  title: string
  intro: string
  related?: string[]
  rules: LocalRule[]
}

/** The tip in the learner's language. All or nothing: a tip without an English version is Slovak. */
export function localizedTip(tip: Tip): LocalTip {
  const entry = isEnglish() ? english.tips.get(tip.id) : undefined
  const rules = tip.rules.map((rule): LocalRule => {
    const translated = entry?.rules.find((r) => r.id === rule.id)
    return {
      id: rule.id,
      verb: rule.verb,
      title: translated?.title ?? rule.title,
      text: translated ? translated.text : rule.text,
      because: translated ? translated.because : rule.because,
      examples: rule.examples.map((example, i) => ({ es: example.es, text: translated?.examples[i] ?? example.sk })),
    }
  })
  return { id: tip.id, title: entry?.title ?? tip.title, intro: entry?.intro ?? tip.intro, related: tip.related, rules }
}
