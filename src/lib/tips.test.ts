import { describe, expect, it } from 'vitest'
import { sentences, tipById, verbById, verbs } from '../data'
import { personsOf, TABLE_TENSES } from './conjugate'
import { conjugationTask, gradeTask, taskFromItem, type ExerciseType, type Grade, type Task } from './lesson'
import type { Cloze, Sentence } from '../data/types'
import { tipFor, tipForCloze, tipForHint, tipIdOfTense, tipLabel } from './tips'

const WRONG: Grade = { correct: false, verdict: 'wrong', expected: '' }

function task(exercise: ExerciseType, itemId: string): Task {
  const found = taskFromItem(exercise, itemId)
  if (!found) throw new Error(`no task ${exercise} ${itemId}`)
  return found
}
const tipOf = (exercise: ExerciseType, itemId: string) => tipFor(task(exercise, itemId), WRONG)

describe('tipFor', () => {
  it('gives a ser/estar cloze its tip and the reason of that sentence', () => {
    const found = tipOf('cloze', 's063#0') // "Somos de Eslovaquia."
    expect(found?.tip.id).toBe('ser-estar')
    expect(found?.rule?.id).toBe('origin')
    expect(found?.rule?.because).toContain('ser')
    expect(found?.targeted).toBe(true)
    // The same blank as a multiple choice.
    expect(tipOf('choice', 's063#0')?.rule?.id).toBe('origin')
  })

  it.each([
    ['s378#0', 'preterito', 'ar'], // "llegar · tú · pretérito"
    ['s458#0', 'imperfecto', 'er-ir'], // "tener · yo · imperfecto"
    ['s254#0', 'progresivo', 'gerund'], // "hacer · gerundio"
    ['s242#0', 'articles', 'definite'], // "člen"
    ['s249#0', 'adjectives', 'plural'], // "prídavné meno: cansado" → cansados
  ])('reads the tip of cloze %s from its hint: %s, rule %s', (itemId, tipId, ruleId) => {
    const found = tipOf('cloze', itemId)
    expect(found?.tip.id).toBe(tipId)
    expect(found?.targeted).toBe(true)
    expect(found?.rule?.id).toBe(ruleId)
    expect(found?.because).toBeTruthy()
  })

  // "Prečo?" has to answer for this very form: the rule that makes it what it is.
  it.each([
    ['hablar', 'presente', 'yo', 'ar'],
    ['querer', 'presente', 'yo', 'stem'], // quiero
    ['querer', 'presente', 'nosotros', 'er-ir'], // queremos: no change there
    ['tener', 'presente', 'yo', 'yo'], // tengo
    ['tener', 'presente', 'tu', 'stem'], // tienes
    ['hacer', 'presente', 'yo', 'yo'], // hago
    ['seguir', 'presente', 'yo', 'stem'], // sigo: e → i, not a special yo
    ['jugar', 'presente', 'yo', 'stem'], // juego
    ['ser', 'presente', 'el', 'irregular'],
    ['estar', 'presente', 'yo', 'irregular'],
    ['tener', 'preterito', 'yo', 'stems'], // tuve
    ['ir', 'preterito', 'el', 'ser-ir'], // fue
    ['llegar', 'preterito', 'yo', 'spelling'], // llegué
    ['llegar', 'preterito', 'tu', 'ar'],
    ['pedir', 'preterito', 'el', 'third'], // pidió
    ['pedir', 'preterito', 'yo', 'er-ir'], // pedí
    ['leer', 'preterito', 'ellos', 'third'], // leyeron
    ['ver', 'preterito', 'yo', 'er-ir'], // vi: only the accent is missing
    ['ser', 'imperfecto', 'yo', 'irregular'],
    ['hablar', 'imperfecto', 'yo', 'ar'],
    ['tener', 'futuro', 'yo', 'stems'], // tendré
    ['hablar', 'futuro', 'yo', 'endings'],
    ['hablar', 'progresivo', 'yo', 'form'],
    ['dormir', 'progresivo', 'yo', 'irregular'], // durmiendo
  ] as const)('explains %s · %s · %s with the rule "%s"', (verbId, tense, person, ruleId) => {
    const found = tipFor(conjugationTask(verbById.get(verbId)!, tense, person), WRONG)
    expect(found?.tip.id).toBe(tense)
    expect(found?.rule?.id).toBe(ruleId)
    expect(found?.because).toContain(verbId === 'ir' ? 'ser a ir' : verbId)
  })

  it('has a rule and a reason for every form of every verb', () => {
    for (const verb of verbs) {
      for (const tense of TABLE_TENSES) {
        for (const person of personsOf(tense)) {
          const found = tipFor(conjugationTask(verb, tense, person), WRONG)
          expect(found?.rule, `${verb.id} ${tense} ${person}`).toBeDefined()
          expect(found?.because, `${verb.id} ${tense} ${person}`).toBeTruthy()
        }
      }
    }
  })

  it('sends el before a feminine noun to the rule about it, not to "el is masculine"', () => {
    const found = tipOf('cloze', 's107#0') // "El agua de jamaica es muy refrescante."
    expect(found?.tip.id).toBe('gender')
    expect(found?.rule?.id).toBe('a-tonica')
    expect(found?.because).toContain('agua')
  })

  it('has no tip for a blank that asks for vocabulary', () => {
    expect(tipOf('cloze', 's243#0')).toBeUndefined() // hint "oči"
  })

  it.each(TABLE_TENSES)('gives a conjugation task the tip of its tense: %s', (tense) => {
    const found = tipFor(conjugationTask(verbById.get('hablar')!, tense, personsOf(tense)[0]), WRONG)
    expect(found?.tip.id).toBe(tipIdOfTense(tense))
    expect(found?.targeted).toBe(true)
  })

  it.each([
    ['tener', 'subjuntivo', 'yo', 'yo-stem'],
    ['pensar', 'subjuntivo', 'el', 'stem'],
    ['ser', 'subjuntivo', 'yo', 'irregular'],
    ['hablar', 'subjuntivo', 'tu', 'ar'],
    ['comer', 'subjuntivo', 'tu', 'er-ir'],
    ['buscar', 'subjuntivo', 'yo', 'spelling'],
    ['dormir', 'subjuntivo', 'nosotros', 'stem'],
    ['pensar', 'imperativo', 'tu', 'tu'],
    ['tener', 'condicional', 'yo', 'stems'],
    ['hablar', 'condicional', 'yo', 'endings'],
    ['decir', 'imperativo', 'tu', 'tu-irregular'],
    ['mantener', 'imperativo', 'tu', 'tu-irregular'],
    ['hablar', 'imperativo', 'tu', 'tu'],
    ['hablar', 'imperativo', 'el', 'usted'],
    ['levantarse', 'imperativo', 'tu', 'pronouns'],
    ['hacer', 'pluscuamperfecto', 'yo', 'participle'],
    ['hablar', 'pluscuamperfecto', 'yo', 'form'],
    ['tener', 'subjImperfecto', 'yo', 'formation'],
  ] as const)('explains %s · %s · %s by the rule %s', (verbId, tense, person, rule) => {
    const found = tipFor(conjugationTask(verbById.get(verbId)!, tense, person), WRONG)
    expect(found?.rule?.id).toBe(rule)
    expect(found?.because).toContain(verbId)
  })

  it('gives every tip a level and a source', () => {
    for (const tip of tipById.values()) {
      expect(tip.level, tip.id).toMatch(/^(A1|A2|B1|B2)$/)
      expect(tip.sources.length, tip.id).toBeGreaterThan(0)
    }
  })

  it('gives a whole sentence its main grammar topic, without claiming to explain the mistake', () => {
    // s520 is tagged imperfecto, preterito, ser-estar: ser/estar is the one most worth explaining.
    for (const exercise of ['translation', 'builder', 'dictation', 'speaking'] as const) {
      const found = tipOf(exercise, 's520')
      expect(found?.tip.id).toBe('ser-estar')
      expect(found?.targeted).toBe(false)
      expect(found?.rule).toBeUndefined()
    }
    expect(tipOf('translation', 's378')?.tip.id).toBe('preterito')
    expect(tipOf('translation', 's372')).toBeUndefined() // no grammar tags
  })

  it('has no tip for vocabulary', () => {
    expect(tipOf('vocab', 'de-nada:es-sk')).toBeUndefined()
  })

  it('explains an accent that changed the meaning before anything else', () => {
    const drill = conjugationTask(verbById.get('hablar')!, 'preterito', 'el') // habló
    const grade = gradeTask(drill, 'hablo')
    expect(grade.check?.meanings).toBeDefined()
    expect(tipFor(drill, grade)?.tip.id).toBe('accents')
    expect(tipFor(drill, grade)?.targeted).toBe(true)
    expect(tipFor(drill, grade)?.rule?.id).toBe('verbs')
    expect(tipFor(drill, grade)?.because).toMatch(/hablo = .+, habló = .+\./)
  })

  it('finds a rule for every ser/estar cloze of the dataset and a tip wherever it promises one', () => {
    for (const sentence of sentences) {
      sentence.cloze?.forEach((cloze, i) => {
        const found = tipOf('cloze', `${sentence.id}#${i}`)
        if (cloze.hint?.startsWith('ser/estar')) expect(found?.rule, sentence.id).toBeDefined()
        // "Prečo?" never opens a bare handbook: it says why, and marks the rule.
        if (found) {
          expect(found.rule, sentence.id).toBeDefined()
          expect(found.because, sentence.id).toBeTruthy()
        }
        if (found) expect(tipById.get(found.tip.id), sentence.id).toBe(found.tip)
      })
      for (const tag of sentence.grammar ?? []) expect(tipById.has(tag), tag).toBe(true)
    }
  })
})

describe('tipLabel', () => {
  it('asks "Prečo?" only when the tip is about the thing that was asked', () => {
    expect(tipLabel(tipOf('cloze', 's063#0')!)).toBe('Prečo?')
    expect(tipLabel(tipOf('translation', 's378')!)).toBe('Gramatika k vete')
  })
})

describe('usage blanks', () => {
  const blank: Cloze = { tokenIndex: 2, answer: 'para', lemma: 'para', hint: 'por/para', tip: 'por-para', why: 'para', distractors: ['por', 'de'] }
  const sentence: Sentence = {
    id: 's9999',
    es: 'Estudio mucho para aprender.',
    sk: 'x',
    level: 'B1',
    topics: ['school'],
    grammar: ['por-para', 'presente'],
    tokens: ['Estudio', 'mucho', 'para', 'aprender', '.'],
    cloze: [blank],
  }

  it('open their tip at their rule with its reason', () => {
    const found = tipForCloze(sentence, blank)
    expect(found?.tip.id).toBe('por-para')
    expect(found?.rule?.id).toBe('para')
    expect(found?.because).toBeTruthy()
    expect(found?.targeted).toBe(true)
  })

  it('a subjunctive with a full hint explains the use, its hint still the form', () => {
    const wish: Cloze = { tokenIndex: 2, answer: 'vengas', lemma: 'venir', hint: 'venir · tú · subjuntivo', tip: 'subjuntivo-wishes', why: 'wish', distractors: ['vienes', 'vendrás'] }
    const s: Sentence = { ...sentence, es: 'Quiero que vengas.', grammar: ['subjuntivo-wishes', 'subjuntivo'], tokens: ['Quiero', 'que', 'vengas', '.'], cloze: [wish] }
    expect(tipForCloze(s, wish)?.tip.id).toBe('subjuntivo-wishes')
    expect(tipForHint(s, wish)?.tip.id).toBe('subjuntivo')
  })

  it('an ir a blank opens the ir-a tip, not the presente its hint names', () => {
    const voy: Cloze = { tokenIndex: 1, answer: 'voy', lemma: 'ir', hint: 'ir · yo · presente', tip: 'ir-a', why: 'forms', distractors: ['va', 'vamos'] }
    const s: Sentence = { ...sentence, es: 'Mañana voy a estudiar.', level: 'A2', grammar: ['ir-a'], tokens: ['Mañana', 'voy', 'a', 'estudiar', '.'], cloze: [voy] }
    expect(tipForCloze(s, voy)?.tip.id).toBe('ir-a')
    expect(tipForCloze(s, voy)?.rule?.id).toBe('forms')
  })

  it('a nadie blank opens negation, an a before a person opens personal-a', () => {
    const nadie: Cloze = { tokenIndex: 1, answer: 'veo', lemma: 'ver', hint: 'ver · yo · presente' }
    const blank: Cloze = { tokenIndex: 3, answer: 'nadie', lemma: 'nadie', hint: 'nikto', tip: 'negation', why: 'double', distractors: ['nada', 'alguien'] }
    const s: Sentence = { ...sentence, es: 'No veo a nadie.', level: 'A2', grammar: ['presente', 'negation'], tokens: ['No', 'veo', 'a', 'nadie', '.'], cloze: [nadie, blank] }
    expect(tipForCloze(s, blank)?.tip.id).toBe('negation')
    expect(tipForCloze(s, blank)?.rule?.id).toBe('double')
    const a: Cloze = { tokenIndex: 2, answer: 'a', lemma: 'a', hint: 'predložka', tip: 'personal-a', why: 'person', distractors: ['de', 'en'] }
    const t: Sentence = { ...s, grammar: ['presente', 'personal-a'], cloze: [a] }
    expect(tipForCloze(t, a)?.tip.id).toBe('personal-a')
    expect(tipForCloze(t, a)?.rule?.id).toBe('person')
  })

  it('every blank on the new A1–A2 tips names a rule of its tip', () => {
    for (const s of sentences)
      for (const c of s.cloze ?? [])
        if (c.tip && ['demonstratives', 'possessives', 'interrogatives', 'negation', 'personal-a'].includes(c.tip))
          expect(tipForCloze(s, c)?.rule?.id, `${s.id} ${c.answer}`).toBe(c.why)
  })

  it('an aunque blank opens the B2 tip it moved to', () => {
    const aunque: Cloze = { tokenIndex: 1, answer: 'llueva', lemma: 'llover', hint: 'llover · él · subjuntivo', tip: 'subjuntivo-aunque', why: 'aunque' }
    const s: Sentence = { ...sentence, es: 'Aunque llueva, salgo.', level: 'B2', grammar: ['subjuntivo-aunque', 'subjuntivo'], tokens: ['Aunque', 'llueva', ',', 'salgo', '.'], cloze: [aunque] }
    expect(tipForCloze(s, aunque)?.tip.id).toBe('subjuntivo-aunque')
    expect(tipForCloze(s, aunque)?.tip.level).toBe('B2')
  })

  it('sends every blank of a split tip to the tip that now holds its rule', () => {
    for (const s of sentences)
      for (const c of s.cloze ?? []) {
        if (!c.tip || !c.why) continue
        const found = tipForCloze(s, c)
        expect(found?.tip.id, s.id).toBe(c.tip)
        expect(found?.rule?.id, s.id).toBe(c.why)
      }
  })

  it('a hint without tense points nowhere by itself', () => {
    const si: Cloze = { tokenIndex: 0, answer: 'leería', lemma: 'leer', hint: 'leer · yo', tip: 'si-clauses', why: 'unreal' }
    expect(tipForHint({ ...sentence, cloze: [si] }, si)).toBeUndefined()
    expect(tipForCloze({ ...sentence, cloze: [si] }, si)?.rule?.id).toBe('unreal')
  })
})
