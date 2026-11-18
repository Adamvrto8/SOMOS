import type { SpanishVariant } from '../../data/types'
import { NOT_VOSOTROS, SPAIN_ONLY, VOSOTROS_ENDING } from '../spainOnly'
import { cardOf, MARKER } from './answerText'

// Checks of a finished answer in code, before it is shown (docs/chat-assistant-improvements.md S2). What they find goes
// back to the model once as a note (chat.ts); the rules stay out of the prompt. A link to a page that does not exist is
// not sent back: the screen shows its label as plain text (answerText.ts).

/** "os" is a Slovak word too (os = axis): only the unambiguous vosotros words count here. */
const VOSOTROS_WORDS = new Set(['vosotros', 'vosotras', 'sois', 'vais'])

const wordsOf = (text: string) => text.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean)

/**
 * Notes for the model on what is wrong with its answer, in Slovak; empty when nothing is. The learner's own question
 * counts: asked about "zumo", the answer may name it, and naming the Mexican word beside it is an explanation.
 */
export function checkAnswer(answer: string, question: string, variant: SpanishVariant): string[] {
  const notes: string[] = []

  const broken = [...answer.matchAll(MARKER)].map((m) => m[0]).filter((marker) => !cardOf(marker.slice(2, -2).trim()))
  if (broken.length) {
    notes.push(
      `Karty ${broken.join(', ')} appka nemá, nezobrazia sa. Použi len karty presne z výsledku nástroja ({{word:id}}, {{conj:sloveso:čas}}, {{tip:id}}), alebo kartu vynechaj.`,
    )
  }

  if (variant === 'mx') {
    const asked = new Set(wordsOf(question))
    const said = wordsOf(answer)
    const saidSet = new Set(said)
    const spain = [...new Set(said)].filter((word) => {
      const mexican = SPAIN_ONLY.get(word)
      return mexican !== undefined && !asked.has(word) && !mexican.split(' / ').some((m) => saidSet.has(m))
    })
    if (spain.length) {
      notes.push(`Učiaci sa učí mexickú španielčinu, ale v odpovedi je ${spain.map((w) => `"${w}" (v Mexiku "${SPAIN_ONLY.get(w)}")`).join(', ')}.`)
    }
    const askedVosotros = [...asked].some((word) => VOSOTROS_WORDS.has(word))
    const vosotros = [...new Set(said)].filter((word) => VOSOTROS_WORDS.has(word) || (VOSOTROS_ENDING.test(word) && !NOT_VOSOTROS.has(word)))
    if (vosotros.length && !askedVosotros && !saidSet.has('ustedes')) {
      notes.push(`V mexickej španielčine sa vosotros nepoužíva, v odpovedi je ${vosotros.map((w) => `"${w}"`).join(', ')}; použi ustedes.`)
    }
  }
  return notes
}
