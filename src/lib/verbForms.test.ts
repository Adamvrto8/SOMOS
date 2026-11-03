import { describe, expect, it } from 'vitest'
import { verbById } from '../data'
import {
  attachPronoun,
  deriveCondicional,
  deriveImperativo,
  deriveParticiple,
  deriveSubjImperfecto,
  deriveSubjuntivo,
  regularNew,
} from './verbForms'

const v = (id: string) => {
  const verb = verbById.get(id)
  if (!verb) throw new Error(id)
  return verb
}
const subj = (id: string) => deriveSubjuntivo(v(id))

describe('subjuntivo', () => {
  it('takes the yo stem of the present', () => {
    expect(subj('tener')).toEqual({ yo: 'tenga', tu: 'tengas', el: 'tenga', nosotros: 'tengamos', ellos: 'tengan' })
    expect(subj('conocer').yo).toBe('conozca')
    expect(subj('hablar')).toEqual({ yo: 'hable', tu: 'hables', el: 'hable', nosotros: 'hablemos', ellos: 'hablen' })
    expect(subj('vivir').nosotros).toBe('vivamos')
  })
  it('keeps the sound of -car, -gar, -zar, -guar', () => {
    expect(subj('buscar').yo).toBe('busque')
    expect(subj('llegar').yo).toBe('llegue')
    expect(subj('empezar')).toEqual({ yo: 'empiece', tu: 'empieces', el: 'empiece', nosotros: 'empecemos', ellos: 'empiecen' })
    expect(subj('averiguar').yo).toBe('averigüe')
    expect(subj('jugar').nosotros).toBe('juguemos')
  })
  it('changes the stem of -ar/-er stem-changers except in nosotros', () => {
    expect(subj('pensar').el).toBe('piense')
    expect(subj('pensar').nosotros).toBe('pensemos')
    expect(subj('poder').nosotros).toBe('podamos')
  })
  it('gives -ir stem-changers i / u in nosotros', () => {
    expect(subj('dormir').nosotros).toBe('durmamos')
    expect(subj('sentirse').nosotros).toBe('nos sintamos')
    expect(subj('preferir').nosotros).toBe('prefiramos')
    expect(subj('pedir').nosotros).toBe('pidamos')
    expect(subj('seguir').yo).toBe('siga')
    expect(subj('seguir').nosotros).toBe('sigamos')
    expect(subj('adquirir').nosotros).toBe('adquiramos')
    expect(subj('elegir')).toEqual({ yo: 'elija', tu: 'elijas', el: 'elija', nosotros: 'elijamos', ellos: 'elijan' })
  })
  it('drops the written accent of the yo stem in nosotros', () => {
    expect(subj('confiar').yo).toBe('confíe')
    expect(subj('confiar').nosotros).toBe('confiemos')
  })
  it('knows the irregular verbs', () => {
    expect(subj('ser').yo).toBe('sea')
    expect(subj('ir').nosotros).toBe('vayamos')
    expect(subj('estar')).toEqual({ yo: 'esté', tu: 'estés', el: 'esté', nosotros: 'estemos', ellos: 'estén' })
    expect(subj('saber').el).toBe('sepa')
    expect(subj('dar')).toEqual({ yo: 'dé', tu: 'des', el: 'dé', nosotros: 'demos', ellos: 'den' })
  })
  it('puts the pronoun of a reflexive verb first', () => {
    expect(subj('levantarse').tu).toBe('te levantes')
  })
})

describe('subjuntivo imperfecto and condicional', () => {
  it('builds the imperfect subjunctive from preterite ellos', () => {
    expect(deriveSubjImperfecto(v('tener'))).toEqual({ yo: 'tuviera', tu: 'tuvieras', el: 'tuviera', nosotros: 'tuviéramos', ellos: 'tuvieran' })
    expect(deriveSubjImperfecto(v('hablar')).nosotros).toBe('habláramos')
    expect(deriveSubjImperfecto(v('ser')).yo).toBe('fuera')
    expect(deriveSubjImperfecto(v('levantarse')).yo).toBe('me levantara')
  })
  it('builds the conditional from the future stem', () => {
    expect(deriveCondicional(v('tener'))).toEqual({ yo: 'tendría', tu: 'tendrías', el: 'tendría', nosotros: 'tendríamos', ellos: 'tendrían' })
    expect(deriveCondicional(v('hablar')).yo).toBe('hablaría')
    expect(deriveCondicional(v('decir')).yo).toBe('diría')
  })
})

describe('imperativo', () => {
  const imp = (id: string) => deriveImperativo(v(id), subj(id))
  it('takes él of the present for tú and the subjunctive for the others', () => {
    expect(imp('hablar')).toEqual({ tu: 'habla', el: 'hable', nosotros: 'hablemos', ellos: 'hablen' })
    expect(imp('pensar').tu).toBe('piensa')
  })
  it('knows the short tú forms and their compounds', () => {
    expect(['tener', 'venir', 'poner', 'salir', 'hacer', 'decir', 'ir', 'ser'].map((id) => imp(id).tu)).toEqual(['ten', 'ven', 'pon', 'sal', 'haz', 'di', 've', 'sé'])
    expect(imp('mantener').tu).toBe('mantén')
    expect(imp('proponer').tu).toBe('propón')
    expect(imp('prevenir').tu).toBe('prevén')
  })
  it('attaches the pronoun of a reflexive verb with the written accent', () => {
    expect(imp('levantarse')).toEqual({ tu: 'levántate', el: 'levántese', nosotros: 'levantémonos', ellos: 'levántense' })
    expect(imp('sentarse').tu).toBe('siéntate')
    expect(imp('ponerse')).toEqual({ tu: 'ponte', el: 'póngase', nosotros: 'pongámonos', ellos: 'pónganse' })
    expect(imp('caerse').tu).toBe('cáete')
    expect(imp('equivocarse').el).toBe('equivóquese')
    expect(imp('preocuparse').el).toBe('preocúpese')
    expect(imp('vestirse').tu).toBe('vístete')
  })
  it('places accents by syllable', () => {
    expect(attachPronoun('ve', 'te')).toBe('vete')
    expect(attachPronoun('acueste', 'se')).toBe('acuéstese')
    expect(attachPronoun('caiga', 'se')).toBe('cáigase')
  })
})

describe('participle', () => {
  it('is -ado / -ido, -ído after a vowel, irregular where it must be', () => {
    expect(deriveParticiple(v('hablar'))).toBe('hablado')
    expect(deriveParticiple(v('comer'))).toBe('comido')
    expect(deriveParticiple(v('leer'))).toBe('leído')
    expect(deriveParticiple(v('construir'))).toBe('construido')
    expect(
      ['hacer', 'decir', 'ver', 'escribir', 'poner', 'volver', 'abrir', 'romper', 'morir', 'resolver', 'devolver', 'proponer', 'suponer', 'inscribirse'].map((id) =>
        deriveParticiple(v(id)),
      ),
    ).toEqual(['hecho', 'dicho', 'visto', 'escrito', 'puesto', 'vuelto', 'abierto', 'roto', 'muerto', 'resuelto', 'devuelto', 'propuesto', 'supuesto', 'inscrito'])
    expect(deriveParticiple(v('levantarse'))).toBe('levantado')
  })
})

describe('regular pattern', () => {
  it('is the infinitive stem with the group endings', () => {
    expect(regularNew(v('tener'), 'subjuntivo', 'yo')).toBe('tena')
    expect(regularNew(v('hablar'), 'subjImperfecto', 'nosotros')).toBe('habláramos')
    expect(regularNew(v('tener'), 'condicional', 'yo')).toBe('tenería')
  })
})
