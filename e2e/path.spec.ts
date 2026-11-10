import { expect, test, type Page } from '@playwright/test'
import { button, field, status, tips } from './helpers.ts'

// The guided path (src/lib/path.ts): units of steps, each step a lesson, the unit's test the last one.

const passed = { bestScore: 10, total: 10, passed: true }

/** Lesson records and test results as the app stores them, before the page loads. */
async function seed(page: Page, lessons: Record<string, object>, tests: Record<string, object> = {}) {
  await page.addInitScript(
    ([l, t]) => {
      localStorage.setItem('somos-lesson-progression-v2', l)
      localStorage.setItem('somos-tests-v1', t)
    },
    [JSON.stringify(lessons), JSON.stringify(tests)],
  )
}

test('the Cesta tab leads to the path, its first unit open on its steps', async ({ page }) => {
  await page.goto('/practice')
  await page.getByRole('navigation', { name: 'Hlavná navigácia' }).getByRole('link', { name: 'Cesta' }).tap()
  await expect(page).toHaveURL(/\/path$/)
  await expect(page.getByRole('heading', { name: 'Cesta' })).toBeVisible()
  await expect(page.getByText(/^A1 · 0 z \d+ jednotiek$/)).toBeVisible()

  const first = page.getByRole('button', { name: /Pozdravy a frázy 1/ })
  await expect(first).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('link', { name: 'Nové slová', exact: true })).toBeVisible()
  // The steps go in order, but the test is open from the start.
  await expect(page.getByRole('link', { name: 'Nové slová II' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Test jednotky' })).toHaveAttribute('href', '/practice/test?level=A1&topic=greetings&part=1')
  await expect(page.getByRole('link', { name: 'Tip' })).toHaveAttribute('href', '/practice/grammar/ser-estar')
  // The next unit waits for this one's test.
  await expect(page.getByText('Otvorí sa po teste predošlej jednotky').first()).toBeVisible()

  await first.tap()
  await expect(first).toHaveAttribute('aria-expanded', 'false')
})

test('a step is a lesson of the unit, scored like a numbered lesson', async ({ page }) => {
  await page.goto('/path')
  await page.getByRole('link', { name: 'Nové slová', exact: true }).tap()
  await expect(page).toHaveURL(/\/practice\/lesson\?path=a1-greetings-1&step=words$/)

  // First the new words, a card each, nothing to answer; a swipe or the buttons turn them.
  await expect(page.getByText('Nové slovo · 1 z 10')).toBeVisible()
  await expect(page.getByRole('heading', { name: /hola/i })).toBeVisible()
  await button(page, 'Ďalšie slovo').tap()
  await expect(page.getByText('Nové slovo · 2 z 10')).toBeVisible()
  await button(page, 'Späť').tap()
  await expect(page.getByText('Nové slovo · 1 z 10')).toBeVisible()
  for (let i = 1; i < 10; i++) await button(page, 'Ďalšie slovo').tap()
  await button(page, 'Precvičiť slová').tap()
  await expect(page.getByText(/^Jednotka 1 · Nové slová · /)).toBeVisible()

  const total = Number((await page.locator('header').innerText()).match(/\/(\d+)/)![1])
  for (let i = 0; i < total; i++) {
    await field(page).fill('zzzz')
    await button(page, 'Skontrolovať').tap()
    await button(page, 'Vzdať sa').tap()
    await expect(status(page)).toContainText('Nesprávne')
    await button(page, 'Pokračovať').tap()
  }
  await expect(page.getByRole('heading', { name: 'Nové slová: zatiaľ nesplnené' })).toBeVisible()
  await expect(button(page, 'Ďalší krok (zamknutý)')).toBeDisabled()

  // ✕ goes back to the path, where the step is still the one to do.
  await page.getByRole('button', { name: 'Ukončiť lekciu' }).tap()
  await expect(page).toHaveURL(/\/path$/)
})

test('a passed step opens the next one, which the result leads to', async ({ page }) => {
  await seed(page, { 'path:a1-greetings-1:words': { bestScore: 9, total: 10, passed: false, solved: [] } })
  await page.goto('/path')
  await expect(page.getByRole('link', { name: 'Nové slová II' })).toHaveCount(0)

  await seed(page, { 'path:a1-greetings-1:words': passed })
  await page.goto('/path')
  await page.getByRole('link', { name: 'Nové slová II' }).tap()
  await expect(page).toHaveURL(/step=words2$/)
  await expect(page.getByText(/^Nové slovo · 1 z \d+$/)).toBeVisible()
  await button(page, 'Preskočiť').tap()
  await expect(page.getByText(/^Jednotka 1 · Nové slová II · /)).toBeVisible()
})

test('the grammar step opens on its tip, the rules of the unit named', async ({ page }) => {
  await seed(page, { 'path:a1-greetings-1:words': passed, 'path:a1-greetings-1:words2': passed })
  await page.goto('/path')
  await page.getByRole('link', { name: 'Gramatika', exact: true }).tap()
  await expect(page).toHaveURL(/step=grammar$/)
  await expect(page.getByText('Gramatika jednotky')).toBeVisible()
  await expect(page.getByText('Dnes: Kto alebo čo to je, Pôvod, Povolanie')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ser a estar' })).toBeVisible()
  await button(page, 'Rozumiem, začať').tap()
  await expect(page.getByText(/^Jednotka 1 · Gramatika · /)).toBeVisible()
})

test('a unit test leads back to the path', async ({ page }) => {
  await page.goto('/practice/test?level=A1&topic=greetings&part=1')
  await button(page, 'Začať test').tap()
  await field(page).fill('zzzz')
  await button(page, 'Ďalej').tap()
  for (let i = 2; i <= 15; i++) {
    await expect(page.locator('header')).toContainText(`${i}/15`)
    await button(page, 'Neviem').tap()
  }
  await expect(page.getByText('Zatiaľ nezložený')).toBeVisible()
  await expect(page.getByText('¡Unidad completada!')).toHaveCount(0)
  await button(page, 'Späť na cestu').tap()
  await expect(page).toHaveURL(/\/path$/)
})

test('a passed topic test closes its unit, and Domov goes on with the next one', async ({ page }) => {
  await seed(page, { 'path:a1-basics-1:words': passed }, { 'greetings:A1': { bestScore: 14, total: 15, passed: true, attempts: 1, lastAt: 1 } })
  await page.goto('/')
  await expect(page.getByText('Tvoja cesta')).toBeVisible()
  await expect(page.getByText('Jednotka 2 · Základné slová 1 · Nové slová II (2/7)')).toBeVisible()
  await page.getByRole('link', { name: 'Jednotka 2: Nové slová II' }).tap()
  await expect(page).toHaveURL(/path=a1-basics-1&step=words2$/)

  await page.goto('/path')
  // The topic test closes both units of the topic.
  await expect(page.getByText(/^A1 · 2 z \d+ jednotiek$/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Základné slová 1/ })).toHaveAttribute('aria-expanded', 'true')
})

test('a step that is not open yet does not open from its address', async ({ page }) => {
  await page.goto('/practice/lesson?path=a1-basics-1&step=words')
  await expect(page.getByText('Lekcia je zamknutá')).toBeVisible()
})

test('a usage unit practises its blanks, "Prečo?" names the rule of the blank', async ({ page }) => {
  // b1-shopping-1 teaches por/para (a usage tip): its grammar step is blanks only, each naming its rule.
  // Open up to it: the exams of A1 and A2, the B1 topics before it, its own new words.
  const before = ['greetings', 'basics', 'family', 'food', 'home', 'work', 'time', 'city', 'travel', 'emotions', 'health']
  const results = { bestScore: 15, total: 15, passed: true, attempts: 1, lastAt: 1 }
  await seed(
    page,
    { 'path:b1-shopping-1:words': passed, 'path:b1-shopping-1:words2': passed },
    Object.fromEntries([['A1', results], ['A2', results], ...before.map((topic) => [`${topic}:B1`, results])]),
  )
  await page.goto('/practice/lesson?path=b1-shopping-1&step=grammar')
  await expect(page.getByRole('heading', { name: 'por alebo para' })).toBeVisible()
  await button(page, 'Rozumiem, začať').tap()
  await button(page, 'Vzdať sa').tap()
  await button(page, 'Prečo?').tap()
  const tip = page.getByRole('dialog')
  await expect(tip.getByRole('heading', { level: 1 })).toHaveText('por alebo para')
  const reasons = tips.find((t) => t.id === 'por-para')!.rules.map((r) => r.because!)
  const here = await tip.getByLabel('V tejto vete').innerText()
  expect(reasons.some((reason) => here.includes(reason))).toBe(true)
})

test('an open unit offers its test as "Viem to", a finished level has a check', async ({ page }) => {
  await page.goto('/path')
  await expect(page.getByRole('link', { name: 'Viem to – urobiť test' })).toHaveAttribute('href', '/practice/test?level=A1&topic=greetings&part=1')
  await expect(page.getByText('Keď ho splníš, jednotka je hotová.')).toBeVisible()
  await expect(page.getByLabel('A1 zvládnutá')).toHaveCount(0)

  await seed(page, {}, { A1: { bestScore: 15, total: 15, passed: true, attempts: 1, lastAt: 1 } })
  await page.goto('/path')
  await expect(page.getByLabel('A1 zvládnutá')).toBeVisible()
  // The path goes on in A2: its first unit offers its own test.
  await expect(page.getByRole('link', { name: 'Viem to – urobiť test' })).toHaveAttribute('href', /level=A2/)
})

/** The welcome's answers as the app stores them: a learner who started at `level`. */
async function welcomed(page: Page, level: string) {
  // Once per tab (the config seeds a bare welcome for every test): later navigations keep what the app stored since.
  await page.addInitScript((data) => {
    if (sessionStorage.getItem('welcomed')) return
    localStorage.setItem('somos-onboarding', data)
    sessionStorage.setItem('welcomed', '1')
  }, JSON.stringify({ done: true, at: 1, motivation: 'fun', level }))
}

/** Plays a step of new words with every answer counted as right ("Moja odpoveď bola tiež správna" after giving up). */
async function allRight(page: Page) {
  const total = Number((await page.locator('header').innerText()).match(/\/(\d+)/)![1])
  for (let i = 0; i < total; i++) {
    await field(page).fill('zzzz')
    await button(page, 'Skontrolovať').tap()
    await button(page, 'Vzdať sa').tap()
    await button(page, 'Moja odpoveď bola tiež správna').tap()
  }
}

test('all right in the first lesson offers the level above, once', async ({ page }) => {
  await welcomed(page, 'A1')
  await page.goto('/practice/lesson?path=a1-greetings-1&step=words')
  await button(page, 'Preskočiť').tap()
  await expect(page.getByText(/^Jednotka 1 · Nové slová · /)).toBeVisible()
  await allRight(page)
  await expect(page.getByRole('heading', { name: 'Išlo ti to výborne. Chceš začať na A2?' })).toBeVisible()
  await button(page, 'Áno, na A2').tap()
  await expect(page).toHaveURL(/path=a2-[a-z]+-1&step=words$/)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('somos-onboarding') ?? '{}') as Record<string, unknown>)
  expect(stored).toMatchObject({ level: 'A2', levelOffered: true })

  // Back at A1 and all right again: the offer was made, nothing is offered twice.
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('somos-onboarding')!) as Record<string, unknown>
    localStorage.setItem('somos-onboarding', JSON.stringify({ ...state, level: 'A1' }))
  })
  await page.goto('/practice/lesson?path=a1-greetings-1&step=words')
  await expect(page.getByText(/^Jednotka 1 · Nové slová · /)).toBeVisible()
  await allRight(page)
  await expect(page.getByRole('heading', { name: 'Nové slová: splnené' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Chceš/ })).toHaveCount(0)
})
