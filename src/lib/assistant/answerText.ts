export type AnswerPart = { type: 'text'; text: string } | { type: 'link'; label: string; to: string }

// The prompt asks for links woven into the sentence as `[label](/path)`. A bare path the model still writes
// (`/word/casa`) becomes a link too, so nothing in-app is left untappable. A path is an app path: one slash,
// then no second one (never `//host`), and no dots, so a full stop after it stays text.
const MARKDOWN_LINK = String.raw`\[([^\]\n]+)\]\((\/(?!\/)[\w\-/?=&%]*)\)`
const BARE_PATH = String.raw`(?<![\w/])(\/(?:word|topic|practice|review|diary|search|archive|profile|stats|path|privacy)(?![\w-])[\w\-/?=&%]*)`
const LINKS = new RegExp(`${MARKDOWN_LINK}|${BARE_PATH}`, 'g')

/** Bold markers go: the prompt asks for no Markdown, but a model slips. */
const unbold = (text: string) => text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1')

/** An answer as text and in-app links, in order. */
export function answerParts(text: string): AnswerPart[] {
  const plain = unbold(text)
  const parts: AnswerPart[] = []
  let last = 0
  for (const match of plain.matchAll(LINKS)) {
    const [whole, label, labelled, bare] = match
    if (match.index > last) parts.push({ type: 'text', text: plain.slice(last, match.index) })
    parts.push(labelled !== undefined ? { type: 'link', label: label.trim(), to: labelled } : { type: 'link', label: bare, to: bare })
    last = match.index + whole.length
  }
  if (last < plain.length) parts.push({ type: 'text', text: plain.slice(last) })
  return parts
}
