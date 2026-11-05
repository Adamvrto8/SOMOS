// Validates the es-ES overlay (src/data/es/) against the Mexican base. Run with `npm run validate:es`.
import { readdirSync, readFileSync } from 'node:fs'
import { applySentences, applyWords, type SentenceEs, type WordEs } from '../src/data/applyVariant.ts'
import type { Sentence, Word } from '../src/data/types.ts'

const DATA = new URL('../src/data/', import.meta.url)
const load = <T>(dir: string): T[] =>
  readdirSync(new URL(`${dir}/`, DATA)).filter((f) => f.endsWith('.json')).sort()
    .flatMap((f) => JSON.parse(readFileSync(new URL(`${dir}/${f}`, DATA), 'utf8')) as T[])

const words = load<Word>('words')
const sentences = load<Sentence>('sentences')
const esWords = load<WordEs>('es/words')
const esSentences = load<SentenceEs>('es/sentences')
const errors: string[] = []
const fail = (where: string, msg: string) => errors.push(`${where}: ${msg}`)

// Mexican-only everyday words that must not survive in the Spain text of an overlay entry.
const MEXICAN = new Set(['carro', 'carros', 'computadora', 'computadoras', 'celular', 'celulares', 'jugo', 'papa', 'papas', 'boleto', 'boletos', 'lentes', 'departamento', 'chamarra', 'playera', 'alberca', 'banqueta', 'regadera', 'cobija', 'plomero', 'mesero', 'jitomate', 'gripa', 'curita', 'pluma', 'foco', 'recámara', 'cierre', 'ahorita', 'camión'])
const check = (where: string, text: string) => {
  for (const w of text.toLowerCase().split(/[^\p{L}]+/u)) if (MEXICAN.has(w)) fail(where, `Mexican word "${w}" left in Spain text`)
}

for (const [dir, items, base] of [['words', esWords, words], ['sentences', esSentences, sentences]] as const) {
  const ids = new Set(base.map((b) => b.id))
  const seen = new Set<string>()
  for (const item of items) {
    if (!ids.has(item.id)) fail(`es/${dir}[${item.id}]`, 'id not in the Mexican base')
    if (seen.has(item.id)) fail(`es/${dir}[${item.id}]`, 'duplicate id')
    seen.add(item.id)
  }
}

for (const w of applyWords(words, esWords).filter((w) => esWords.some((o) => o.id === w.id))) {
  check(`es/words[${w.id}]`, [w.es, w.plural ?? '', ...w.examples.map((e) => e.es)].join(' '))
}

const baseSentence = new Map(sentences.map((s) => [s.id, s]))
for (const s of applySentences(sentences, esSentences).filter((s) => esSentences.some((o) => o.id === s.id))) {
  const where = `es/sentences[${s.id}]`
  const rebuilt = s.tokens.join(' ').replace(/ ([.,?!;:])/g, '$1').replace(/([¿¡]) /g, '$1')
  if (rebuilt !== s.es) fail(where, `tokens rebuild "${rebuilt}", not "${s.es}"`)
  if (s.tokens.length !== baseSentence.get(s.id)!.tokens.length) fail(where, 'token count differs from the base (indices would move)')
  check(where, s.es)
  for (const c of s.cloze ?? []) {
    if (s.tokens[c.tokenIndex] !== c.answer) fail(where, `cloze ${c.tokenIndex}: token "${s.tokens[c.tokenIndex]}" is not the answer "${c.answer}"`)
    for (const d of c.distractors ?? []) if (d === c.answer) fail(where, `cloze ${c.tokenIndex}: distractor equals the answer`)
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  console.error(`\n${errors.length} problem(s) in the es overlay`)
  process.exit(1)
}
console.log(`es overlay OK: ${esWords.length} words, ${esSentences.length} sentences`)
