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

export const SCREEN = { width: 375, height: 800 }
/**
 * The screen with the phone keyboard open. index.html asks Chrome on Android to shrink the page
 * for the keyboard (interactive-widget=resizes-content), which to the page is a shorter viewport.
 */
export const KEYBOARD_OPEN = { width: 375, height: 460 }

/** How far above the bottom edge of the viewport something ends, in px (0 = touching it). */
export async function gapAboveBottom(page: Page, target: Locator): Promise<number> {
  const box = (await target.boundingBox())!
  return page.viewportSize()!.height - (box.y + box.height)
}

/**
 * The sentence a task is asking for, found by its Slovak text on screen.
 * `ready` is what shows that the task is there: the text field, or the tiles / options of a task without one.
 */
export async function askedSentence(page: Page, ready: Locator = field(page)): Promise<Sentence> {
  await expect(ready).toBeVisible()
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

/**
 * Answers in the past: `perDay[daysAgo]` answers on that day (0 = today), two of three right,
 * every fifth a review. The page has to be open already, so the database exists; it is reloaded.
 */
export async function seedAttempts(page: Page, perDay: Record<number, number>): Promise<void> {
  await page.evaluate(async (counts) => {
    const open = indexedDB.open('somos')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const tx = db.transaction('attempts', 'readwrite')
    for (const [daysAgo, count] of Object.entries(counts)) {
      for (let i = 0; i < count; i++) {
        const at = new Date()
        at.setDate(at.getDate() - Number(daysAgo))
        at.setHours(10, i % 60, 0, 0)
        tx.objectStore('attempts').add({ exercise: i % 5 === 4 ? 'review' : 'vocab', itemId: `seed-${daysAgo}-${i}`, correct: i % 3 !== 0, at: at.getTime() })
      }
    }
    await new Promise((resolve) => (tx.oncomplete = resolve))
    db.close()
  }, perDay)
  await page.reload()
}
