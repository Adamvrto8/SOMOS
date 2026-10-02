import { readdirSync, readFileSync } from 'node:fs'
import { expect, type Locator, type Page } from '@playwright/test'
import type { Sentence, Tip, Word } from '../src/data/types.ts'

// The content as the app bundles it, read from disk: the order of a lesson's tasks is shuffled,
// so a test looks up the answer to whatever the screen asks.
function load<T>(folder: string): T[] {
  const dir = new URL(`../src/data/${folder}/`, import.meta.url)
  return readdirSync(dir).flatMap((file) => JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as T[])
}
export const sentences = load<Sentence>('sentences')
export const words = load<Word>('words')
export const tips = JSON.parse(readFileSync(new URL('../src/data/tips.json', import.meta.url), 'utf8')) as Tip[]

export const field = (page: Page) => page.getByRole('textbox')
/** The hint of a wrong try, or the feedback sheet once the task is graded. */
export const status = (page: Page) => page.getByRole('status')
export const button = (scope: Page | Locator, name: string) => scope.getByRole('button', { name, exact: true })

/**
 * How far below the answer field something starts, in px. The open phone keyboard covers the lower
 * half of the screen, the bar at its bottom included: whatever is needed while typing has to sit
 * right under the field.
 */
export async function gapBelowField(page: Page, target: Locator): Promise<number> {
  const input = (await field(page).boundingBox())!
  const box = (await target.boundingBox())!
  return box.y - (input.y + input.height)
}

/** The sentence a cloze, translation or dictation task is asking for, found by its Slovak text on screen. */
export async function askedSentence(page: Page): Promise<Sentence> {
  await expect(field(page)).toBeVisible()
  const shown = await page.locator('main p').allInnerTexts()
  const sentence = sentences.find((s) => shown.includes(s.sk))
  if (!sentence) throw new Error(`no sentence on screen: ${shown.join(' | ')}`)
  return sentence
}

/** Counts the hint's shakes: the only thing to see when a check finds the same mistake again. */
export async function countShakes(page: Page): Promise<() => Promise<number>> {
  await page.addInitScript(() => {
    const animate = Element.prototype.animate
    const counter = window as unknown as { shakes: number }
    counter.shakes = 0
    Element.prototype.animate = function (...args) {
      counter.shakes++
      return animate.apply(this, args)
    }
  })
  return () => page.evaluate(() => (window as unknown as { shakes: number }).shakes)
}

interface Point {
  x: number
  y: number
}

/** A finger dragged across the screen (Playwright itself only taps). */
export async function swipe(page: Page, from: Point, to: Point): Promise<void> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
  for (let step = 1; step <= 5; step++) {
    const at = { x: from.x + ((to.x - from.x) * step) / 5, y: from.y + ((to.y - from.y) * step) / 5 }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at] })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}
