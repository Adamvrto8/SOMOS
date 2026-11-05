import type { Tense, Verb } from '../data/types.ts'

// Vosotros (Spain) is not stored: every form follows from the forms a verb already has, so the 283 verbs stay as they are
// and the Mexican variant never sees it. Rules: -áis/-éis/-ís in the present, the tú form + is in the past tenses,
// the nosotros stem + áis/éis in the subjunctive, infinitive with -d in the imperative.

export type VosotrosTense = Tense | 'imperativo'

type FormVerb = Pick<Verb, 'id' | 'group' | 'reflexive' | 'presente' | 'preterito' | 'imperfecto' | 'futuro' | 'subjuntivo' | 'subjImperfecto' | 'condicional'>

const bare = (form: string) => form.split(' ').at(-1)!
const infinitive = (verb: Pick<Verb, 'id' | 'reflexive'>) => (verb.reflexive ? verb.id.slice(0, -2) : verb.id)

/** Presente: irregular in the endings themselves (the stem never changes: pensáis, dormís, tenéis). */
const PRESENTE_IRREGULAR: Record<string, string> = { ser: 'sois', ir: 'vais', ver: 'veis', prever: 'preveis', dar: 'dais', haber: 'habéis' }
const SUBJ_IRREGULAR: Record<string, string> = { dar: 'deis' }

/** Whether the vosotros form of the present differs from the regular -áis/-éis/-ís pattern. */
export const vosotrosPresenteIrregular = (verb: Pick<Verb, 'id' | 'reflexive'>) => infinitive(verb) in PRESENTE_IRREGULAR

/** The tú form with its final -s replaced by -is: hablabas → hablabais, hablaras → hablarais, hablarías → hablaríais. */
const fromTu = (form: string) => `${bare(form).slice(0, -1)}is`

/** The vosotros form without the reflexive pronoun. */
export function bareVosotros(verb: FormVerb, tense: VosotrosTense): string {
  const inf = infinitive(verb)
  switch (tense) {
    case 'presente':
      return PRESENTE_IRREGULAR[inf] ?? inf.slice(0, -2) + { ar: 'áis', er: 'éis', ir: 'ís' }[verb.group]
    case 'preterito':
      return `${bare(verb.preterito.tu)}is`
    case 'imperfecto':
      return fromTu(verb.imperfecto.tu)
    case 'condicional':
      return fromTu(verb.condicional.tu)
    case 'subjImperfecto':
      return fromTu(verb.subjImperfecto.tu)
    case 'futuro':
      return `${bare(verb.futuro.tu).slice(0, -2)}éis`
    case 'subjuntivo':
      return SUBJ_IRREGULAR[inf] ?? bare(verb.subjuntivo.nosotros).slice(0, -4) + (verb.group === 'ar' ? 'éis' : 'áis')
    case 'imperativo':
      return imperativoAffirmative(verb)
  }
}

function imperativoAffirmative(verb: FormVerb): string {
  const inf = infinitive(verb)
  if (inf === 'ir') return verb.reflexive ? 'idos' : 'id'
  const stem = inf.slice(0, -1) // hablar → habla
  if (!verb.reflexive) return `${stem}d`
  // levantad + os → levantaos; -ir keeps an accent: vestid + os → vestíos
  return verb.group === 'ir' ? `${inf.slice(0, -2)}íos` : `${stem}os`
}

/** The form as written in a table: reflexive verbs take "os" first (os levantáis), the affirmative imperative attaches it. */
export function vosotrosForm(verb: FormVerb, tense: VosotrosTense): string {
  const form = bareVosotros(verb, tense)
  return verb.reflexive && tense !== 'imperativo' ? `os ${form}` : form
}

/** "no habléis", "no os levantéis". */
export function vosotrosNegative(verb: FormVerb): string {
  return `no ${verb.reflexive ? 'os ' : ''}${bareVosotros(verb, 'subjuntivo')}`
}

/** Whether the stored forms this one rests on are irregular (highlighted in the table). */
export function vosotrosIrregular(verb: Pick<Verb, 'id' | 'reflexive' | 'irregularForms'>, tense: VosotrosTense): boolean {
  if (tense === 'presente') return vosotrosPresenteIrregular(verb)
  const from = { preterito: 'tu', imperfecto: 'tu', condicional: 'tu', subjImperfecto: 'tu', futuro: 'tu', subjuntivo: 'nosotros', imperativo: '' }[tense]
  const forms = verb.irregularForms ?? []
  return forms.includes(`${tense}.*`) || (from !== '' && forms.includes(`${tense}.${from}`))
}
