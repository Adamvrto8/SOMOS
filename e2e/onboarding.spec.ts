import { expect, test, type Page, type Route } from '@playwright/test'
import { button, field, seedAttempts, status } from './helpers.ts'

// A new device: no welcome done yet (the other suites start with it done, playwright.config.ts).
test.use({ storageState: { cookies: [], origins: [] } })

const radio = (page: Page, name: string | RegExp) => page.getByRole('radio', { name })
const next = (page: Page) => button(page, 'Pokračovať')

test('a new learner goes through the welcome into the first lesson of their topic and level', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByRole('heading', { name: '¡Hola!' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Hlavná navigácia' })).toHaveCount(0)

  // The language comes first: the rest follows it at once.
  await radio(page, 'English').tap()
  await expect(button(page, 'Get started')).toBeVisible()
  await radio(page, 'Slovenčina').tap()
  await button(page, 'Začať').tap()

  // One question a screen; Pokračovať waits for an answer.
  await expect(page.getByRole('heading', { name: 'Prečo sa učíš španielčinu?' })).toBeVisible()
  await expect(next(page)).toBeDisabled()
  await radio(page, /Na cestovanie/).tap()
  await expect(radio(page, /Na cestovanie/)).toHaveAttribute('aria-checked', 'true')
  await next(page).tap()

  await expect(page.getByRole('heading', { name: 'Koľko španielčiny už vieš?' })).toBeVisible()
  await radio(page, /Poznám základy/).tap()
  // The phone's back button goes back a step, with the answer kept.
  await page.goBack()
  await expect(radio(page, /Na cestovanie/)).toHaveAttribute('aria-checked', 'true')
  await page.goForward()
  await expect(radio(page, /Poznám základy/)).toHaveAttribute('aria-checked', 'true')
  await next(page).tap()

  await expect(page.getByRole('heading', { name: 'Koľko chceš denne cvičiť?' })).toBeVisible()
  await expect(radio(page, /Bežne/)).toHaveAttribute('aria-checked', 'true') // the default goal, 20
  await radio(page, /Vážne/).tap()
  await next(page).tap()

  // No reminder step on the dev server (no push server) and none for adding to the home screen in this browser.
  await expect(page.getByRole('heading', { name: 'Všetko je pripravené' })).toBeVisible()
  await expect(page.getByText('Prvá lekcia: Slovná zásoba · Cestovanie · A2')).toBeVisible()
  await button(page, 'Začať prvú lekciu').tap()
  await expect(page).toHaveURL(/\/practice\/lesson\?type=vocab&topic=travel&level=A2&lesson=1&first=1/)
  await expect(field(page)).toBeVisible()

  // Through the lesson, giving every task up.
  for (let i = 0; i < 10; i++) {
    await field(page).fill('zzzz')
    await button(page, 'Skontrolovať').tap()
    await button(page, 'Vzdať sa').tap()
    await expect(status(page)).toContainText('Nesprávne')
    await next(page).tap()
  }
  // The result offers an account, once.
  await expect(page.getByRole('heading', { name: 'Ulož si pokrok' })).toBeVisible()
  await button(page, 'Neskôr').tap()
  await expect(page.getByRole('heading', { name: 'Ulož si pokrok' })).toHaveCount(0)

  // Closing it goes to Domov, which goes on where the welcome pointed; the goal is the one picked.
  await page.getByRole('button', { name: 'Ukončiť lekciu' }).tap()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('navigation', { name: 'Hlavná navigácia' })).toBeVisible()
  await page.goto('/profile/goal')
  await expect(radio(page, /30/)).toBeChecked()

  // Back in the history the welcome is over: Domov.
  await page.goto('/welcome?step=level')
  await expect(page).toHaveURL(/\/$/)
})

test('every question can be skipped, which starts with all topics at A1', async ({ page }) => {
  await page.goto('/welcome')
  await button(page, 'Začať').tap()
  for (const heading of ['Prečo sa učíš španielčinu?', 'Koľko španielčiny už vieš?', 'Koľko chceš denne cvičiť?']) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    await button(page, 'Preskočiť').tap()
  }
  await expect(page.getByText('Prvá lekcia: Slovná zásoba · Všetky témy · A1')).toBeVisible()
})

test('a device used before the welcome existed opens Domov', async ({ page }) => {
  await page.goto('/privacy')
  await seedAttempts(page, { 1: 3 })
  await page.goto('/')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: '¡Hola!' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Hlavná navigácia' })).toBeVisible()
})

test('a link into the app opens what it points to, not the welcome', async ({ page }) => {
  await page.goto('/word/casa')
  await expect(page).toHaveURL(/\/word\/casa$/)
  await expect(page.getByRole('heading', { name: 'la casa' })).toBeVisible()
})

// Supabase answered by the test, as in account.spec.ts: an account without any progress yet.
const SUPABASE = 'http://supabase.test'
const EMAIL = 'ana@example.com'
const USER = { id: '00000000-0000-4000-8000-000000000002', aud: 'authenticated', role: 'authenticated', email: EMAIL, app_metadata: {}, user_metadata: {}, created_at: '2026-10-24T00:00:00Z' }
const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
const exp = () => Math.floor(Date.now() / 1000) + 3600
const jwt = () => `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: USER.id, email: EMAIL, aud: 'authenticated', role: 'authenticated', exp: exp() })}.signature`
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
const json = (route: Route, body: unknown) => route.fulfill({ headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) })

test('"Už mám účet" signs in and a new account goes on with the questions', async ({ page }) => {
  await page.route(`${SUPABASE}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const { pathname } = new URL(request.url())
    if (pathname === '/auth/v1/otp') return json(route, {})
    if (pathname === '/auth/v1/verify') return json(route, { access_token: jwt(), token_type: 'bearer', expires_in: 3600, expires_at: exp(), refresh_token: 'refresh', user: USER })
    if (pathname === '/rest/v1/records') return json(route, [])
    return route.fulfill({ status: 204, headers: cors })
  })
  await page.goto('/welcome')
  await button(page, 'Už mám účet').tap()
  await page.getByLabel('E-mail').fill(EMAIL)
  await button(page, 'Poslať kód').tap()
  await page.getByLabel('Kód z e-mailu').fill('123456')
  await button(page, 'Prihlásiť sa').tap()
  await expect(page).toHaveURL(/\/welcome\?step=motivation$/)
  await expect(page.getByRole('heading', { name: 'Prečo sa učíš španielčinu?' })).toBeVisible()
})
