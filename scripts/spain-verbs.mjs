// Writes the verbs (and their dictionary words) that Spain says instead of the Mexican ones:
// manejar → conducir, rentar → alquilar, estacionar → aparcar, platicar → charlar, enojarse → enfadarse, prender → encender.
// The B1–B2 forms come from the rules in src/lib/verbForms.ts, the same ones validate-data checks them against.
// Run: node scripts/spain-verbs.mjs   → src/data/es/new/{verbs,words}/verbs.json
import fs from 'fs'
import { deriveCondicional, deriveImperativo, deriveSubjImperfecto, deriveSubjuntivo } from '../src/lib/verbForms.ts'

const P = ['yo', 'tu', 'el', 'nosotros', 'ellos']
const row = (forms) => Object.fromEntries(P.map((p, i) => [p, forms[i]]))

/** Regular endings added to a stem, optionally with a reflexive pronoun. */
const ENDINGS = {
  ar: { presente: ['o', 'as', 'a', 'amos', 'an'], preterito: ['é', 'aste', 'ó', 'amos', 'aron'], imperfecto: ['aba', 'abas', 'aba', 'ábamos', 'aban'], gerund: 'ando', participle: 'ado' },
  er: { presente: ['o', 'es', 'e', 'emos', 'en'], preterito: ['í', 'iste', 'ió', 'imos', 'ieron'], imperfecto: ['ía', 'ías', 'ía', 'íamos', 'ían'], gerund: 'iendo', participle: 'ido' },
  ir: { presente: ['o', 'es', 'e', 'imos', 'en'], preterito: ['í', 'iste', 'ió', 'imos', 'ieron'], imperfecto: ['ía', 'ías', 'ía', 'íamos', 'ían'], gerund: 'iendo', participle: 'ido' },
}
const FUTURE = ['é', 'ás', 'á', 'emos', 'án']
const REFLEXIVE = ['me', 'te', 'se', 'nos', 'se']

function build({ id, sk, group, level, reflexive, over = {}, irregularForms, regular }) {
  const inf = reflexive ? id.slice(0, -2) : id
  const stem = inf.slice(0, -2)
  const e = ENDINGS[group]
  const forms = (stems, endings) => row(endings.map((end, i) => `${reflexive ? REFLEXIVE[i] + ' ' : ''}${Array.isArray(stems) ? stems[i] : stems}${end}`))
  const verb = {
    id, sk, group, regular,
    ...(reflexive ? { reflexive: true } : {}),
    gerund: over.gerund ?? stem + e.gerund,
    presente: forms(over.presenteStem ?? stem, e.presente),
    preterito: forms(over.preteritoStem ?? stem, over.preteritoEndings ?? e.preterito),
    imperfecto: forms(stem, e.imperfecto),
    futuro: forms(inf, FUTURE),
  }
  verb.subjuntivo = deriveSubjuntivo(verb)
  verb.subjImperfecto = deriveSubjImperfecto(verb)
  verb.condicional = deriveCondicional(verb)
  verb.imperativo = deriveImperativo(verb, verb.subjuntivo)
  verb.participle = stem + e.participle
  if (irregularForms) verb.irregularForms = irregularForms
  verb.level = level
  return verb
}

const STEM_CHANGE = ['presente.yo', 'presente.tu', 'presente.el', 'presente.ellos', 'subjuntivo.yo', 'subjuntivo.tu', 'subjuntivo.el', 'subjuntivo.ellos', 'imperativo.tu', 'imperativo.el', 'imperativo.ellos']

const verbs = [
  build({
    id: 'conducir', sk: ['šoférovať', 'riadiť'], group: 'ir', level: 'A1', regular: false,
    over: { presenteStem: ['conduzc', 'conduc', 'conduc', 'conduc', 'conduc'].map((s) => s), preteritoStem: 'conduj', preteritoEndings: ['e', 'iste', 'o', 'imos', 'eron'] },
    irregularForms: ['presente.yo', 'preterito.*', 'subjuntivo.*', 'subjImperfecto.*', 'imperativo.el', 'imperativo.nosotros', 'imperativo.ellos'],
  }),
  build({ id: 'alquilar', sk: ['prenajať (si)'], group: 'ar', level: 'A2', regular: true }),
  build({ id: 'aparcar', sk: ['zaparkovať', 'parkovať'], group: 'ar', level: 'A2', regular: false, over: {}, irregularForms: ['preterito.yo', 'subjuntivo.*', 'imperativo.el', 'imperativo.nosotros', 'imperativo.ellos'] }),
  build({ id: 'charlar', sk: ['rozprávať sa', 'pokecať si'], group: 'ar', level: 'A2', regular: true }),
  build({ id: 'enfadarse', sk: ['nahnevať sa', 'hnevať sa'], group: 'ar', level: 'A2', reflexive: true, regular: true }),
  build({
    id: 'encender', sk: ['zapnúť', 'zapáliť'], group: 'er', level: 'B1', regular: false,
    over: { presenteStem: ['enciend', 'enciend', 'enciend', 'encend', 'enciend'] }, irregularForms: STEM_CHANGE,
  }),
]

// Fix the forms the generic builder gets wrong by construction.
const by = Object.fromEntries(verbs.map((v) => [v.id, v]))
by.aparcar.preterito.yo = 'aparqué'
by.conducir.presente = row(['conduzco', 'conduces', 'conduce', 'conducimos', 'conducen'])
by.conducir.imperfecto = row(['conducía', 'conducías', 'conducía', 'conducíamos', 'conducían'])
by.conducir.futuro = row(['conduciré', 'conducirás', 'conducirá', 'conduciremos', 'conducirán'])
by.conducir.preterito = row(['conduje', 'condujiste', 'condujo', 'condujimos', 'condujeron'])
for (const id of ['conducir', 'aparcar', 'encender']) {
  const v = by[id]
  v.subjuntivo = deriveSubjuntivo(v)
  v.subjImperfecto = deriveSubjImperfecto(v)
  v.condicional = deriveCondicional(v)
  v.imperativo = deriveImperativo(v, v.subjuntivo)
}
by.encender.presente = row(['enciendo', 'enciendes', 'enciende', 'encendemos', 'encienden'])
for (const v of Object.values(by)) {
  // Key order as in the base files.
  const { id, sk, group, regular, reflexive, gerund, presente, preterito, imperfecto, futuro, subjuntivo, subjImperfecto, condicional, imperativo, participle, irregularForms, level } = v
  Object.keys(v).forEach((k) => delete v[k])
  Object.assign(v, { id, sk, group, regular, ...(reflexive ? { reflexive } : {}), gerund, presente, preterito, imperfecto, futuro, subjuntivo, subjImperfecto, condicional, imperativo, participle, ...(irregularForms ? { irregularForms } : {}), level })
}

const WORDS = [
  { id: 'conducir', sk: ['šoférovať', 'riadiť'], level: 'A1', topics: ['travel', 'city'], examples: [{ es: '¿Sabes conducir?', sk: 'Vieš šoférovať?' }] },
  { id: 'alquilar', sk: ['prenajať (si)'], level: 'A2', topics: ['home', 'travel'], examples: [{ es: 'Queremos alquilar un piso cerca de la playa.', sk: 'Chceme si prenajať byt blízko pláže.' }] },
  { id: 'aparcar', sk: ['zaparkovať', 'parkovať'], level: 'A2', topics: ['city'], examples: [{ es: '¿Dónde puedo aparcar el coche?', sk: 'Kde môžem zaparkovať auto?' }] },
  { id: 'charlar', sk: ['rozprávať sa', 'pokecať si'], level: 'A2', topics: ['greetings'], examples: [{ es: 'Me gusta charlar con mi abuela.', sk: 'Rád sa rozprávam s babkou.' }] },
  { id: 'enfadarse', sk: ['nahnevať sa', 'hnevať sa'], level: 'A2', topics: ['emotions'], examples: [{ es: 'Mi jefe se enfadó mucho.', sk: 'Šéf sa veľmi nahneval.' }] },
  { id: 'encender', sk: ['zapnúť', 'zapáliť'], level: 'B1', topics: ['home', 'tech'], examples: [{ es: 'Enciende la luz, por favor.', sk: 'Zapni svetlo, prosím.' }] },
].map((w) => ({ id: w.id, es: w.id, sk: w.sk, pos: 'verb', verbId: w.id, level: w.level, topics: w.topics, examples: w.examples }))

fs.mkdirSync('src/data/es/new/verbs', { recursive: true })
fs.mkdirSync('src/data/es/new/words', { recursive: true })
fs.writeFileSync('src/data/es/new/verbs/verbs.json', JSON.stringify(Object.values(by), null, 2) + '\n')
fs.writeFileSync('src/data/es/new/words/verbs.json', JSON.stringify(WORDS, null, 2) + '\n')
console.log(Object.values(by).map((v) => `${v.id}: ${v.presente.yo} / ${v.preterito.yo} / ${v.subjuntivo.yo} / ${v.subjImperfecto.yo} / ${v.imperativo.tu}`).join('\n'))

// English for the new words and verbs: the translation of the Mexican verb they stand for (the note is dropped, it is about Mexico).
const MEXICAN_FOR = { conducir: 'manejar', alquilar: 'rentar', aparcar: 'estacionar', charlar: 'platicar', enfadarse: 'enojarse', encender: 'prender' }
const enDir = (d) => fs.readdirSync(`src/data/en/${d}`).flatMap((f) => JSON.parse(fs.readFileSync(`src/data/en/${d}/${f}`, 'utf8')))
const enWords = enDir('words')
const enVerbs = enDir('verbs')
const EX = { conducir: ['Do you know how to drive?'], alquilar: ['We want to rent a flat near the beach.'], aparcar: ['Where can I park the car?'], charlar: ['I like chatting with my grandma.'], enfadarse: ['My boss got very angry.'], encender: ['Turn on the light, please.'] }
fs.mkdirSync('src/data/es/new/en', { recursive: true })
fs.writeFileSync('src/data/es/new/en/words.json', JSON.stringify(Object.entries(MEXICAN_FOR).map(([id, mx]) => ({ id, en: enWords.find((w) => w.id === mx).en, examples: EX[id] })), null, 2) + '\n')
fs.writeFileSync('src/data/es/new/en/verbs.json', JSON.stringify(Object.entries(MEXICAN_FOR).map(([id, mx]) => ({ id, en: enVerbs.find((v) => v.id === mx).en })), null, 2) + '\n')
