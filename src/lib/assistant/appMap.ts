import { sentences, tips, topics, verbs, words } from '../../data'
import { t } from '../../i18n'
import { TABLE_TENSES } from '../conjugate'
import { EXERCISE_TYPES } from '../exerciseOrder'
import { localizedTip, topicName } from '../localized'
import { guideText } from './appGuide'

// What the app holds right now, for the assistant's system prompt (api/chat.ts puts it in <mapa_appky>): the guide,
// and lists generated from the bundled data, so new content and screens reach the model without editing a prompt.

/** What this device offers; read in context.ts (appFlags), so this file stays free of browser-only modules. */
export interface AppFlags {
  duels: boolean
  accounts: boolean
  reminders: boolean
}

const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const
const yesNo = (value: boolean) => (value ? 'áno' : 'nie')

export function buildAppMap(flags: AppFlags): string {
  const types = t().exercise.types
  const exercises = EXERCISE_TYPES.map((type) => `- ${type}: ${types[type].label} – ${types[type].description} (/practice?type=${type})`)
  const topicLines = topics.map((topic) => {
    const perLevel = LEVELS.map((level) => `${level} ${words.filter((w) => w.level === level && w.topics.includes(topic.id)).length}`).join(', ')
    return `- ${topic.id}: ${topicName(topic)} (slová ${perLevel}) /topic/${topic.id}`
  })
  const tipLines = LEVELS.flatMap((level) =>
    tips
      .map(localizedTip)
      .filter((tip) => tip.level === level)
      .map((tip) => `- ${tip.id} · ${level} · ${tip.title}`),
  )
  const perLevel = LEVELS.map((level) => `${level} ${words.filter((w) => w.level === level).length}`).join(', ')
  return [
    '# Obrazovky a funkcie',
    guideText(),
    '# Cvičenia (typ: názov – čo robí, adresa)',
    ...exercises,
    '# Témy (id: názov, počet slov podľa úrovne, adresa)',
    ...topicLines,
    '# Gramatické tipy (id · úroveň · názov), adresa /practice/grammar/<id>',
    ...tipLines,
    '# Obsah',
    `Slová: ${words.length} (${perLevel}); slovesá: ${verbs.length}; vety: ${sentences.length}. Časy v tabuľke časovania a v cvičení Časovanie: ${TABLE_TENSES.join(', ')}.`,
    '# Dostupné na tomto zariadení',
    `Účty: ${yesNo(flags.accounts)}, Duel: ${yesNo(flags.duels)}, pripomienky: ${yesNo(flags.reminders)}.`,
  ].join('\n')
}
