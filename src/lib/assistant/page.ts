import { tipById, topicById, wordById } from '../../data'
import { localizedTip, topicName, wordTranslations } from '../localized'
import { GUIDE } from './appGuide'
import { MAX_PAGE_CHARS } from './limits'

/**
 * What the learner is looking at when they open SOMO, in one line for the model: "toto slovo" on a word's page then
 * means that word. Words, tips and topics are named; any other screen by its section of the app guide.
 */
export function describePage(pathname: string, search = ''): string {
  const [, first, second, third] = pathname.split('/')
  const where = `${pathname}${search}`
  let text: string
  if (first === 'word' && second) {
    const word = wordById.get(second)
    text = word ? `Detail slova „${word.es}“ (${wordTranslations(word).join(', ')}), ${where}` : `Detail slova, ${where}`
  } else if (first === 'practice' && second === 'grammar' && third) {
    const tip = tipById.get(third)
    text = tip ? `Gramatický tip „${localizedTip(tip).title}“ (úroveň ${tip.level}), ${where}` : `Gramatický tip, ${where}`
  } else if (first === 'topic' && second) {
    const topic = topicById.get(second)
    text = topic ? `Téma „${topicName(topic)}“, ${where}` : `Téma, ${where}`
  } else {
    // Navigácia lists every tab: the screen's own section names it better.
    const section = GUIDE.find((s) => s.id !== 'navigacia' && s.links.some((link) => link.split('?')[0] === pathname))
    text = section ? `Obrazovka „${section.title}“, ${where}` : `Obrazovka ${where}`
  }
  return text.slice(0, MAX_PAGE_CHARS)
}
