// Prints a topic's sentences as Spain gets them today (generated overlay + hand overlay over the Mexican base), one per
// line, for hand work on src/data/es/hand/sentences/<topic>.json. Usage: node scripts/spain-view.mjs <topic> [--all]
// Without --all only the sentences that already have an overlay entry are marked; every sentence is printed.
import fs from 'fs'

const topic = process.argv[2]
if (!topic) throw new Error('usage: node scripts/spain-view.mjs <topic>')
const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [])
const base = read(`src/data/sentences/${topic}.json`)
const gen = Object.fromEntries(read(`src/data/es/sentences/${topic}.json`).map((s) => [s.id, s]))
const hand = Object.fromEntries(read(`src/data/es/hand/sentences/${topic}.json`).map((s) => [s.id, s]))
const en = Object.fromEntries(read(`src/data/en/sentences/${topic}.json`).map((s) => [s.id, s]))
for (const s of base) {
  const o = { ...gen[s.id], ...hand[s.id] }
  const es = o.es ?? s.es
  const tokens = o.tokens ?? s.tokens
  const cloze = (s.cloze ?? []).map((c) => {
    const p = o.cloze?.find((x) => x.tokenIndex === c.tokenIndex)
    const m = { ...c, ...p, tokenIndex: c.tokenIndex, at: p?.newIndex ?? c.tokenIndex }
    return `[${c.tokenIndex}${m.at !== c.tokenIndex ? `→${m.at}` : ''}] ${m.answer} (${m.lemma}; ${m.hint ?? ''}) x ${(m.distractors ?? []).join('/')}`
  })
  const mark = hand[s.id] ? 'HAND' : gen[s.id] ? 'GEN' : '-'
  console.log(`${s.id} ${s.level} ${mark} | ${es} | ${o.sk ?? s.sk} | ${o.en ?? en[s.id]?.en ?? ''} | tokens=${JSON.stringify(tokens)} | ${cloze.join(' ; ')}`)
}
