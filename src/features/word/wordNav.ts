/**
 * Router state carried into the word detail: the list the word was opened from
 * (topic, search results, archive), so the detail can swipe to its neighbours.
 */
export interface WordNavState {
  wordList: string[]
  /** Direction of the last swipe, for the slide-in animation. */
  dir?: 'next' | 'prev'
}

export function readWordNav(state: unknown): WordNavState | undefined {
  if (typeof state !== 'object' || state === null || !('wordList' in state)) return undefined
  const { wordList, dir } = state as Partial<WordNavState>
  if (!Array.isArray(wordList) || !wordList.every((id) => typeof id === 'string')) return undefined
  return { wordList, dir: dir === 'next' || dir === 'prev' ? dir : undefined }
}
