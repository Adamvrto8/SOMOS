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

/** Spanish collation, so "ñ" sorts after "n" and accents don't break order. */
export function compareEs(a: string, b: string): number {
  return a.localeCompare(b, 'es', { sensitivity: 'base' })
}
