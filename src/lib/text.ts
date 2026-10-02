/** Lowercase and strip diacritics: "Hľadať" → "hladat", "mañana" → "manana". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** Slovak plural form: 1 slovo, 2–4 slová, 5+ slov. */
export function pluralSk(count: number, [one, few, many]: [string, string, string]): string {
  if (count === 1) return one
  if (count >= 2 && count <= 4) return few
  return many
}

/**
 * Whether sentence token `i` is written after a space. Same rules as the data validator:
 * no space before .,?!;: and none after ¿¡
 */
export function spaceBefore(tokens: string[], i: number): boolean {
  return i > 0 && !/^[.,!?;:]$/.test(tokens[i]) && !/^[¿¡]$/.test(tokens[i - 1])
}

/** Spanish collation, so "ñ" sorts after "n" and accents don't break order. */
export function compareEs(a: string, b: string): number {
  return a.localeCompare(b, 'es', { sensitivity: 'base' })
}
