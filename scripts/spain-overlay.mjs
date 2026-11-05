// Turns docs/spain-draft (from spain-diff.mjs) into the real overlay files in src/data/es/.
// Only entries WITHOUT a `manual` note are written: those are safe token-for-token swaps.
// Verb words are left out (their conjugations differ): they stay in docs/spain-draft/todo.json for hand work.
import fs from 'fs'

const base = (d) => Object.fromEntries(fs.readdirSync(`src/data/${d}`).flatMap((f) => JSON.parse(fs.readFileSync(`src/data/${d}/${f}`, 'utf8')).map((x) => [x.id, { ...x, _file: f }])))
const baseWords = base('words')
const baseSents = base('sentences')
const draftWords = JSON.parse(fs.readFileSync('docs/spain-draft/words.json', 'utf8'))
const draftSents = JSON.parse(fs.readFileSync('docs/spain-draft/sentences.json', 'utf8'))

const byFile = {}
const todo = { words: [], sentences: [] }
const put = (kind, file, entry) => ((byFile[kind] ??= {})[file] ??= []).push(entry)

for (const w of draftWords) {
  if (w.action === 'hide-in-es' || w.action === 'note-only') { todo[w.action === 'hide-in-es' ? 'words' : 'words'].push({ id: w.id, action: w.action, es: w.es_mx, note: w.note_mx }); continue }
  if (w.manual || baseWords[w.id].pos === 'verb') { todo.words.push({ id: w.id, action: w.action, es_mx: w.es_mx, proposal: w.es_es, manual: w.manual ?? ['verb: conjugations differ'] }); continue }
  const entry = { id: w.id }
  if (w.action === 'replace') {
    entry.es = w.es_es
    if (w.plural_es && w.plural_es !== w.plural_mx) entry.plural = w.plural_es
    if (w.note_mx) entry.note = null // the Mexican note says "in Spain X": wrong here, to be rewritten by hand
  }
  if (w.examples) entry.examples = w.examples.map((e) => ({ es: e.es_es, sk: e.sk }))
  else if (w.action === 'replace') entry.examples = baseWords[w.id].examples.map((e) => e)
  put('words', w._file ?? baseWords[w.id]._file, entry)
}

for (const s of draftSents) {
  if (s.manual || !s.tokens_es) { todo.sentences.push({ id: s.id, es_mx: s.es_mx, proposal: s.es_es, manual: s.manual }); continue }
  const entry = { id: s.id, es: s.es_es, tokens: s.tokens_es }
  const cloze = (s.cloze ?? []).filter((c) => c.changed || c.distractors_es.some((d, i) => d !== (baseSents[s.id].cloze.find((b) => b.tokenIndex === c.tokenIndex).distractors ?? [])[i]))
  if (cloze.length) entry.cloze = cloze.map((c) => ({ tokenIndex: c.tokenIndex, answer: c.answer_es, ...(c.distractors_es.length ? { distractors: c.distractors_es } : {}) }))
  put('sentences', s.file, entry)
}

fs.rmSync('src/data/es', { recursive: true, force: true })
for (const [kind, files] of Object.entries(byFile)) {
  fs.mkdirSync(`src/data/es/${kind}`, { recursive: true })
  for (const [file, entries] of Object.entries(files)) fs.writeFileSync(`src/data/es/${kind}/${file}`, JSON.stringify(entries, null, 2) + '\n')
}
fs.writeFileSync('docs/spain-draft/todo.json', JSON.stringify(todo, null, 2) + '\n')
const n = (k) => Object.values(byFile[k] ?? {}).reduce((a, e) => a + e.length, 0)
console.log({ overlayWords: n('words'), overlaySentences: n('sentences'), todoWords: todo.words.length, todoSentences: todo.sentences.length })
