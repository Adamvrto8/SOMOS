// The hand-written part of the es-ES sentence overlay: the sentences spain-overlay.mjs could not swap word for word.
// Each entry gives the Spain sentence; tokens are rebuilt from it and every blank is re-aimed at the new tokens.
// A blank on a verb that Spain says differently (manejar → conducir) is named by `verb`/`tense`/`person`, so its answer,
// hint and wrong choices come from the verb data. Run after spain-overlay.mjs: node scripts/spain-manual.mjs
import fs from 'fs'

const read = (d) => fs.readdirSync(`src/data/${d}`).flatMap((f) => JSON.parse(fs.readFileSync(`src/data/${d}/${f}`, 'utf8')).map((x) => ({ ...x, _file: f })))
const baseSentences = Object.fromEntries(read('sentences').map((s) => [s.id, s]))
const verbs = Object.fromEntries([...read('verbs'), ...read('es/new/verbs')].map((v) => [v.id, v]))
const bare = (f) => f.split(' ').at(-1)
const PERSONS = ['yo', 'tu', 'el', 'nosotros', 'ellos']
import { bareVosotros } from '../src/lib/vosotros.ts'

// verb blanks: { verb, tense, person } or { verb, gerund: true }
const V = (verb, tense, person) => ({ verb, tense, person })
const G = (verb) => ({ verb, gerund: true })

/** id → { es: the Spain sentence, blank: { <Mexican answer>: spec } } */
const MANUAL = {
  s1008: { es: 'Ahora estoy aprendiendo a conducir.' },
  s1043: { es: 'Me duele el cuello porque paso todo el día frente al ordenador.' },
  s1065: { es: '¿Estás conduciendo? Te escucho muy mal.', blank: { manejando: G('conducir') } },
  s1074: { es: 'Pagué el parquímetro por dos horas, pero volví tarde y me multaron.', blank: { regresé: V('volver', 'preterito', 'yo') } },
  s1085: { es: 'La gentrificación está subiendo los alquileres en barrios como Malasaña y Lavapiés.' },
  s150: { es: '¿Sabes conducir en la Ciudad de México?' },
  s231: { es: 'Compré unas zapatillas nuevas.', blank: { unos: 'unas' } },
  s531: { es: 'Cambié las zapatillas porque me quedaban pequeñas.' },
  s818: { es: 'Se me rompió la cremallera de la chaqueta.', blank: { cierre: 'cremallera' } },
  s1089: { es: 'Mi hermano siempre lleva zapatillas blancas.', blank: { blancos: 'blancas' } },
  s1116: { es: 'En las ofertas de diciembre conseguí unas zapatillas de marca a mitad de precio.' },
  s326: { es: 'Mi jefe se enfadó conmigo.', blank: { enojó: V('enfadarse', 'preterito', 'el') } },
  s398: { es: 'Mi novia se enfadó conmigo.', blank: { enojó: V('enfadarse', 'preterito', 'el') } },
  s535: { es: 'Se enfadó conmigo porque olvidé su cumpleaños.', blank: { enojó: V('enfadarse', 'preterito', 'el') } },
  s1684: { es: 'Mi hermana me prestó su coche y se lo devolví el lunes.' },
  s632: { es: 'Luego te llamo, ahora estoy conduciendo.', blank: { manejando: G('conducir') } },
  s864: { es: 'Durante la pandemia todos usábamos mascarilla.' },
  s1253: { es: 'Tengo una enfermedad crónica, así que me hago una revisión cada tres meses.', blank: { checo: V('hacer', 'presente', 'yo') } },
  s1259: { es: 'Nos contagiamos todos en la oficina por no usar mascarilla.', blank: { cubrebocas: 'mascarilla' } },
  s350: { es: 'Jugué al tenis con mi primo.' },
  s1642: { es: 'Me gusta mi dormitorio.' },
  s1660: { es: 'En mi piso hay dos dormitorios.' },
  s112: { es: 'Vivimos en un piso de dos dormitorios.' },
  s1727: { es: 'Vosotros debéis limpiar vuestro dormitorio hoy.', blank: { deben: { answer: 'debéis', distractors: ['podéis', 'tenéis', 'debemos'] } } },
  s117: { es: 'El alquiler sube cada año.' },
  s561: { es: 'El dueño del piso nos va a subir el alquiler.', blank: { renta: 'alquiler' } },
  s707: { es: 'Se fundió la bombilla del baño.', blank: { foco: 'bombilla' } },
  s714: { es: 'No pises, acabo de fregar.' },
  s719: { es: 'Alquilamos un piso amueblado cerca del centro.' },
  s1302: { es: 'Enciende el calentador media hora antes de bañarte.' },
  s1303: { es: 'Nos subieron el alquiler otra vez y ya no nos alcanza.' },
  s1308: { es: 'Para ahorrar luz, cambiamos todas las bombillas por otras de bajo consumo.' },
  s1966: { es: 'Se alquilan pisos cerca del metro.', blank: { rentan: { answer: 'alquilan', lemma: 'alquilar', hint: 'alquilar' } } },
  s1327: { es: 'Las olas estaban muy fuertes, así que volvimos al hotel.', blank: { regresamos: V('volver', 'preterito', 'nosotros') } },
  s1368: { es: 'Casi el treinta por ciento de mi sueldo se va en el alquiler.' },
  s1393: { es: 'Necesito un bolígrafo y un cuaderno.' },
  s1410: { es: 'Aunque tenía beca, apenas me alcanzaba para el alquiler.' },
  s1803: { es: 'Yo compraría un ordenador nuevo, pero es muy caro.' },
  s579: { es: 'Se me estropeó el ordenador y perdí todos mis archivos.' },
  s1453: { es: 'El ordenador está en mi habitación.' },
  s1460: { es: 'La pantalla de mi ordenador es muy grande.' },
  s1461: { es: '¿Puedo usar tu ordenador un momento?' },
  s1463: { es: 'Antes mi abuela no sabía usar el ordenador.' },
  s1466: { es: 'Mañana compraré un ordenador nuevo.' },
  s1472: { es: 'Mi hermano me ayudará con el ordenador.' },
  s1476: { es: 'Se me colgó el ordenador justo cuando iba a mandar el trabajo.' },
  s1698: { es: 'Este ordenador es tan rápido como el de mi trabajo.' },
  s1702: { es: 'El ordenador más barato de la tienda cuesta cinco mil pesos.' },
  s1501: { es: 'A primera hora miro el correo y te aviso.' },
  s157: { es: 'Alquilamos un coche para viajar por Yucatán.', blank: { Rentamos: V('alquilar', 'preterito', 'nosotros') } },
  s159: { es: '¿Cuándo vuelves a Eslovaquia?', blank: { regresas: V('volver', 'presente', 'tu') } },
  s166: { es: 'Condujimos seis horas hasta Guanajuato.', blank: { Manejamos: V('conducir', 'preterito', 'nosotros') } },
  s434: { es: 'Mientras conducía, mi esposa dormía.', blank: { manejaba: V('conducir', 'imperfecto', 'yo') } },
  s196: { es: '¿Puedes mirar el correo del cliente?' },
  s203: { es: 'Usamos este ordenador para diseñar.' },
  s1575: { es: 'Mi ordenador no funciona hoy.' },
  s1577: { es: 'Mi papá es chófer y conduce un taxi.', blank: { maneja: V('conducir', 'presente', 'el') } },
  s1716: { es: '¿Puedo usar su ordenador un momento?' },
  s1593: { es: 'Con este sueldo apenas me alcanza para el alquiler y la comida.' },
  s033: { es: 'Mi coche está en el aparcamiento.' },
  s142: { es: 'Aparqué el coche enfrente de la iglesia.', blank: { Estacioné: V('aparcar', 'preterito', 'yo') } },
  s739: { es: 'El policía nos señaló dónde aparcar.' },
  s1073: { es: 'Me parece que los topes no sirven para que la gente conduzca despacio.', blank: { maneje: V('conducir', 'subjuntivo', 'el') } },
  s1777: { es: 'Ojalá que encontremos aparcamiento cerca del mercado.' },
  s1779: { es: 'Mi tía no quiere que conduzcamos de noche por la ciudad.', blank: { manejemos: V('conducir', 'subjuntivo', 'nosotros') } },
  s1103: { es: 'Esta moda de los noventa está volviendo.'.replace('Esta moda','Creo que la moda'), blank: { regresando: G('volver') } },
  s1106: { es: 'Esta prenda no se puede meter en la secadora porque se encoge.' },
  s1842: { es: 'No quiero que te enfades conmigo.', blank: { enojes: V('enfadarse', 'subjuntivo', 'tu') } },
  s1138: { es: 'Mi abuelo se enfadará si llegamos tarde.', blank: { enojará: V('enfadarse', 'futuro', 'el') } },
  s1828: { es: 'Si fueras más paciente, no te enfadarías tanto.' },
  s1140: { es: 'Estaba celoso porque mi novia charlaba mucho con su ex.', blank: { platicaba: V('charlar', 'imperfecto', 'el') } },
  s1205: { es: '¡Buen viaje! Nos vemos cuando vuelvas.' },
  s491: { es: 'Encendí la luz porque no veía nada.', blank: { Prendí: V('encender', 'preterito', 'yo') } },
  s1506: { es: 'Llevamos años charlando de ese viaje y nunca lo hacemos.', blank: { platicando: G('charlar') } },
  s060: { es: 'Mis compañeros están charlando en la cocina.', blank: { platicando: G('charlar') } },
  s2078: { es: 'No me gustaría que el casero subiera el alquiler sin avisarnos antes.' },
  s2108: { es: 'Si la escuela tuviera más ordenadores, los niños aprenderían programación más rápido.' },
  s2119: { es: 'Si mi ordenador no fuera tan lento, trabajaría mucho más rápido.', blank: { fuera: { answer: 'fuera', hint: 'ser · él · subjuntivo imperfecto' } } },
  s2121: { es: 'En cuanto llegue a casa y abra el ordenador, te mando el archivo.' },
  s2126: { es: 'Mientras se descarga la actualización, no apagues el móvil ni cierres la aplicación.' },
  // Auto-swapped by spain-overlay.mjs, but the blank is on platicar, whose Spain verb is charlar:
  s1479: { es: 'Me arrepentí de no haber hecho una copia de seguridad antes de la actualización.', blank: { de: { answer: 'de', newIndex: 11 } } },
  s016: { es: null, blank: { platicamos: V('charlar', 'presente', 'nosotros') } },
  s1482: { es: null, blank: { platica: V('charlar', 'presente', 'el') } },
}

const tokenize = (text) => text.match(/[¿¡]|[.,;:?!]|[^\s¿¡.,;:?!]+/g)
const rebuild = (tokens) => tokens.join(' ').replace(/ ([.,?!;:])/g, '$1').replace(/([¿¡]) /g, '$1')
const cap = (s, like) => (like[0] !== like[0].toLowerCase() ? s[0].toUpperCase() + s.slice(1) : s)

function verbBlank(spec, mx) {
  const v = verbs[spec.verb]
  if (!v) throw new Error(`no verb ${spec.verb}`)
  const form = (p) => (p === 'vosotros' ? bareVosotros(v, spec.tense) : bare(v[spec.tense][p]))
  const correct = spec.gerund ? v.gerund : form(spec.person)
  const wrong = spec.gerund ? [v.id.replace(/se$/, ''), v.participle, bare(v.presente.el)] : [...PERSONS, 'vosotros'].filter((p) => p !== spec.person).map(form)
  const hintParts = (mx.hint ?? '').split(' · ')
  hintParts[0] = v.id
  if (spec.person === 'vosotros') hintParts[1] = 'vosotros'
  return { answer: cap(correct, mx.answer), lemma: v.id, hint: hintParts.join(' · '), distractors: [...new Set(wrong)].filter((d) => d !== correct).slice(0, 3).map((d) => cap(d, mx.answer)) }
}

// Words whose Spain form needs more than the swap: a plural, another gender.
const WORD_FIXES = {
  // Mexican verbs: Spain has conducir, alquilar, aparcar, charlar, enfadarse, encender, volver (es/new/).
  ...Object.fromEntries(['manejar', 'rentar', 'estacionar', 'platicar', 'enojarse', 'prender', 'regresar'].map((id) => [id, { hidden: true }])),
  computadora: { es: 'ordenador', gender: 'm', plural: 'ordenadores', examples: [{ es: 'Mi ordenador es muy lento.', sk: 'Môj počítač je strašne pomalý.' }] },
  renta: { es: 'alquiler', gender: 'm', plural: 'alquileres', examples: [{ es: 'El alquiler es muy caro en el centro.', sk: 'Nájom v centre je veľmi drahý.' }] },
  pluma: { es: 'bolígrafo', gender: 'm', plural: 'bolígrafos', examples: [{ es: '¿Me prestas un bolígrafo?', sk: 'Požičiaš mi pero?' }] },
  recamara: { es: 'dormitorio', gender: 'm', plural: 'dormitorios', examples: [{ es: 'El piso tiene dos dormitorios.', sk: 'Byt má dve spálne.' }] },
  foco: { es: 'bombilla', gender: 'f', plural: 'bombillas', examples: [{ es: 'Se fundió la bombilla del baño.', sk: 'V kúpeľni praskla žiarovka.' }] },
  cierre: { es: 'cremallera', gender: 'f', plural: 'cremalleras', examples: [{ es: 'Se rompió la cremallera de mi chaqueta.', sk: 'Pokazil sa mi zips na bunde.' }] },
  tenis: { es: 'zapatillas', gender: 'f', plural: 'zapatillas', examples: [{ es: 'Siempre uso zapatillas.', sk: 'Vždy nosím tenisky.' }] },
  cubrebocas: { es: 'mascarilla', gender: 'f', examples: [{ es: 'En el hospital todavía piden mascarilla.', sk: 'V nemocnici ešte stále chcú rúško.' }] },
  audifono: { plural: 'auriculares' },
  respaldo: { es: 'copia de seguridad', plural: 'copias de seguridad', gender: 'f' },
}
for (const [id, fix] of Object.entries(WORD_FIXES)) {
  const file = read('words').find((w) => w.id === id)?._file
  const path = `src/data/es/words/${file}`
  const entries = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : []
  const i = entries.findIndex((e) => e.id === id)
  if (i >= 0) entries[i] = { ...entries[i], ...fix }
  else entries.push({ id, ...fix })
  fs.mkdirSync('src/data/es/words', { recursive: true })
  fs.writeFileSync(path, JSON.stringify(entries, null, 2) + '\n')
}

const overlayDir = 'src/data/es/sentences'
const files = {}
const load = (f) => (files[f] ??= fs.existsSync(`${overlayDir}/${f}`) ? JSON.parse(fs.readFileSync(`${overlayDir}/${f}`, 'utf8')) : [])
const problems = []

for (const [id, spec] of Object.entries(MANUAL)) {
  const base = baseSentences[id]
  if (!base) { problems.push(`${id}: not in the base`); continue }
  const f = base._file
  const entries = load(f)
  const existing = entries.find((e) => e.id === id)
  const es = spec.es ?? existing?.es ?? base.es
  const tokens = spec.es === null && existing ? existing.tokens : tokenize(es)
  if (rebuild(tokens) !== es) problems.push(`${id}: tokens do not rebuild "${es}"`)
  const cloze = []
  const seen = {}
  for (const c of base.cloze ?? []) {
    const blank = spec.blank?.[c.answer]
    let patch
    if (typeof blank === 'string') patch = { answer: blank }
    else if (blank && !blank.verb) patch = blank
    else if (blank) patch = verbBlank(blank, c)
    else if (existing?.cloze?.find((x) => x.tokenIndex === c.tokenIndex)) patch = existing.cloze.find((x) => x.tokenIndex === c.tokenIndex)
    else patch = { answer: c.answer }
    // A wrong choice that is now the right answer (unos/unas) swaps places with the old answer.
    if (!patch.distractors && (c.distractors ?? []).includes(patch.answer)) patch = { ...patch, distractors: c.distractors.map((d) => (d === patch.answer ? c.answer : d)) }
    // nth occurrence of this answer among the base tokens before it → same occurrence in the new tokens
    const nth = base.tokens.slice(0, c.tokenIndex).filter((t) => t === c.answer).length
    const positions = tokens.map((t, i) => (t === patch.answer ? i : -1)).filter((i) => i >= 0)
    const newIndex = patch.newIndex ?? positions[nth] ?? positions[0]
    if (newIndex === undefined) { problems.push(`${id}: blank "${patch.answer}" is not in "${es}"`); continue }
    const moved = newIndex !== c.tokenIndex
    if (!blank && patch.answer === c.answer && !moved && !existing?.cloze) continue
    cloze.push({ tokenIndex: c.tokenIndex, ...(moved ? { newIndex } : {}), answer: patch.answer, ...(patch.lemma ? { lemma: patch.lemma } : {}), ...(patch.hint ? { hint: patch.hint } : {}), ...(patch.distractors?.length ? { distractors: patch.distractors } : {}) })
    seen[c.answer] = true
  }
  for (const key of Object.keys(spec.blank ?? {})) if (!seen[key]) problems.push(`${id}: blank "${key}" not found in the base clozes`)
  const entry = { id, es, tokens, ...(cloze.length ? { cloze } : {}) }
  const i = entries.findIndex((e) => e.id === id)
  if (i >= 0) entries[i] = entry
  else entries.push(entry)
}

fs.mkdirSync(overlayDir, { recursive: true })
for (const [f, entries] of Object.entries(files)) fs.writeFileSync(`${overlayDir}/${f}`, JSON.stringify(entries, null, 2) + '\n')
console.log(`manual sentences: ${Object.keys(MANUAL).length}, problems: ${problems.length}`)
console.log(problems.join('\n'))

// What is still open: the todo list minus everything written above.
const todoPath = 'docs/spain-draft/todo.json'
const todo = JSON.parse(fs.readFileSync(todoPath, 'utf8'))
todo.sentences = todo.sentences.filter((s) => !(s.id in MANUAL))
todo.words = todo.words.filter((w) => !(w.id in WORD_FIXES))
fs.writeFileSync(todoPath, JSON.stringify(todo, null, 2) + '\n')
console.log(`still open: ${todo.words.length} words (mostly notes and Mexican-only culture words), ${todo.sentences.length} sentences`)
