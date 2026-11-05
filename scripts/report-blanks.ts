// Reports how many B1/B2 sentences blank the grammar point they are tagged with. Run with `node scripts/report-blanks.ts`.
// Add `--list` to print the sentences whose blanks miss their B1+ point.
import { readdirSync, readFileSync } from 'node:fs'
import type { Sentence, Tip } from '../src/data/types.ts'

const DATA = new URL('../src/data/', import.meta.url)
const read = (path: string) => JSON.parse(readFileSync(new URL(path, DATA), 'utf8')) as unknown
const sentences = readdirSync(new URL('sentences/', DATA))
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => read(`sentences/${f}`) as Sentence[])
const tips = read('tips.json') as Tip[]

// B1+ points a sentence can be tagged with, and the tense words of a verb hint that practise them.
const ADVANCED = new Set(tips.filter((t) => t.level === 'B1' || t.level === 'B2').map((t) => t.id))
const HINT_TENSE: Record<string, string[]> = {
  subjuntivo: ['subjuntivo', 'subjuntivo-wishes', 'subjuntivo-clauses'],
  'subjuntivo imperfecto': ['subj-imperfecto', 'si-clauses'],
  condicional: ['condicional', 'si-clauses'],
  pluscuamperfecto: ['pluscuamperfecto'],
  participio: ['pluscuamperfecto'],
}

const testsPoint = (s: Sentence, point: string) =>
  (s.cloze ?? []).some((c) => c.tip === point || (HINT_TENSE[(c.hint ?? '').split(' · ').pop() ?? ''] ?? []).includes(point))

const rows: Record<string, { all: number; tagged: number; hit: number }> = {}
const misses: Sentence[] = []
for (const s of sentences) {
  if (s.level !== 'B1' && s.level !== 'B2') continue
  const row = (rows[s.level] ??= { all: 0, tagged: 0, hit: 0 })
  row.all++
  const points = (s.grammar ?? []).filter((g) => ADVANCED.has(g))
  if (points.length === 0) continue
  row.tagged++
  if (points.some((p) => testsPoint(s, p))) row.hit++
  else misses.push(s)
}

for (const [level, { all, tagged, hit }] of Object.entries(rows).sort()) {
  console.log(`${level}: ${all} sentences, ${tagged} tagged with a B1+ point, ${hit} blank it (${Math.round((hit / tagged) * 100)} %), ${tagged - hit} miss it`)
}
if (process.argv.includes('--list')) for (const s of misses) console.log(`${s.id} [${s.level}] ${s.grammar?.join(',')} | ${s.es} | blanks: ${(s.cloze ?? []).map((c) => c.answer).join(', ') || '-'}`)

// B1/B2 sentences with no B1+ point at all whose every blank is a plain A1 tense: the review's "blanks tengo" case.
const PLAIN = new Set(['presente', 'pretérito', 'imperfecto', 'futuro', 'gerundio'])
const plain: Sentence[] = []
for (const s of sentences) {
  if (s.level !== 'B1' && s.level !== 'B2') continue
  if ((s.grammar ?? []).some((g) => ADVANCED.has(g))) continue
  const blanks = s.cloze ?? []
  if (blanks.length > 0 && blanks.every((c) => c.tip === undefined && PLAIN.has((c.hint ?? '').split(' · ').pop() ?? ''))) plain.push(s)
}
for (const level of ['B1', 'B2']) {
  const of = sentences.filter((s) => s.level === level)
  console.log(`${level}: ${plain.filter((s) => s.level === level).length} of ${of.length} sentences have only plain A1-tense blanks and no B1+ point`)
}
if (process.argv.includes('--plain')) for (const s of plain) console.log(`${s.id} [${s.level}] ${s.es} | ${(s.cloze ?? []).map((c) => c.hint).join('; ')}`)
