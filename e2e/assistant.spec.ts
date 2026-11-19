import { expect, test, type Page, type Route } from '@playwright/test'
import { button } from './helpers.ts'

// Supabase and /api/chat answered by the test: the dev server's VITE_SUPABASE_URL points here (playwright.config.ts).
const SUPABASE = 'http://supabase.test'
const EMAIL = 'ana@example.com'
const USER = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: EMAIL, app_metadata: {}, user_metadata: {}, created_at: '2026-10-19T00:00:00Z' }
const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
const exp = () => Math.floor(Date.now() / 1000) + 3600
const jwt = () => `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: USER.id, email: EMAIL, aud: 'authenticated', role: 'authenticated', exp: exp() })}.signature`
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) })

const ANSWER = 'Kartičky na dnes ukazuje [Domov](/), zopakuješ ich v [opakovaní kartičiek](/review). Slovo nájdeš aj na /word/casa.'

interface Chat {
  /** The context of every question sent. */
  contexts: { page?: string }[]
  /** Lets the held answer go. */
  release: () => void
  /** What /api/chat answers from now on. */
  answer: string
  /** The newest question of every call. */
  questions: string[]
  /** Rows sent to chat_feedback (👍 / 👎). */
  feedback: Record<string, unknown>[]
}

/** Signs in with a faked Supabase in developer mode; /api/chat holds its answer until `release`. */
async function signedInDev(page: Page): Promise<Chat> {
  const feedback: Record<string, unknown>[] = []
  await page.addInitScript(() => localStorage.setItem('somos-dev-mode', 'on'))
  await page.route(`${SUPABASE}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const { pathname } = new URL(request.url())
    if (pathname === '/auth/v1/otp') return json(route, {})
    if (pathname === '/auth/v1/verify') return json(route, { access_token: jwt(), token_type: 'bearer', expires_in: 3600, expires_at: exp(), refresh_token: 'refresh', user: USER })
    if (pathname === '/rest/v1/records') return json(route, [])
    if (pathname === '/rest/v1/rpc/push_records') return route.fulfill({ status: 204, headers: cors })
    if (pathname === '/rest/v1/chat_feedback') {
      feedback.push(request.postDataJSON() as Record<string, unknown>)
      return route.fulfill({ status: 201, headers: cors })
    }
    return json(route, { message: `not faked: ${pathname}` }, 404)
  })
  let release: () => void = () => {}
  const released = new Promise<void>((resolve) => (release = resolve))
  const chat: Chat = { contexts: [], release: () => release(), answer: ANSWER, questions: [], feedback }
  await page.route('**/api/chat', async (route) => {
    const body = route.request().postDataJSON() as { context?: { page?: string }; messages: { content: unknown }[] }
    chat.contexts.push(body.context ?? {})
    const newest = body.messages.at(-1)?.content
    if (typeof newest === 'string') chat.questions.push(newest)
    await released
    await json(route, { content: [{ type: 'text', text: chat.answer }], stop_reason: 'end_turn' })
  })

  await page.goto('/profile')
  await page.getByRole('link', { name: 'Prihlásiť sa' }).tap()
  await page.getByLabel('E-mail').fill(EMAIL)
  await button(page, 'Poslať kód').tap()
  await page.getByLabel('Kód z e-mailu').fill('123456')
  await button(page, 'Prihlásiť sa').tap()
  await expect(page).toHaveURL(/\/profile$/)
  return chat
}

const pill = (page: Page) => page.getByRole('button', { name: 'Opýtať sa SOMO' })
const sheet = (page: Page) => page.getByRole('dialog', { name: 'SOMO' })

async function askQuestion(page: Page, question: string) {
  await page.getByRole('textbox', { name: 'Napíš otázku…' }).fill(question)
  await page.getByRole('button', { name: 'Poslať' }).tap()
}

test('SOMO shows moving dots while it thinks, and its links read as words of the sentence', async ({ page }) => {
  const chat = await signedInDev(page)
  await page.goto('/assistant')
  await askQuestion(page, 'Kde nájdem kartičky?')

  const thinking = page.getByRole('status').filter({ hasText: 'Premýšľam…' })
  await expect(thinking).toBeVisible()
  await expect(thinking.locator('[aria-hidden="true"]')).toHaveCount(3)
  chat.release()
  await expect(thinking).toHaveCount(0)

  // Links carry words, not paths; a bare path the model still writes is a link too.
  await expect(page.getByRole('link', { name: 'Domov', exact: true })).toHaveAttribute('href', '/')
  await expect(page.getByRole('link', { name: 'opakovaní kartičiek' })).toHaveAttribute('href', '/review')
  await expect(page.getByRole('link', { name: '/word/casa' })).toHaveAttribute('href', '/word/casa')
  await expect(page.getByText('(/review)')).toHaveCount(0)
  // The page itself is not a screen of the app layout: no pill on it.
  await expect(pill(page)).toHaveCount(0)
})

test('the SOMO pill opens the chat over the page, which SOMO is told about', async ({ page }) => {
  const chat = await signedInDev(page)
  await page.goto('/word/casa')
  await pill(page).tap()
  await expect(sheet(page)).toBeVisible()
  await expect(page).toHaveURL(/\/word\/casa$/)
  await page.screenshot({ path: 'test-results/somo-sheet.png' })

  await askQuestion(page, 'Ako sa toto slovo používa?')
  await expect.poll(() => chat.contexts.length).toBe(1)
  expect(chat.contexts[0].page).toBe('Detail slova „casa“ (dom, domov), /word/casa')
  chat.release()

  // A link in the answer leaves the sheet for that page.
  await sheet(page).getByRole('link', { name: 'opakovaní kartičiek' }).tap()
  await expect(page).toHaveURL(/\/review$/)
  await expect(sheet(page)).toHaveCount(0)
})

test('Back, ✕ and Escape close the sheet and leave the learner where they were', async ({ page }) => {
  await signedInDev(page)
  await page.goto('/topic/city')
  await page.screenshot({ path: 'test-results/somo-pill.png' })

  await pill(page).tap()
  await expect(sheet(page)).toBeVisible()
  await page.goBack()
  await expect(sheet(page)).toHaveCount(0)
  await expect(page).toHaveURL(/\/topic\/city$/)

  await pill(page).tap()
  await page.getByRole('button', { name: 'Zavrieť SOMO' }).tap()
  await expect(sheet(page)).toHaveCount(0)

  await pill(page).tap()
  await page.keyboard.press('Escape')
  await expect(sheet(page)).toHaveCount(0)
  await expect(page).toHaveURL(/\/topic\/city$/)
})

/** A finger pulling down from (x, y) by `distance` pixels, in steps like a real swipe. */
async function pullDown(page: Page, x: number, y: number, distance: number) {
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', at: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: at }] })
  await touch('touchStart', y)
  for (let step = 1; step <= 10; step++) {
    await touch('touchMove', y + (distance * step) / 10)
    await page.waitForTimeout(16)
  }
  await touch('touchEnd', y + distance)
}

test('pulling the sheet down closes it, a short pull lets it spring back', async ({ page }) => {
  await signedInDev(page)
  await page.goto('/topic/city')
  await pill(page).tap()
  await expect(sheet(page)).toBeVisible()
  const title = sheet(page).getByRole('heading', { name: 'SOMO' })
  await expect(page.getByRole('button', { name: 'Zavrieť SOMO' })).toBeFocused()
  const box = (await title.boundingBox())!

  await pullDown(page, box.x + 20, box.y + 10, 30)
  await page.waitForTimeout(400)
  await expect(sheet(page)).toBeVisible()
  expect((await title.boundingBox())!.y).toBeCloseTo(box.y, 0)

  await pullDown(page, box.x + 20, box.y + 10, 300)
  await expect(sheet(page)).toHaveCount(0)
  await expect(page).toHaveURL(/\/topic\/city$/)
  await expect(pill(page)).toBeVisible()
})

test('the pill stays off screens with their own bottom button, and off without developer mode', async ({ page }) => {
  await signedInDev(page)
  await page.goto('/')
  await expect(pill(page)).toBeVisible()
  await page.goto('/practice?type=conjugation')
  await expect(page.getByRole('button', { name: /Pokračovať \(Lekcia/ })).toBeVisible()
  await expect(pill(page)).toHaveCount(0)

  await page.evaluate(() => localStorage.setItem('somos-dev-mode', 'off'))
  await page.addInitScript(() => localStorage.setItem('somos-dev-mode', 'off'))
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Domov' }).first()).toBeVisible()
  await expect(pill(page)).toHaveCount(0)
})

test('SOMO shows conjugation and word cards drawn from the app data; a link to a missing page stays text', async ({ page }) => {
  const chat = await signedInDev(page)
  chat.release()
  chat.answer =
    'Tener má v pretérite nepravidelné tvary, napríklad **tuve**.\n{{conj:tener:preterito}}\n- Ayer tuve mucho trabajo. – Včera som mal veľa práce.\nPozri aj [flarpo](/word/flarpo).\n{{word:casa}}\n{{dalej:Ako je tener v prítomnom čase?}}'
  await page.goto('/assistant')
  await askQuestion(page, 'Ako je tener v minulom čase?')

  const conjugation = page.getByRole('region', { name: 'tener · pretérito' })
  await expect(conjugation.getByText('tuve')).toBeVisible()
  await expect(conjugation.getByRole('link', { name: 'Celé časovanie' })).toHaveAttribute('href', '/word/tener')
  await expect(page.getByRole('link', { name: /la casa/ })).toHaveAttribute('href', '/word/casa')
  await expect(page.getByText('Pozri aj flarpo.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'flarpo' })).toHaveCount(0)
  await expect(page.getByText('{{')).toHaveCount(0)
  // Bold Spanish in the sentence, the example as on a word's page.
  await expect(page.locator('strong', { hasText: 'tuve' })).toBeVisible()
  await expect(page.getByText('Ayer tuve mucho trabajo.')).toBeVisible()
  await expect(page.getByText('Včera som mal veľa práce.')).toBeVisible()
  await page.screenshot({ path: 'test-results/somo-cards.png', fullPage: true })

  // The follow-up question is a chip that asks it.
  const followUp = page.getByRole('group', { name: 'Môžeš sa spýtať ďalej' }).getByRole('button', { name: 'Ako je tener v prítomnom čase?' })
  await followUp.tap()
  await expect.poll(() => chat.contexts.length).toBe(2)
  // The question is in the chat; the same chip under the next answer is not offered again.
  await expect(page.locator('section').getByText('Ako je tener v prítomnom čase?')).toHaveCount(1)
  await expect(page.getByRole('group', { name: 'Môžeš sa spýtať ďalej' })).toHaveCount(0)
})

test('an empty chat suggests questions about the page it was opened on', async ({ page }) => {
  const chat = await signedInDev(page)
  chat.release()
  await page.goto('/word/casa')
  await pill(page).tap()
  const suggested = sheet(page).getByRole('group', { name: 'Navrhnuté otázky' })
  await expect(suggested.getByRole('button')).toHaveText(['Použi „casa“ vo vete', 'Kedy sa používa „casa“?'])
  await page.waitForTimeout(600) // the sheet has grown out of the pill
  await page.screenshot({ path: 'test-results/somo-suggestions.png' })
  await suggested.getByRole('button', { name: 'Použi „casa“ vo vete' }).tap()
  await expect.poll(() => chat.contexts.length).toBe(1)
  await expect(sheet(page).getByText('Použi „casa“ vo vete')).toBeVisible()
})

test('the conversation is back after the app was closed, and earlier ones can be reopened', async ({ page }) => {
  const chat = await signedInDev(page)
  chat.release()
  await page.goto('/assistant')
  await askQuestion(page, 'Prvá otázka')
  await expect(page.getByRole('link', { name: 'opakovaní kartičiek' })).toBeVisible()

  // Closed and opened again: the same conversation, and the next question goes on with it.
  await page.reload()
  await expect(page.getByText('Prvá otázka')).toBeVisible()
  await expect(page.getByRole('link', { name: 'opakovaní kartičiek' })).toBeVisible()

  // A new conversation starts empty; the earlier one stays in Rozhovory.
  await page.getByRole('button', { name: 'Nový rozhovor' }).tap()
  await expect(page.getByRole('link', { name: 'opakovaní kartičiek' })).toHaveCount(0)
  await askQuestion(page, 'Druhá otázka')
  await expect(page.getByRole('link', { name: 'opakovaní kartičiek' })).toBeVisible()

  // The list has both, newest first; tapping the first one goes back to it.
  await page.getByRole('button', { name: 'Rozhovory' }).tap()
  const list = page.getByRole('listitem')
  await expect(list).toHaveCount(2)
  await expect(list.first()).toContainText('Druhá otázka')
  await page.screenshot({ path: 'test-results/somo-history.png' })
  await page.getByRole('button', { name: /^Prvá otázka/ }).tap()
  await expect(page.getByText('Prvá otázka')).toBeVisible()
  await expect(page.getByText('Druhá otázka')).toHaveCount(0)

  // Deleting one leaves the other.
  await page.getByRole('button', { name: 'Rozhovory' }).tap()
  await page.getByRole('button', { name: 'Vymazať rozhovor „Druhá otázka“' }).tap()
  await expect(list).toHaveCount(1)
})

test('"Prečo? Opýtaj sa SOMO" in a lesson explains the task over it, and Back returns to the feedback', async ({ page }) => {
  const chat = await signedInDev(page)
  chat.release()
  chat.answer = 'Tvar je nepravidelný.\n{{tip:preterito}}'
  await page.goto('/practice/lesson?type=conjugation&tense=preterito&level=A1&lesson=1')
  await page.getByRole('textbox').first().fill('xyz')
  await page.getByRole('button', { name: 'Skontrolovať' }).tap()
  await page.getByRole('button', { name: 'Vzdať sa' }).tap()
  await page.getByRole('button', { name: 'Prečo? Opýtaj sa SOMO' }).tap()

  // The question goes by itself, made of what the app knows about the task.
  await expect(sheet(page)).toBeVisible()
  await expect.poll(() => chat.questions.length).toBe(1)
  expect(chat.questions[0]).toMatch(/^Prečo je (moja odpoveď zlá|správne práve toto)\?\nCvičenie: .+\nÚloha: .+ · pretérito/)
  expect(chat.questions[0]).toContain('\nSprávne: ')
  await expect(sheet(page).getByRole('link', { name: /Otvoriť tip/ })).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/somo-why.png' })

  await page.goBack()
  await expect(sheet(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pokračovať' })).toBeVisible()
  await expect(page).toHaveURL(/\/practice\/lesson\?/)

  // Chyby offer the same for every task kept there (the wrong answer is kept on going on).
  await page.getByRole('button', { name: 'Pokračovať' }).tap()
  await expect(page.getByRole('button', { name: 'Prečo? Opýtaj sa SOMO' })).toHaveCount(0)
  await page.goto('/archive?tab=mistakes')
  await page.getByRole('button', { name: /^Opýtať sa SOMO na úlohu:/ }).first().tap()
  await expect.poll(() => chat.questions.length).toBe(2)
  expect(chat.questions[1]).toMatch(/^Vysvetli mi túto úlohu/)
})

test('👍 / 👎 under an answer is sent with the question, the answer and the page, and stays after a reload', async ({ page }) => {
  const chat = await signedInDev(page)
  chat.release()
  await page.goto('/word/casa')
  await pill(page).tap()
  await askQuestion(page, 'Ako sa toto slovo používa?')
  await sheet(page).getByRole('button', { name: 'Zlá odpoveď' }).tap()
  await sheet(page).getByRole('group', { name: 'Čo bolo zle?' }).getByRole('button', { name: 'Nejasné' }).tap()
  await expect(sheet(page).getByText('Ďakujem za hodnotenie.')).toBeVisible()
  expect(chat.feedback).toHaveLength(1)
  expect(chat.feedback[0]).toMatchObject({ rating: 'down', reason: 'unclear', question: 'Ako sa toto slovo používa?', answer: ANSWER, tools: [] })
  expect(chat.feedback[0].page).toContain('/word/casa')

  await page.keyboard.press('Escape')
  await expect(sheet(page)).toHaveCount(0)
  await page.reload()
  await pill(page).tap()
  await expect(sheet(page).getByText('Ďakujem za hodnotenie.')).toBeVisible()
  await expect(sheet(page).getByRole('button', { name: 'Zlá odpoveď' })).toHaveCount(0)
})
