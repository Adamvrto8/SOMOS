import type { WordMatch } from '../../../lib/speechMatch'

/** The sentence word by word: green = recognized, red = missed. */
export function SpeechWords({ words }: { words: WordMatch[] }) {
  return (
    <p lang="es" className="font-serif text-xl leading-relaxed">
      {words.map((w, i) => (
        <span key={i}>
          {i > 0 && ' '}
          <span className={w.heard ? 'text-leaf' : 'text-error underline decoration-2 underline-offset-4'}>{w.word}</span>
        </span>
      ))}
    </p>
  )
}
