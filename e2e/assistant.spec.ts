import { expect, test, type Route } from '@playwright/test'
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

test('SOMO shows moving dots while it thinks, and its links read as words of the sentence', async ({ page }) => {
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
  // The answer waits until the test has seen the dots.
  let answer: () => void = () => {}
  const answered = new Promise<void>((resolve) => (answer = resolve))
  await page.route('**/api/chat', async (route) => {
    await answered
    await json(route, { content: [{ type: 'text', text: ANSWER }], stop_reason: 'end_turn' })
  })

  await page.goto('/profile')
  await page.getByRole('link', { name: 'Prihlásiť sa' }).tap()
  await page.getByLabel('E-mail').fill(EMAIL)
  await button(page, 'Poslať kód').tap()
  await page.getByLabel('Kód z e-mailu').fill('123456')
  await button(page, 'Prihlásiť sa').tap()
  await expect(page).toHaveURL(/\/profile$/)

  await page.goto('/assistant')
  await page.getByRole('textbox', { name: 'Napíš otázku…' }).fill('Kde nájdem kartičky?')
  await page.getByRole('button', { name: 'Poslať' }).tap()

  const thinking = page.getByRole('status').filter({ hasText: 'Premýšľam…' })
  await expect(thinking).toBeVisible()
  await expect(thinking.locator('[aria-hidden="true"]')).toHaveCount(3)
  await page.screenshot({ path: 'test-results/assistant-thinking.png' })
  answer()
  await expect(thinking).toHaveCount(0)

  // Links carry words, not paths; a bare path the model still writes is a link too.
  await expect(page.getByRole('link', { name: 'Domov', exact: true })).toHaveAttribute('href', '/')
  await expect(page.getByRole('link', { name: 'opakovaní kartičiek' })).toHaveAttribute('href', '/review')
  await expect(page.getByRole('link', { name: '/word/casa' })).toHaveAttribute('href', '/word/casa')
  await expect(page.getByText('(/review)')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/assistant-answer.png' })

  await page.getByRole('link', { name: 'opakovaní kartičiek' }).tap()
  await expect(page).toHaveURL(/\/review$/)
})
