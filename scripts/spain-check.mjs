// Runs both Spain checks (validate-es.ts and validate-data.ts --es) and prints only the problems of the given topics'
// sentences and words. Usage: node scripts/spain-check.mjs <topic> [<topic>…]
import { spawnSync } from 'child_process'
import fs from 'fs'

const topics = process.argv.slice(2)
const ids = new Set()
for (const t of topics) {
  for (const d of ['sentences', 'words', 'es/new/sentences', 'es/new/words']) {
    const f = `src/data/${d}/${t}.json`
    if (fs.existsSync(f)) for (const x of JSON.parse(fs.readFileSync(f, 'utf8'))) ids.add(x.id)
  }
}
let lines = []
for (const args of [['scripts/validate-es.ts'], ['scripts/validate-data.ts', '--es']]) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' })
  lines.push(...`${r.stdout}\n${r.stderr}`.split('\n'))
}
const mine = lines.filter((l) => [...l.matchAll(/\[([^\]]+)\]/g)].some((m) => ids.has(m[1])))
console.log(mine.join('\n') || 'no problems for these topics')
console.log(`${mine.length} problem(s) for ${topics.join(', ')}`)
