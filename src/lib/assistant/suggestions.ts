import { tipById, wordById } from '../../data'
import { localizedTip } from '../localized'

// Questions offered as chips in an empty chat, by the page SOMO was opened on (docs/chat-assistant-improvements.md F2):
// they lead to what SOMO answers well from the app's data. The texts live in i18n (assistant.suggest).

export type Suggestion =
  | { kind: 'useWord' | 'conjugate' | 'whenWord'; name: string }
  | { kind: 'tipSimpler' | 'tipExamples'; name: string }
  | { kind: 'today' | 'progress' | 'serEstar' | 'mistakes' }

/** Two questions for the page at `pathname` (no page: the general ones). */
export function suggestionsFor(pathname = ''): Suggestion[] {
  const [, first, second, third] = pathname.split('/')
  if (first === 'word' && second) {
    const word = wordById.get(second)
    if (word) return [{ kind: 'useWord', name: word.es }, word.pos === 'verb' ? { kind: 'conjugate', name: word.es } : { kind: 'whenWord', name: word.es }]
  }
  if (first === 'practice' && second === 'grammar' && third) {
    const tip = tipById.get(third)
    if (tip) {
      const name = localizedTip(tip).title
      return [{ kind: 'tipSimpler', name }, { kind: 'tipExamples', name }]
    }
  }
  if (first === 'archive' || first === 'stats' || (first === 'profile' && second === 'stats')) return [{ kind: 'mistakes' }, { kind: 'today' }]
  // Two at most: three chips and "continue the last conversation" crowded the empty chat (Adam, 2026-11-19).
  return [{ kind: 'today' }, { kind: 'serEstar' }]
}
