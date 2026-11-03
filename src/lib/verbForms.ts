import type { ImperativePerson, Person, Verb } from '../data/types.ts'

// The rules that derive the B1–B2 verb forms from the forms every verb already has (CLAUDE.md §3).
// The validator checks every stored form against them. No runtime imports: the validator runs
// this file under plain node.

export type { ImperativePerson }
export const IMPERATIVE_PERSONS: ImperativePerson[] = ['tu', 'el', 'nosotros', 'ellos']

type FormVerb = Pick<Verb, 'id' | 'group' | 'reflexive' | 'presente' | 'preterito' | 'futuro'>

const PERSONS: Person[] = ['yo', 'tu', 'el', 'nosotros', 'ellos']
const PRONOUN: Record<Person, string> = { yo: 'me', tu: 'te', el: 'se', nosotros: 'nos', ellos: 'se' }
const IMPERATIVE_PRONOUN: Record<ImperativePerson, string> = { tu: 'te', el: 'se', nosotros: 'nos', ellos: 'se' }

const SUBJ_ENDINGS = { ar: ['e', 'es', 'e', 'emos', 'en'], er: ['a', 'as', 'a', 'amos', 'an'], ir: ['a', 'as', 'a', 'amos', 'an'] }
const SUBJ_IMPF_ENDINGS = ['ra', 'ras', 'ra', 'ramos', 'ran']
const COND_ENDINGS = ['ía', 'ías', 'ía', 'íamos', 'ían']

const ACUTE: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' }
const PLAIN: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }
const stripAcute = (s: string) => s.replace(/[áéíóú]/g, (c) => PLAIN[c])

/** A form without the reflexive pronoun: "me levanto" → "levanto". */
export const bare = (form: string) => form.split(' ').at(-1)!
const infinitive = (verb: FormVerb) => (verb.reflexive ? verb.id.slice(0, -2) : verb.id)
const infStem = (verb: FormVerb) => infinitive(verb).slice(0, -2)
export const withPronoun = (verb: FormVerb, person: Person, form: string) => (verb.reflexive ? `${PRONOUN[person]} ${form}` : form)
const table = (verb: FormVerb, make: (person: Person, i: number) => string): Record<Person, string> =>
  Object.fromEntries(PERSONS.map((p, i) => [p, withPronoun(verb, p, make(p, i))])) as Record<Person, string>

/** -ar stems before -e keep their sound: busc → busqu, pag → pagu, empiez → empiec, averigu → averigü. */
function arSpelling(stem: string): string {
  if (stem.endsWith('gu')) return `${stem.slice(0, -2)}gü`
  if (stem.endsWith('c')) return `${stem.slice(0, -1)}qu`
  if (stem.endsWith('g')) return `${stem}u`
  if (stem.endsWith('z')) return `${stem.slice(0, -1)}c`
  return stem
}

/** Whether the yo stem is the infinitive stem with a changed vowel (pienso, duermo, juego, pido, adquiero). */
function isStemChange(yoStem: string, stem: string): boolean {
  const back = [yoStem.replace('ie', 'e'), yoStem.replace('ue', 'o'), yoStem.replace('ue', 'u'), yoStem.replace('i', 'e'), yoStem.replace('ie', 'i')]
  return yoStem !== stem && back.includes(stem)
}

const SUBJ_IRREGULAR: Record<string, string[]> = {
  ser: ['sea', 'seas', 'sea', 'seamos', 'sean'],
  ir: ['vaya', 'vayas', 'vaya', 'vayamos', 'vayan'],
  estar: ['esté', 'estés', 'esté', 'estemos', 'estén'],
  saber: ['sepa', 'sepas', 'sepa', 'sepamos', 'sepan'],
  dar: ['dé', 'des', 'dé', 'demos', 'den'],
  haber: ['haya', 'hayas', 'haya', 'hayamos', 'hayan'],
}

/** Presente de subjuntivo: the yo stem of the present with the "other" vowel (tengo → tenga). */
export function deriveSubjuntivo(verb: FormVerb): Record<Person, string> {
  const irregular = SUBJ_IRREGULAR[infinitive(verb)]
  if (irregular) return table(verb, (_, i) => irregular[i])
  const yoStem = bare(verb.presente.yo).slice(0, -1)
  const stem = infStem(verb)
  const endings = SUBJ_ENDINGS[verb.group]
  const changes = isStemChange(stripAcute(yoStem), stem)
  // nosotros: -ar/-er stem-changers go back to the infinitive stem (pensemos); -ir ones keep e→i
  // and turn ie/ue into i/u (sintamos, durmamos); everything else keeps the yo stem (tengamos).
  let nosotrosStem = stripAcute(yoStem)
  if (changes && verb.group !== 'ir') nosotrosStem = stem
  else if (changes) nosotrosStem = nosotrosStem.replace('ie', 'i').replace('ue', 'u')
  const spell = (s: string) => (verb.group === 'ar' ? arSpelling(s) : s)
  return table(verb, (p, i) => spell(p === 'nosotros' ? nosotrosStem : yoStem) + endings[i])
}

/** Imperfecto de subjuntivo (-ra): preterite ellos without -ron (tuvieron → tuviera, tuviéramos). */
export function deriveSubjImperfecto(verb: FormVerb): Record<Person, string> {
  const stem = bare(verb.preterito.ellos).slice(0, -3)
  const accented = stem.slice(0, -1) + ACUTE[stem.at(-1)!]
  return table(verb, (p, i) => (p === 'nosotros' ? accented : stem) + SUBJ_IMPF_ENDINGS[i])
}

/** Condicional: the future stem + ía (tendré → tendría). */
export function deriveCondicional(verb: FormVerb): Record<Person, string> {
  const stem = bare(verb.futuro.yo).slice(0, -1)
  return table(verb, (_, i) => stem + COND_ENDINGS[i])
}

// ---------- imperative ----------

const SHORT_TU: Record<string, string> = { tener: 'ten', venir: 'ven', poner: 'pon', salir: 'sal', hacer: 'haz', decir: 'di', ir: 've', ser: 'sé' }

/** ten, ven, pon… and their compounds with the accent the longer word needs: mantén, propón, prevén. */
function shortTu(base: string): string | undefined {
  if (SHORT_TU[base]) return SHORT_TU[base]
  for (const simple of ['tener', 'venir', 'poner']) {
    if (base.endsWith(simple)) {
      const short = SHORT_TU[simple]
      return base.slice(0, -simple.length) + short.slice(0, -2) + ACUTE[short.at(-2)!] + short.at(-1)
    }
  }
  return undefined
}

const VOWEL = /[aeiouáéíóúü]/
const STRONG = /[aeoáéó]/

/** The vowel groups of a word, split into syllable nuclei (two strong vowels are two syllables). */
function nuclei(word: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []
  let i = 0
  while (i < word.length) {
    // the u of que, qui, gue, gui is silent: not a vowel of its own
    const silentU = word[i] === 'u' && (word[i - 1] === 'q' || word[i - 1] === 'g') && /[eéií]/.test(word[i + 1] ?? '')
    if (!VOWEL.test(word[i]) || silentU) {
      i++
      continue
    }
    let end = i + 1
    while (end < word.length && VOWEL.test(word[end]) && !(STRONG.test(word[end]) && STRONG.test(word[end - 1]))) end++
    out.push({ start: i, end })
    i = end
  }
  return out
}

/**
 * Adds a pronoun to an affirmative imperative: levanta + te → levántate. The stress stays where it
 * was, now on the third syllable from the end, so it needs the written accent; a one-syllable form
 * does not (vete, ponte). nosotros loses its -s before nos (levantemos → levantémonos).
 */
export function attachPronoun(form: string, pronoun: string): string {
  const base = pronoun === 'nos' && form.endsWith('mos') ? form.slice(0, -1) : form
  if (/[áéíóú]/.test(base)) return base + pronoun
  const groups = nuclei(base)
  if (groups.length < 2) return base + pronoun
  // Ending in a vowel, n or s: the stress was on the second syllable from the end.
  const stressed = /[aeiouns]$/.test(form) ? groups[groups.length - 2] : groups[groups.length - 1]
  const letters = base.slice(stressed.start, stressed.end)
  const strong = letters.search(STRONG)
  const at = stressed.start + (strong >= 0 ? strong : letters.length - 1)
  return base.slice(0, at) + ACUTE[base[at]] + base.slice(at + 1) + pronoun
}

/** The affirmative imperative: tú = él of the present (or a short form), the others = the subjunctive. */
export function deriveImperativo(verb: FormVerb, subjuntivo: Record<Person, string>): Record<ImperativePerson, string> {
  const forms: Record<ImperativePerson, string> = {
    tu: shortTu(infinitive(verb)) ?? bare(verb.presente.el),
    el: bare(subjuntivo.el),
    nosotros: bare(subjuntivo.nosotros),
    ellos: bare(subjuntivo.ellos),
  }
  if (!verb.reflexive) return forms
  return Object.fromEntries(IMPERATIVE_PERSONS.map((p) => [p, attachPronoun(forms[p], IMPERATIVE_PRONOUN[p])])) as Record<ImperativePerson, string>
}

// ---------- participle ----------

// Endings of the infinitive → participle; compounds follow their simple verb (proponer → propuesto).
const PARTICIPLE_ENDINGS: [string, string][] = [
  ['scribir', 'scrito'],
  ['cubrir', 'cubierto'],
  ['solver', 'suelto'],
  ['volver', 'vuelto'],
  ['poner', 'puesto'],
  ['hacer', 'hecho'],
  ['decir', 'dicho'],
  ['abrir', 'abierto'],
  ['romper', 'roto'],
  ['morir', 'muerto'],
]

export function deriveParticiple(verb: FormVerb): string {
  const base = infinitive(verb)
  if (base === 'ver' || base === 'prever') return `${base.slice(0, -2)}isto`
  for (const [ending, participle] of PARTICIPLE_ENDINGS) {
    if (base.endsWith(ending)) return base.slice(0, -ending.length) + participle
  }
  const stem = infStem(verb)
  if (verb.group === 'ar') return `${stem}ado`
  // leer → leído, traer → traído; but construir → construido (u + i is one syllable)
  return /[aeo]$/.test(stem) ? `${stem}ído` : `${stem}ido`
}

// ---------- the regular pattern (for irregularForms) ----------

const REGULAR_SUBJ_IMPF = {
  ar: ['ara', 'aras', 'ara', 'áramos', 'aran'],
  er: ['iera', 'ieras', 'iera', 'iéramos', 'ieran'],
  ir: ['iera', 'ieras', 'iera', 'iéramos', 'ieran'],
}

export function regularNew(verb: FormVerb, tense: 'subjuntivo' | 'subjImperfecto' | 'condicional', person: Person): string {
  const i = PERSONS.indexOf(person)
  const form =
    tense === 'subjuntivo'
      ? infStem(verb) + SUBJ_ENDINGS[verb.group][i]
      : tense === 'subjImperfecto'
        ? infStem(verb) + REGULAR_SUBJ_IMPF[verb.group][i]
        : infinitive(verb) + COND_ENDINGS[i]
  return withPronoun(verb, person, form)
}

export function regularImperativo(verb: FormVerb, person: ImperativePerson): string {
  const stem = infStem(verb)
  const form = person === 'tu' ? stem + (verb.group === 'ar' ? 'a' : 'e') : stem + SUBJ_ENDINGS[verb.group][PERSONS.indexOf(person)]
  return verb.reflexive ? attachPronoun(form, IMPERATIVE_PRONOUN[person]) : form
}

export const regularParticiple = (verb: FormVerb) => infStem(verb) + (verb.group === 'ar' ? 'ado' : 'ido')
