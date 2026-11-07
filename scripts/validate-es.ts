// Validates the es-ES overlay (src/data/es/) against the Mexican base. Run with `npm run validate:es`.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { applySentences, applyTips, applyTipsEn, applyWords, mergeById, SPAIN_VERB_PAIRS, type SentenceEs, type TipEs, type WordEs } from '../src/data/applyVariant.ts'
import type { Sentence, Tip, TipEn, Word } from '../src/data/types.ts'

const DATA = new URL('../src/data/', import.meta.url)
const load = <T>(dir: string): T[] =>
  readdirSync(new URL(`${dir}/`, DATA)).filter((f) => f.endsWith('.json')).sort()
    .flatMap((f) => JSON.parse(readFileSync(new URL(`${dir}/${f}`, DATA), 'utf8')) as T[])

const words = load<Word>('words')
const sentences = load<Sentence>('sentences')
const loadIf = <T>(dir: string): T[] => (existsSync(new URL(`${dir}/`, DATA)) ? load<T>(dir) : [])
// The generated overlay and the hand-written one (src/data/es/hand/, never regenerated), merged as the app does.
const handWords = loadIf<WordEs>('es/hand/words')
const handSentences = loadIf<SentenceEs>('es/hand/sentences')
const esWords = mergeById(load<WordEs>('es/words'), handWords)
const esSentences = mergeById(load<SentenceEs>('es/sentences'), handSentences)
const readJson = <T>(file: string): T => JSON.parse(readFileSync(new URL(file, DATA), 'utf8')) as T
const tips = readJson<Tip[]>('tips.json')
const enTips = readJson<TipEn[]>('en/tips.json')
const esTips = readJson<TipEs[]>('es/tips.json')
const esNewWords = load<Word>('es/new/words')
const esNewSentences = load<Sentence>('es/new/sentences')
const esNewEn = (name: string): { id: string }[] =>
  readdirSync(new URL('es/new/en/', DATA))
    .filter((f) => f === `${name}.json` || (f.startsWith(`${name}-`) && f.endsWith('.json')))
    .flatMap((f) => JSON.parse(readFileSync(new URL(`es/new/en/${f}`, DATA), 'utf8')) as { id: string }[])
const errors: string[] = []
const fail = (where: string, msg: string) => errors.push(`${where}: ${msg}`)

// Mexican-only everyday words that must not survive in the Spain text of an overlay entry.
const MEXICAN = new Set(['carro', 'carros', 'computadora', 'computadoras', 'celular', 'celulares', 'jugo', 'papa', 'papas', 'boleto', 'boletos', 'lentes', 'departamento', 'chamarra', 'playera', 'alberca', 'banqueta', 'regadera', 'cobija', 'plomero', 'mesero', 'jitomate', 'gripa', 'curita', 'pluma', 'foco', 'recámara', 'cierre', 'ahorita', 'camión',
  // Everyday Mexican words and slang Spain does not say (found in sentences outside the first overlay).
  'pesos', 'tianguis', 'zócalo', 'chamba', 'chambear', 'chambea', 'chido', 'padrísimo', 'órale', 'ándale', 'güey', 'neta', 'refri', 'popote', 'papás',
  'bloqueador', 'aventón', 'cajuela', 'llanta', 'llantas', 'prepa', 'pizarrón', 'plática', 'platicar', 'platicamos', 'platiqué', 'renta', 'rentar', 'rentamos',
  'elote', 'elotes', 'ejotes', 'chícharos', 'betabel', 'durazno', 'duraznos', 'cacahuates', 'camote', 'frijoles', 'abuelita', 'chinita', 'apapacho', 'achicopalado',
  'mezclilla', 'tinaco', 'fraccionamiento', 'mayoreo', 'enganche', 'licuado', 'botana', 'manejar', 'manejo', 'maneja', 'estacionar', 'enojado', 'enojada', 'enojó'])
const check = (where: string, text: string) => {
  for (const w of text.toLowerCase().split(/[^\p{L}]+/u)) if (MEXICAN.has(w)) fail(where, `Mexican word "${w}" left in Spain text`)
}

for (const [dir, items, base] of [['words', load<WordEs>('es/words'), words], ['sentences', load<SentenceEs>('es/sentences'), sentences], ['hand/words', handWords, words], ['hand/sentences', handSentences, sentences]] as const) {
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

for (const s of applySentences(sentences, esSentences).filter((s) => esSentences.some((o) => o.id === s.id))) {
  const where = `es/sentences[${s.id}]`
  const rebuilt = s.tokens.join(' ').replace(/ ([.,?!;:])/g, '$1').replace(/([¿¡]) /g, '$1')
  if (rebuilt !== s.es) fail(where, `tokens rebuild "${rebuilt}", not "${s.es}"`)
  check(where, s.es)
  for (const c of s.cloze ?? []) {
    if (s.tokens[c.tokenIndex] !== c.answer) fail(where, `cloze ${c.tokenIndex}: token "${s.tokens[c.tokenIndex]}" is not the answer "${c.answer}"`)
    for (const d of c.distractors ?? []) if (d === c.answer) fail(where, `cloze ${c.tokenIndex}: distractor equals the answer`)
  }
}

// A new meaning or note needs its English too (the base English says the Mexican one).
for (const w of esWords) if (typeof w.note === 'string' && !w.noteEn?.trim()) fail(`es/words[${w.id}]`, 'a Spain note needs noteEn')
// An example whose Slovak changed means something new: its English must change too.
const enWordExamples = new Map(load<{ id: string; examples?: string[] }>('en/words').map((e) => [e.id, e.examples]))
for (const o of esWords) {
  const base = words.find((w) => w.id === o.id)
  o.examples?.forEach((ex, i) => {
    if (base && enWordExamples.get(o.id)?.[i] && ex.sk !== base.examples[i]?.sk && !o.examplesEn?.[i]) fail(`es/words[${o.id}]`, `example ${i} means something new: needs examplesEn[${i}]`)
  })
}
for (const o of esSentences) {
  if (o.sk !== undefined && !o.sk.trim()) fail(`es/sentences[${o.id}]`, 'empty sk')
  if (o.sk !== undefined && !o.en?.trim()) fail(`es/sentences[${o.id}]`, 'a new Slovak meaning needs its English (en)')
}

// A blank whose Slovak hint Spain changed needs the English for it too, if the base blank had an English hint.
const enSentenceHints = new Map(load<{ id: string; hints?: (string | null)[] }>('en/sentences').map((e) => [e.id, e.hints]))
for (const o of esSentences) {
  const base = sentences.find((s) => s.id === o.id)
  for (const p of o.cloze ?? []) {
    const i = base?.cloze?.findIndex((c) => c.tokenIndex === p.tokenIndex) ?? -1
    const before = base?.cloze?.[i]?.hint
    if (i < 0 || !p.hint || p.hint === before || p.hint.includes(' · ')) continue
    if (enSentenceHints.get(o.id)?.[i] && !o.enHints?.[i]) fail(`es/sentences[${o.id}]`, `blank ${i}: new hint "${p.hint}" needs enHints[${i}]`)
  }
}

// Spain's own sentences: ids from s9001 (the base grows from s001 and must never meet them), English for each, and
// none of the Mexican words. The rest (tokens, blanks, hints) is checked by validate-data --es with the others.
const baseSentenceIds = new Set(sentences.map((s) => s.id))
const newEnSentences = new Set(esNewEn('sentences').map((e) => e.id))
for (const s of esNewSentences) {
  const where = `es/new/sentences[${s.id}]`
  if (!/^s9\d{3}$/.test(s.id)) fail(where, 'Spain-only sentence ids are s9001…s9999')
  if (baseSentenceIds.has(s.id)) fail(where, 'id taken by a base sentence')
  if (!newEnSentences.has(s.id)) fail(where, 'needs its English in es/new/en/sentences.json')
  check(where, s.es)
}
const newEnWords = new Set(esNewEn('words').map((e) => e.id))
for (const w of esNewWords) {
  if (!newEnWords.has(w.id)) fail(`es/new/words[${w.id}]`, 'needs its English in es/new/en/words.json')
  check(`es/new/words[${w.id}]`, [w.es, w.plural ?? '', ...w.examples.map((e) => e.es)].join(' '))
}
// Every sentence as Spain gets it, overlay or not: a Mexican word left in the base text is a miss of the overlay.
for (const s of applySentences(sentences, esSentences)) check(`sentences[${s.id}] (es)`, s.es)

// ---------- tips: es/tips.json over tips.json and en/tips.json ----------
const tipById = new Map(tips.map((t) => [t.id, t]))
const enTipById = new Map(enTips.map((t) => [t.id, t]))
const seenTips = new Set<string>()
for (const o of esTips) {
  const where = `es/tips[${o.id}]`
  const tip = tipById.get(o.id)
  if (!tip) { fail(where, 'id not in tips.json'); continue }
  if (seenTips.has(o.id)) fail(where, 'duplicate id')
  seenTips.add(o.id)
  if (o.intro !== undefined && !o.intro.trim()) fail(where, 'empty intro')
  const en = enTipById.get(o.id)
  for (const r of o.rules ?? []) {
    const rw = `${where}.${r.id}`
    const rule = tip.rules.find((b) => b.id === r.id)
    if (!rule) { fail(rw, 'no such rule in the tip'); continue }
    if (r.text !== undefined && !r.text.trim()) fail(rw, 'empty text')
    if (r.examples === undefined) continue
    if (r.examples.length !== rule.examples.length) fail(rw, `examples: one entry per base example (${rule.examples.length}), null keeps it`)
    r.examples.forEach((ex, i) => {
      if (ex === null) return
      if (!ex.es?.trim() || !ex.sk?.trim()) fail(rw, `example ${i} needs es and sk`)
      // A new meaning needs a new English translation too (the base one would be wrong).
      const enRule = o.en?.rules?.find((x) => x.id === r.id)
      if (en && ex.sk !== rule.examples[i]?.sk && !enRule?.examples?.[i]) fail(rw, `example ${i} means something new: en.rules needs its translation`)
    })
  }
  if (o.en && !en) fail(where, 'en, but the tip has no English version')
  for (const r of o.en?.rules ?? []) {
    const enRule = en?.rules.find((b) => b.id === r.id)
    if (!enRule) { fail(`${where}.en.${r.id}`, 'no such rule in the English tip'); continue }
    if (r.examples && r.examples.length !== enRule.examples.length) fail(`${where}.en.${r.id}`, `examples: one entry per base example (${enRule.examples.length})`)
  }
}

// Every tip as Spain gets it: no Mexican word in its Spanish, and no text that speaks of Mexico (that is the note's job).
const TIP_MEXICAN = new Set([...MEXICAN, 'papás', 'aretes', 'refri', 'chava', 'chavo', 'oxxo', 'pesos', 'mesera', 'meseros', 'renta', 'rentan', 'rentar', 'platicar', 'platiqué', 'manejar', 'reporte', 'junta', 'acá'])
const checkTipText = (where: string, text: string | undefined, isSpanish = false) => {
  if (!text) return
  for (const w of text.toLowerCase().split(/[^\p{L}]+/u)) {
    // papa is the Pope in Spain (the accent rule's example): only the potatoes are Mexican.
    if (TIP_MEXICAN.has(w) && w !== 'papa') fail(where, `Mexican word "${w}" in Spain's tip`)
  }
  if (!isSpanish && /mexik|mexic|méxic/i.test(text)) fail(where, 'speaks of Mexico: say it for Spain (the variant note is shown apart)')
}
for (const tip of applyTips(tips, esTips)) {
  const where = `tips[${tip.id}] (es)`
  checkTipText(where, tip.intro)
  for (const r of tip.rules) {
    checkTipText(`${where}.${r.id}`, r.text)
    checkTipText(`${where}.${r.id}`, r.because)
    for (const ex of r.examples) checkTipText(`${where}.${r.id}`, ex.es, true)
  }
}
for (const tip of applyTipsEn(enTips, esTips)) {
  const where = `en/tips[${tip.id}] (es)`
  checkTipText(where, tip.intro)
  for (const r of tip.rules) {
    checkTipText(`${where}.${r.id}`, r.text)
    checkTipText(`${where}.${r.id}`, r.because)
  }
}

// The verb pairs the search uses (conducir ↔ manejar): both words exist, and Spain hides the Mexican one.
for (const [spain, mexico] of Object.entries(SPAIN_VERB_PAIRS)) {
  if (!esNewWords.some((w) => w.id === spain)) fail(`SPAIN_VERB_PAIRS[${spain}]`, 'not a word in es/new/words')
  if (!words.some((w) => w.id === mexico)) fail(`SPAIN_VERB_PAIRS[${spain}]`, `"${mexico}" is not a base word`)
  if (!esWords.some((o) => o.id === mexico && o.hidden)) fail(`SPAIN_VERB_PAIRS[${spain}]`, `"${mexico}" is not hidden in Spain`)
}

if (errors.length) {
  console.error(errors.join('\n'))
  console.error(`\n${errors.length} problem(s) in the es overlay`)
  process.exit(1)
}
console.log(`es overlay OK: ${esWords.length} words, ${esSentences.length} sentences, ${esTips.length} tips; Spain's own: ${esNewWords.length} words, ${esNewSentences.length} sentences`)
