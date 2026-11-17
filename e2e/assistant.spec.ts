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
}

/** Signs in with a faked Supabase in developer mode; /api/chat holds its answer until `release`. */
async function signedInDev(page: Page): Promise<Chat> {
  await page.addInitScript(() => localStorage.setItem('somos-dev-mode', 'on'))
  await page.route(`${SUPABASE}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const { pathname } = new URL(request.url())
    if (pathname === '/auth/v1/otp') return json(route, {})
    if (pathname === '/auth/v1/verify') return json(route, { access_token: jwt(), token_type: 'bearer', expires_in: 3600, expires_at: exp(), refresh_token: 'refresh', user: USER })
    if (pathname === '/rest/v1/records') return json(route, [])
    if (pathname === '/rest/v1/rpc/push_records') return route.fulfill({ status: 204, headers: cors })
    return json(route, { message: `not faked: ${pathname}` }, 404)
  })
  let release: () => void = () => {}
  const released = new Promise<void>((resolve) => (release = resolve))
  const chat: Chat = { contexts: [], release: () => release() }
  await page.route('**/api/chat', async (route) => {
    chat.contexts.push((route.request().postDataJSON() as { context?: { page?: string } }).context ?? {})
    await released
    await json(route, { content: [{ type: 'text', text: ANSWER }], stop_reason: 'end_turn' })
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
  const touch = (type: string, at: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: at }] })
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
