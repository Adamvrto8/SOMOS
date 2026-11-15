/**
 * Plain text for an answer: the prompt asks for no Markdown, but a model slips. Bold markers go, and a Markdown link
 * `[label](/word/casa)` becomes the bare path, which the screen turns into an in-app link.
 */
export function plainAnswer(text: string): string {
  return text
    .replace(/\[[^\]]*\]\((\/[^)\s]*)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
}
