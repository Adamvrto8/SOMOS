import type { SpanishVariant } from '../../data/types'
import { NOT_VOSOTROS, SPAIN_ONLY, VOSOTROS_ENDING } from '../spainOnly'
import { cardOf, followUpOf, MARKER, PLACEHOLDER_PATH } from './answerText'

// Checks of a finished answer in code, before it is shown (docs/chat-assistant-improvements.md S2). What they find goes
// back to the model once as a note (chat.ts); the rules stay out of the prompt. A link to a page that does not exist is
// not sent back: the screen shows its label as plain text (answerText.ts).

/** "os" is a Slovak word too (os = axis): only the unambiguous vosotros words count here. */
const VOSOTROS_WORDS = new Set(['vosotros', 'vosotras', 'sois', 'vais'])

/** An example line "- Spanish – translation": the translation. */
const EXAMPLE_LINE = /^\s*[-•*]\s+.+?\s+[–—]\s+(.+)$/
/** A note in brackets about where a sentence comes from ("mimo appky", "vzor", "not in the app"); "(ser)" is fine. */
const SOURCE_NOTE = /\([^)]*\b(appk\p{L}*|app|vzor\p{L}*)\b[^)]*\)/iu

const wordsOf = (text: string) => text.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean)

/**
 * Notes for the model on what is wrong with its answer, in Slovak; empty when nothing is. The learner's own question
 * counts: asked about "zumo", the answer may name it, and naming the Mexican word beside it is an explanation.
 */
export function checkAnswer(answer: string, question: string, variant: SpanishVariant): string[] {
  const notes: string[] = []

  // Follow-up questions ({{dalej:…}}) are markers too, but no card.
  const broken = [...answer.matchAll(MARKER)].filter(([, inside]) => !cardOf(inside) && !followUpOf(inside)).map(([marker]) => marker)
  if (broken.length) {
    notes.push(
      `Karty ${broken.join(', ')} appka nemá, nezobrazia sa. Použi len karty presne z výsledku nástroja ({{word:id}}, {{conj:sloveso:čas}}, {{tip:id}}), alebo kartu vynechaj.`,
    )
  }

  const placeholders = [...answer.matchAll(PLACEHOLDER_PATH)].map(([path]) => path.trim())
  if (placeholders.length) {
    notes.push(
      `Adresa ${placeholders.join(', ')} má zástupný znak z mapy a nikam nevedie. Nahraď ho skutočnou hodnotou z nástroja a vlož odkaz do vety ([text](/cesta)), alebo adresu vynechaj.`,
    )
  }

  // Run 5: "Estoy en casa. – Som doma. (vzor na estar, mimo appky)", a sentence of the very tip it had fetched.
  const tagged = answer
    .split('\n')
    .map((line) => EXAMPLE_LINE.exec(line)?.[1])
    .filter((translation): translation is string => translation !== undefined && SOURCE_NOTE.test(translation))
  if (tagged.length) {
    notes.push(
      `V preklade príkladu je poznámka o pôvode vety (${tagged.join('; ')}). Príklad je len veta a jej preklad: poznámku vynechaj. Vety z výsledku nástroja sú z appky.`,
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
