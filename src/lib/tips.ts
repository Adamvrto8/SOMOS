import { tipById, verbById, words } from '../data'
import { t } from '../i18n'
import type { Cloze, Grammar, Person, Sentence, Tip, TipRule, Verb } from '../data/types'
import type { Meaning } from './checkAnswer'
import { isIrregular, type TableTense } from './conjugate'
import type { Grade, Task } from './lesson'
import { localizedTip } from './localized'
import { fold } from './text'

// Grammar tips ("Prečo?"): which tip explains a task that was answered wrong, which of its rules
// applies there, and why in this very task. Without the last two the tip is just a handbook page.

export interface TaskTip {
  tip: Tip
  rule?: TipRule // the rule of the tip that makes the answer what it is
  because?: string // … said for this task: "tener má v pretérite nepravidelný kmeň…"
  /** The tip is about the very thing that was asked ("Prečo?"), not just the sentence's topic. */
  targeted: boolean
}

/** A rule of the tip (by id) and the reason, for one task. */
interface Why {
  rule: string
  because: string
}

// A sentence can carry several tags; the one a learner most needs explained comes first.
const TAG_PRIORITY: Grammar[] = ['ser-estar', 'imperfecto', 'preterito', 'futuro', 'progresivo', 'gender', 'articles', 'presente']

const HINT_TENSES: Record<string, TableTense> = { presente: 'presente', pretérito: 'preterito', imperfecto: 'imperfecto', futuro: 'futuro' }
const HINT_PERSONS: Record<string, Person> = {
  yo: 'yo',
  tú: 'tu',
  él: 'el',
  ella: 'el',
  usted: 'el',
  nosotros: 'nosotros',
  ellos: 'ellos',
  ellas: 'ellos',
  ustedes: 'ellos',
}

const targeted = (id: string, why?: Why): TaskTip | undefined => {
  const tip = tipById.get(id)
  return tip && { tip, rule: tip.rules.find((r) => r.id === why?.rule), because: why?.because, targeted: true }
}

// ---------- verbs: which rule makes this form ----------

const groupRule = (verb: Verb) => (verb.group === 'ar' ? 'ar' : 'er-ir')

const regularWhy = (verb: Verb): Why => ({
  rule: groupRule(verb),
  because: verb.regular
    ? `${verb.id} je pravidelné sloveso na -${verb.group}.`
    : `Tento tvar slovesa ${verb.id} je pravidelný, ako pri ostatných slovesách na -${verb.group}.`,
})

function gerundWhy(verb: Verb, regularRule: 'form' | 'gerund'): Why {
  if (verb.gerundIrregular) return { rule: 'irregular', because: `${verb.id} má nepravidelné gerundium: ${verb.gerund}.` }
  if (regularRule === 'form') return { rule: 'form', because: `Pri slovese ${verb.id} sa časuje len estar, gerundium ${verb.gerund} sa nemení.` }
  const ending = verb.group === 'ar' ? '-ando' : '-iendo'
  return { rule: 'gerund', because: `${verb.id} je sloveso na -${verb.group}, gerundium sa končí na ${ending}: ${verb.gerund}.` }
}

function presenteWhy(verb: Verb, person: Person): Why {
  if (!isIrregular(verb, 'presente', person)) return regularWhy(verb)
  if (verb.irregularForms?.includes('presente.*') || verb.id === 'estar') {
    return { rule: 'irregular', because: `${verb.id} je v prítomnom čase úplne nepravidelné, tvary sa treba naučiť.` }
  }
  // tengo, digo, conozco, doy… but not sigo or juego, where the g belongs to the stem and the vowel changed.
  const onlyYo = !isIrregular(verb, 'presente', 'tu')
  const specialYo = /(go|zco|oy)$/.test(verb.presente.yo) && !/gu?(ar|er|ir)(se)?$/.test(verb.id)
  if (person === 'yo' && (onlyYo || specialYo)) return { rule: 'yo', because: `${verb.id} má nepravidelný tvar pre yo: ${verb.presente.yo}.` }
  return { rule: 'stem', because: `V slovese ${verb.id} sa v tomto tvare mení kmeň.` }
}

function preteritoWhy(verb: Verb, person: Person): Why {
  if (verb.id === 'ser' || verb.id === 'ir') return { rule: 'ser-ir', because: 'ser a ir majú v pretérite rovnaké, nepravidelné tvary.' }
  if (!isIrregular(verb, 'preterito', person)) return regularWhy(verb)
  if (verb.irregularForms?.includes('preterito.*')) {
    return { rule: 'stems', because: `${verb.id} patrí v pretérite medzi nepravidelné slovesá: koncovky sú bez prízvuku.` }
  }
  if (person === 'yo' && /[cgz]ar(se)?$/.test(verb.id)) {
    return { rule: 'spelling', because: `V slovese ${verb.id} sa pred koncovkou -é mení pravopis, aby ostala výslovnosť.` }
  }
  const thirdOnly = isIrregular(verb, 'preterito', 'el') && isIrregular(verb, 'preterito', 'ellos') && !isIrregular(verb, 'preterito', 'yo')
  if (thirdOnly && (person === 'el' || person === 'ellos')) {
    return { rule: 'third', because: `Sloveso ${verb.id} má v pretérite zmenu len v tvaroch él a ellos.` }
  }
  // leíste, vi: the endings of the group, only an accent more or less.
  return { rule: groupRule(verb), because: `Tento tvar slovesa ${verb.id} sa od pravidelného líši len prízvukom, treba si ho zapamätať.` }
}

/** The rule behind one conjugated form. */
function verbWhy(verb: Verb, tense: TableTense, person: Person): Why {
  switch (tense) {
    case 'presente':
      return presenteWhy(verb, person)
    case 'preterito':
      return preteritoWhy(verb, person)
    case 'imperfecto':
      return isIrregular(verb, 'imperfecto', person)
        ? { rule: 'irregular', because: `${verb.id} je jedno z troch slovies, ktoré sú v imperfecte nepravidelné.` }
        : regularWhy(verb)
    case 'futuro':
      return isIrregular(verb, 'futuro', person)
        ? { rule: 'stems', because: `${verb.id} má v budúcom čase nepravidelný kmeň, koncovky ostávajú.` }
        : { rule: 'endings', because: `Pri slovese ${verb.id} sa koncovka pridáva k celému neurčitku.` }
    case 'progresivo':
      return gerundWhy(verb, 'form')
  }
}

// ---------- articles, adjectives, accents ----------

const ARTICLES: Record<string, string> = {
  el: 'mužský rod, jednotné číslo',
  la: 'ženský rod, jednotné číslo',
  los: 'mužský rod, množné číslo',
  las: 'ženský rod, množné číslo',
  un: 'mužský rod, jednotné číslo',
  una: 'ženský rod, jednotné číslo',
  unos: 'mužský rod, množné číslo',
  unas: 'ženský rod, množné číslo',
}

/** el agua: a feminine noun that takes el. The gender tip explains it, not the one about articles. */
function feminineWithEl(sentence: Sentence, cloze: Cloze): TaskTip | undefined {
  const next = sentence.tokens[cloze.tokenIndex + 1]?.toLowerCase()
  if (cloze.answer.toLowerCase() !== 'el' || !words.some((w) => w.pos === 'noun' && w.gender === 'f' && w.es === next)) return undefined
  return targeted('gender', { rule: 'a-tonica', because: `Slovo ${next} je ženského rodu, ale začína sa prízvučným a-, preto má v jednotnom čísle člen el.` })
}

function articleWhy(answer: string): Why | undefined {
  const article = answer.toLowerCase()
  if (article === 'al') return { rule: 'contractions', because: 'Predložka a sa s členom el spája: a + el = al.' }
  if (article === 'del') return { rule: 'contractions', because: 'Predložka de sa s členom el spája: de + el = del.' }
  const form = ARTICLES[article]
  if (!form) return undefined
  return { rule: article.startsWith('u') ? 'indefinite' : 'definite', because: `Člen sa riadi podstatným menom: ${article} je ${form}.` }
}

/** "prídavné meno: cansado" → cansados */
function adjectiveWhy(hint: string, answer: string): Why | undefined {
  const base = hint.split(': ')[1]
  if (!base) return undefined
  const form = answer.toLowerCase()
  const plural = form.endsWith('s') && !base.endsWith('s')
  const number = plural ? 'množné číslo' : 'jednotné číslo'
  const start = 'Prídavné meno sa zhoduje s podstatným menom'
  if (!base.endsWith('o')) return { rule: plural ? 'plural' : 'same', because: `${start}: ${form} je ${number}, v rode sa nemení.` }
  const gender = /as?$/.test(form) ? 'ženský rod' : 'mužský rod'
  return { rule: plural ? 'plural' : 'o-a', because: `${start}: ${form} je ${gender}, ${number}.` }
}

const SHORT_PAIRS = new Set(['el', 'tu', 'mi', 'si', 'te', 'se', 'mas', 'de'])
const QUESTION_WORDS = new Set(['que', 'como', 'donde', 'adonde', 'cuando', 'quien', 'quienes', 'cual', 'cuanto', 'cuanta', 'cuantos', 'cuantas'])

/** An accent that made another word: both words with what they mean. */
function accentWhy(meanings: Meaning[]): Why {
  const word = fold(meanings[0]?.word ?? '')
  const rule = SHORT_PAIRS.has(word) ? 'pairs' : QUESTION_WORDS.has(word) ? 'questions' : meanings.some((m) => m.gloss.includes(' · ')) ? 'verbs' : 'nouns'
  return { rule, because: `Prízvuk tu mení význam: ${meanings.map((m) => `${m.word} = ${m.gloss}`).join(', ')}.` }
}

// ---------- tasks ----------

/** The tip a blank's hint points at: "tener · yo · pretérito", "hacer · gerundio", "člen"… */
function tipForCloze(sentence: Sentence, cloze: Cloze): TaskTip | undefined {
  const hint = cloze.hint ?? ''
  if (hint.startsWith('ser/estar ·')) {
    const tip = tipById.get('ser-estar')
    // The reason is said in the learner's language; the rule is found by its id in either.
    const rule = tip && localizedTip(tip).rules.find((r) => r.id === cloze.why)
    return targeted('ser-estar', rule?.because ? { rule: rule.id, because: rule.because } : undefined)
  }
  const parts = hint.split(' · ')
  const verb = verbById.get(cloze.lemma) ?? verbById.get(parts[0])
  if (parts.length === 3 && HINT_TENSES[parts[2]]) {
    const tense = HINT_TENSES[parts[2]]
    const person = HINT_PERSONS[parts[1]]
    return targeted(tense, verb && person ? verbWhy(verb, tense, person) : undefined)
  }
  if (parts.length === 2 && parts[1] === 'gerundio') return targeted('progresivo', verb && gerundWhy(verb, 'gerund'))
  if (hint === 'člen' || hint === 'neurčitý člen') return feminineWithEl(sentence, cloze) ?? targeted('articles', articleWhy(cloze.answer))
  if (hint.startsWith('prídavné meno')) return targeted('adjectives', adjectiveWhy(hint, cloze.answer))
  return undefined
}

function tipForSentence(sentence: Sentence): TaskTip | undefined {
  const tag = TAG_PRIORITY.find((t) => sentence.grammar?.includes(t))
  const tip = tag && tipById.get(tag)
  return tip ? { tip, targeted: false } : undefined
}

/** The tip to offer after a wrong answer, if there is one worth reading for this task. */
export function tipFor(task: Task, grade: Grade): TaskTip | undefined {
  // An accent that makes a different word (hablo / habló) is the mistake itself, whatever was asked.
  if (grade.check?.meanings) return targeted('accents', accentWhy(grade.check.meanings))
  switch (task.kind) {
    case 'cloze':
    case 'choice':
      return tipForCloze(task.sentence, task.cloze)
    case 'conjugation':
      return targeted(task.tense, verbWhy(task.verb, task.tense, task.person))
    case 'builder':
    case 'translation':
    case 'dictation':
    case 'speaking':
      return tipForSentence(task.sentence)
    case 'vocab':
      return undefined
  }
}

/** The link's text: "Prečo?" promises to explain the mistake, which only a targeted tip can. */
export const tipLabel = (found: TaskTip) => (found.targeted ? t().lesson.why : t().lesson.grammarOfSentence)
