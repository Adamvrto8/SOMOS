// Draft generator for the es-ES overlay: reads the Mexican base data and writes ONLY the entries that differ,
// with the current Mexican text and a proposed Spain version side by side. Nothing in src/ is changed.
// Run: node scripts/spain-diff.mjs   → docs/spain-draft/{words,sentences,review}.json
import fs from 'fs'
import path from 'path'

const read = (d) => fs.readdirSync(`src/data/${d}`).flatMap((f) => JSON.parse(fs.readFileSync(`src/data/${d}/${f}`, 'utf8')).map((x) => ({ ...x, _file: f })))
const words = read('words')
const sentences = read('sentences')

// Same-gender swaps: safe to apply automatically (token for token, article stays).
const SAFE = {
  carro: 'coche', carros: 'coches', celular: 'móvil', celulares: 'móviles', jugo: 'zumo', jugos: 'zumos',
  papa: 'patata', papas: 'patatas', boleto: 'billete', boletos: 'billetes', lentes: 'gafas', departamento: 'piso',
  departamentos: 'pisos', chamarra: 'chaqueta', chamarras: 'chaquetas', playera: 'camiseta', playeras: 'camisetas',
  alberca: 'piscina', albercas: 'piscinas', banqueta: 'acera', banquetas: 'aceras', regadera: 'ducha',
  cobija: 'manta', cobijas: 'mantas', plomero: 'fontanero', mesero: 'camarero', mesera: 'camarera',
  jitomate: 'tomate', jitomates: 'tomates', gripa: 'gripe', curita: 'tirita', camión: 'autobús', camiones: 'autobuses',
  estacionar: 'aparcar', rentar: 'alquilar', platicar: 'charlar', platico: 'charlo', platica: 'charla',
  platicamos: 'charlamos', platican: 'charlan', platicas: 'charlas', enojado: 'enfadado', enojada: 'enfadada',
  enojarse: 'enfadarse', regresar: 'volver', ahorita: 'ahora', descompuesto: 'estropeado',
  descompuesta: 'estropeada', audífonos: 'auriculares', audífono: 'auricular', arete: 'pendiente', aretes: 'pendientes',
  sustentable: 'sostenible', reservación: 'reserva', reservaciones: 'reservas', prender: 'encender', plomería: 'fontanería',
}
// Gender or number of the noun changes (la computadora → el ordenador): article/adjectives need a human.
const GENDER = {
  computadora: 'ordenador', computadoras: 'ordenadores', renta: 'alquiler', rentas: 'alquileres', pluma: 'bolígrafo',
  plumas: 'bolígrafos', recámara: 'dormitorio', recámaras: 'dormitorios', foco: 'bombilla', focos: 'bombillas',
  cierre: 'cremallera', cierres: 'cremalleras', tenis: 'zapatillas', cubrebocas: 'mascarilla',
}
// Determiner that precedes the noun, per gender/number change (mx noun → how el/la/un/una… must change).
const FEM_TO_MASC = { la: 'el', las: 'los', una: 'un', unas: 'unos', esta: 'este', estas: 'estos', esa: 'ese', esas: 'esos', mi: 'mi', mis: 'mis', otra: 'otro', toda: 'todo' }
const MASC_TO_FEM = { el: 'la', los: 'las', un: 'una', unos: 'unas', este: 'esta', estos: 'estas', ese: 'esa', esos: 'esas', otro: 'otra', todo: 'toda' }
const DET = { computadora: FEM_TO_MASC, computadoras: FEM_TO_MASC, renta: FEM_TO_MASC, rentas: FEM_TO_MASC, pluma: FEM_TO_MASC, plumas: FEM_TO_MASC, recámara: FEM_TO_MASC, recámaras: FEM_TO_MASC, cierre: MASC_TO_FEM, cierres: MASC_TO_FEM, foco: MASC_TO_FEM, focos: MASC_TO_FEM, tenis: MASC_TO_FEM, cubrebocas: MASC_TO_FEM }
// Verbs: conjugated forms differ (manejo → conduzco), a human decides.
const VERBS = ['manejar', 'manejo', 'manejas', 'maneja', 'manejamos', 'manejan', 'manejé', 'manejó', 'manejaron', 'manejando', 'manejaba', 'checar', 'chequé', 'checo', 'chequea', 'regreso', 'regresa', 'regresó', 'regresé', 'regresas', 'regresamos', 'regresan', 'regresaron', 'rento', 'renta', 'rentamos', 'rentan', 'estaciono', 'estacionó', 'estacionamos', 'prendo', 'prende', 'prendió', 'enojo', 'enojó', 'enojas', 'enojan', 'trapear', 'voltear', 'chambear']
// Never touch: Mexican-only culture words. Hidden in es-ES lessons, kept for search.
const MX_ONLY = new Set(['mariachi', 'tianguis', 'tamal', 'antojito', 'antojo', 'quinceañera', 'lucha libre', 'pueblo mágico', 'tinaco', 'fraccionamiento', 'nopal', '¿mande?', '¡no manches!', 'órale', 'chido', 'chavo', 'chamaco', 'cuate', 'ándale', 'apapacho', 'apapachar', 'güero', 'pelón', 'ni modo', 'a poco', '¿neta?', '¡aguas!', 'achicopalado', '¡qué padre!', '¿qué onda?', '¡échale ganas!', 'no hay bronca', 'buena onda', '¡qué oso!', 'me late', 'ahí nos vidrios', 'licuado', 'botana', 'sale', 'al rato', 'rato', 'chamba', 'finiquito', 'mayoreo', 'enganche', 'ropa de paca', 'mezclilla', 'tope', 'azotea', 'zócalo', 'pan', 'tequila', 'elote', 'de plano', 'quedar de', 'echar la mano', 'porra', 'lana'])

const keep = (s, to) => (s[0] !== s[0].toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to)
const key = (t) => t.toLowerCase()

function mapText(text) {
  let out = text
  const manual = []
  const swap = (table, flag) => {
    for (const [mx, es] of Object.entries(table)) {
      const re = new RegExp(`(^|[^\\p{L}])(${mx})(?![\\p{L}])`, 'giu')
      out = out.replace(re, (m, pre, w) => {
        if (flag) manual.push(`${w} → ${es} (${flag})`)
        return pre + keep(w, es)
      })
    }
  }
  swap(SAFE)
  for (const [mx, es] of Object.entries(GENDER)) {
    const re = new RegExp(`(^|[^\\p{L}])(?:([\\p{L}]+) )?(${mx})(?![\\p{L}])`, 'giu')
    out = out.replace(re, (m, pre, det, w) => {
      const d = det && DET[mx][det.toLowerCase()]
      manual.push(`${w} → ${es} (gender/number: check adjectives after the noun)`)
      return pre + (det ? (d ? keep(det, d) : det) + ' ' : '') + keep(w, es)
    })
  }
  for (const v of VERBS) if (new RegExp(`(^|[^\\p{L}])${v}(?![\\p{L}])`, 'iu').test(text)) manual.push(`verb form "${v}" (conduzco/charlo/…): check by hand`)
  out = out.replace(/(^|[^\p{L}])([Aa]|[Dd]e) el (?=ordenador|alquiler|bolígrafo|dormitorio)/gu, (m, pre, p) => pre + (p.toLowerCase() === 'a' ? p + 'l ' : p + 'l '))
  return { text: out, manual }
}

// Words -------------------------------------------------------------------------------------------------------
const outWords = []
for (const w of words) {
  const mxOnly = MX_ONLY.has(w.es.toLowerCase())
  const head = mapText(w.es)
  const ex = (w.examples || []).map((e) => ({ es_mx: e.es, es_es: mapText(e.es).text, sk: e.sk }))
  const exChanged = ex.some((e) => e.es_mx !== e.es_es)
  const noteMentions = /Mexic|Španiel|mexick/i.test(w.note || '')
  if (!mxOnly && head.text === w.es && !exChanged && !noteMentions) continue
  const manual = [...head.manual, ...(w.examples || []).flatMap((e) => mapText(e.es).manual)]
  outWords.push({
    id: w.id, file: w._file, sk: w.sk[0], pos: w.pos, gender: w.gender,
    es_mx: w.es, es_es: mxOnly ? null : head.text,
    plural_mx: w.plural ?? undefined, plural_es: w.plural ? mapText(w.plural).text : undefined,
    action: mxOnly ? 'hide-in-es' : head.text !== w.es ? 'replace' : exChanged ? 'examples-only' : 'note-only',
    note_mx: w.note, note_es: noteMentions ? '' : undefined,
    examples: exChanged ? ex : undefined,
    manual: manual.length ? [...new Set(manual)] : undefined,
  })
}

// Sentences ---------------------------------------------------------------------------------------------------
const outSent = []
for (const s of sentences) {
  const tokens = s.tokens.map((t, i, arr) => {
    const lower = key(t)
    const to = SAFE[lower] ?? GENDER[lower]
    if (to) return keep(t, to)
    const next = arr[i + 1] && key(arr[i + 1])
    if (next && GENDER[next]) {
      const d = DET[next][lower]
      if (d) return keep(t, d)
    }
    return t
  })
  const mapped = mapText(s.es)
  if (mapped.text === s.es && !mapped.manual.length) continue
  // Token-for-token swap only when counts match (multi-word replacements like "copia de seguridad" need a human).
  const sameShape = tokens.length === s.tokens.length && tokens.join(' ').length > 0
  const rebuilt = tokens.join(' ').replace(/ ([.,?!;:])/g, '$1').replace(/([¿¡]) /g, '$1')
  const manual = [...mapped.manual]
  if (rebuilt !== mapped.text) manual.push('tokens do not rebuild the sentence (multi-word swap): rebuild tokens by hand')
  const cloze = (s.cloze || []).map((c) => {
    const answerEs = tokens[c.tokenIndex]
    return {
      tokenIndex: c.tokenIndex, answer_mx: c.answer, answer_es: answerEs, lemma_mx: c.lemma, hint: c.hint,
      distractors_es: (c.distractors || []).map((d) => SAFE[key(d)] ?? GENDER[key(d)] ?? d),
      changed: answerEs !== c.answer,
    }
  })
  outSent.push({
    id: s.id, file: s._file, level: s.level, sk: s.sk, es_mx: s.es, es_es: mapped.text,
    tokens_es: sameShape ? tokens : undefined,
    cloze: cloze.some((c) => c.changed) || cloze.some((c) => c.distractors_es.length) ? cloze : undefined,
    manual: manual.length ? [...new Set(manual)] : undefined,
  })
}

const out = 'docs/spain-draft'
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'words.json'), JSON.stringify(outWords, null, 2) + '\n')
fs.writeFileSync(path.join(out, 'sentences.json'), JSON.stringify(outSent, null, 2) + '\n')
const review = {
  generated: new Date().toISOString().slice(0, 10),
  base: { words: words.length, sentences: sentences.length },
  words: { listed: outWords.length, replace: outWords.filter((w) => w.action === 'replace').length, hideInEs: outWords.filter((w) => w.action === 'hide-in-es').length, examplesOnly: outWords.filter((w) => w.action === 'examples-only').length, noteOnly: outWords.filter((w) => w.action === 'note-only').length, manual: outWords.filter((w) => w.manual).length },
  sentences: { listed: outSent.length, manual: outSent.filter((s) => s.manual).length, withClozeChange: outSent.filter((s) => s.cloze?.some((c) => c.changed)).length },
}
fs.writeFileSync(path.join(out, 'review.json'), JSON.stringify(review, null, 2) + '\n')
console.log(JSON.stringify(review, null, 2))
