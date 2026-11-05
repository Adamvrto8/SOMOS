import type { Variant } from './applyVariant'

// Which Spanish the learner studies. Read once when the data loads (src/data/index.ts), so a change needs a reload.
export const VARIANT_KEY = 'somos.variant'

export function readVariant(): Variant {
  try {
    return localStorage.getItem(VARIANT_KEY) === 'es' ? 'es' : 'mx'
  } catch {
    return 'mx'
  }
}

export function writeVariant(variant: Variant) {
  try {
    localStorage.setItem(VARIANT_KEY, variant)
  } catch {
    /* private mode: the choice just does not stick */
  }
}
