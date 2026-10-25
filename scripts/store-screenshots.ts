// Screenshots and the feature graphic for the Google Play listing (docs/google-play-setup.md).
// Run with `npm run store:screenshots`: starts its own dev server, opens the installed Chrome as a phone,
// gives it a learner with two weeks of practice and writes android/store/<language>/*.png (committed).
import { mkdir, readdir, readFile } from 'node:fs/promises'
import { chromium, type Browser, type Page } from '@playwright/test'
import { createServer } from 'vite'

const PORT = 5197
const BASE = `http://localhost:${PORT}`
// 432 × 768 CSS pixels at 2.5 = 1080 × 1920, the size Google Play recommends for phone screenshots.
const PHONE = { width: 432, height: 768 }
const SCALE = 2.5
const LANGUAGES = ['sk', 'en'] as const
type Language = (typeof LANGUAGES)[number]

// Words that get a star, so Domov has cards to review.
const STARRED = ['casa', 'comer', 'tener', 'playa', 'carro', 'platicar']

interface Sentence {
  es: string
  sk: string
}
interface English {
  id: string
  en: string
}

async function loadSentences(): Promise<Sentence[]> {
  const dir = new URL('../src/data/sentences/', import.meta.url)
  const files = await readdir(dir)
  const lists = await Promise.all(files.map(async (file) => JSON.parse(await readFile(new URL(file, dir), 'utf8')) as Sentence[]))
  return lists.flat()
}

/** Slovak text → the same sentence; the English overlay maps the English text the same way. */
async function sentenceLookup(language: Language): Promise<Map<string, Sentence>> {
  const sentences = await loadSentences()
  const byText = new Map(sentences.map((s) => [s.sk, s]))
  if (language === 'en') {
    const dir = new URL('../src/data/en/sentences/', import.meta.url)
    const files = await readdir(dir).catch(() => [])
    const byId = new Map((sentences as (Sentence & { id: string })[]).map((s) => [s.id, s]))
    for (const file of files) {
      const overlay = JSON.parse(await readFile(new URL(file, dir), 'utf8')) as English[]
      for (const entry of overlay) {
        const sentence = byId.get(entry.id)
        if (sentence) byText.set(entry.en, sentence)
      }
    }
  }
  return byText
}

/** Two weeks of goal days and part of today's goal, like e2e/helpers.ts seedAttempts. */
async function seedPractice(page: Page) {
  await page.evaluate(async () => {
    const open = indexedDB.open('somos')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const tx = db.transaction('attempts', 'readwrite')
    for (let daysAgo = 0; daysAgo <= 14; daysAgo++) {
      const count = daysAgo === 0 ? 20 : 40 + ((daysAgo * 7) % 13)
      for (let i = 0; i < count; i++) {
        const at = new Date()
        at.setDate(at.getDate() - daysAgo)
        at.setHours(daysAgo === 0 ? 8 : 19, i % 60, 0, 0)
        const exercise = ['vocab', 'cloze', 'builder', 'translation', 'review'][i % 5]
        tx.objectStore('attempts').add({ exercise, itemId: `seed-${daysAgo}-${i}`, correct: i % 6 !== 0, at: at.getTime() })
      }
    }
    await new Promise((resolve) => (tx.oncomplete = resolve))
    db.close()
  })
}

async function shoot(page: Page, language: Language, name: string) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400) // entry animations
  const path = `android/store/${language}/${name}.png`
  await page.screenshot({ path })
  console.log(path)
}

async function screenshots(browser: Browser, language: Language) {
  const context = await browser.newContext({
    baseURL: BASE,
    viewport: PHONE,
    deviceScaleFactor: SCALE,
    hasTouch: true,
    isMobile: true,
    locale: language === 'sk' ? 'sk-SK' : 'en-US',
    storageState: {
      cookies: [],
      origins: [
        {
          origin: BASE,
          localStorage: [
            { name: 'somos-onboarding', value: '{"done":true}' },
            { name: 'somos-language', value: language },
            { name: 'somos-daily-goal', value: '30' },
            { name: 'somos-usage-off', value: '1' },
          ],
        },
      ],
    },
  })
  const page = await context.newPage()
  const text = language === 'sk' ? { save: 'Uložiť do archívu', check: 'Skontrolovať' } : { save: 'Save to the archive', check: 'Check' }

  await page.goto('/')
  await seedPractice(page)
  for (const id of STARRED) {
    await page.goto(`/word/${id}`)
    await page.getByRole('button', { name: text.save, exact: true }).tap()
  }

  await page.goto('/')
  await shoot(page, language, '1-home')

  await page.goto('/practice/lesson?type=translation&topic=all&level=A1&lesson=1')
  const sentences = await sentenceLookup(language)
  await page.getByRole('textbox').waitFor()
  const shown = await page.locator('main p').allInnerTexts()
  const sentence = shown.map((t) => sentences.get(t)).find(Boolean)
  if (!sentence) throw new Error(`no sentence on screen: ${shown.join(' | ')}`)
  await page.getByRole('textbox').fill(sentence.es)
  await page.getByRole('button', { name: text.check, exact: true }).tap()
  await page.getByRole('status').waitFor()
  await shoot(page, language, '2-lesson')

  await page.goto('/word/tener')
  await shoot(page, language, '3-word')
  // The whole conjugation table, its heading at the top.
  await page.locator('#conjugation-heading').evaluate((heading) => heading.scrollIntoView({ block: 'start' }))
  await page.evaluate(() => window.scrollBy(0, -80)) // below the sticky header
  await shoot(page, language, '4-conjugation')

  await page.goto('/search')
  await shoot(page, language, '5-search')

  await page.goto('/practice')
  await shoot(page, language, '6-practice')

  await page.goto('/stats')
  await shoot(page, language, '7-stats')

  await page.evaluate(() => localStorage.setItem('somos-theme', 'dark'))
  await page.goto('/')
  await shoot(page, language, '8-home-dark')

  await context.close()
}

/** 1024 × 500, the banner at the top of the listing: the icon's brick, the name and the tagline. */
async function featureGraphic(browser: Browser, language: Language) {
  const tagline = language === 'sk' ? 'Mexická španielčina zo slovenčiny' : 'Mexican Spanish, step by step'
  const icon = (await readFile('android/store/icon-512.png')).toString('base64')
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 } })
  await page.setContent(`<!doctype html>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@500&display=block" rel="stylesheet">
<style>
  body { margin: 0; width: 1024px; height: 500px; background: #F4F1EC; display: flex; align-items: center; gap: 56px; padding: 0 96px; box-sizing: border-box; }
  img { width: 200px; height: 200px; border-radius: 44px; }
  h1 { font: 600 112px/1 Fraunces, serif; color: #1E1E1C; margin: 0; }
  p { font: 500 34px/1.25 Inter, sans-serif; color: #6B665E; margin: 20px 0 0; }
</style>
<img src="data:image/png;base64,${icon}" alt="">
<div><h1>somos</h1><p>${tagline}</p></div>`)
  await page.evaluate(() => document.fonts.ready)
  const path = `android/store/${language}/feature-graphic.png`
  await page.screenshot({ path })
  console.log(path)
  await page.close()
}

const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'warn' })
await server.listen()
const browser = await chromium.launch({ channel: 'chrome' })
try {
  for (const language of LANGUAGES) {
    await mkdir(`android/store/${language}`, { recursive: true })
    await featureGraphic(browser, language)
    await screenshots(browser, language)
  }
} finally {
  await browser.close()
  await server.close()
}
