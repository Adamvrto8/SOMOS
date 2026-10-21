import { expect, test, type Page, type Route } from '@playwright/test'
import { button } from './helpers.ts'

// Supabase answered by the tests: the dev server's VITE_SUPABASE_URL points here (playwright.config.ts).
const SUPABASE = 'http://supabase.test'
const EMAIL = 'ana@example.com'
const USER = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: EMAIL, app_metadata: {}, user_metadata: {}, created_at: '2026-10-19T00:00:00Z' }

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
const exp = () => Math.floor(Date.now() / 1000) + 3600
const jwt = () => `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: USER.id, email: EMAIL, aud: 'authenticated', role: 'authenticated', exp: exp() })}.signature`

interface Calls {
  pushed: { kind: string; key: string }[]
  logout: number
  deleted: number
}

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) })

async function fakeSupabase(page: Page, { goodCode = '123456' } = {}): Promise<Calls> {
  const calls: Calls = { pushed: [], logout: 0, deleted: 0 }
  await page.route(`${SUPABASE}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const url = new URL(request.url())
    switch (url.pathname) {
      case '/auth/v1/otp':
        return json(route, {})
      case '/auth/v1/verify': {
        const { token } = request.postDataJSON() as { token: string }
        if (token !== goodCode) return json(route, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }, 403)
        return json(route, { access_token: jwt(), token_type: 'bearer', expires_in: 3600, expires_at: exp(), refresh_token: 'refresh', user: USER })
      }
      case '/auth/v1/logout':
        calls.logout++
        return route.fulfill({ status: 204, headers: cors })
      case '/rest/v1/records':
        return json(route, [])
      case '/rest/v1/rpc/push_records': {
        const { items } = request.postDataJSON() as { items: { kind: string; key: string }[] }
        calls.pushed.push(...items.map(({ kind, key }) => ({ kind, key })))
        return route.fulfill({ status: 204, headers: cors })
      }
      case '/rest/v1/rpc/delete_my_account':
        calls.deleted++
        return route.fulfill({ status: 204, headers: cors })
      default:
        return json(route, { message: `not faked: ${url.pathname}` }, 404)
    }
  })
  return calls
}

async function signInWithCode(page: Page, code = '123456') {
  await page.goto('/archive/settings')
  await page.getByRole('link', { name: 'Prihlásiť sa' }).tap()
  await page.getByLabel('E-mail').fill(EMAIL)
  await button(page, 'Poslať kód').tap()
  await expect(page.getByText(`Poslali sme 6-miestny kód na ${EMAIL}`)).toBeVisible()
  await page.getByLabel('Kód z e-mailu').fill(code)
  await button(page, 'Prihlásiť sa').tap()
}

test('signing in with an e-mail code shows the account and syncs', async ({ page }) => {
  const calls = await fakeSupabase(page)
  await signInWithCode(page)
  await expect(page).toHaveURL(/\/archive\/settings$/)
  // The top row of Nastavenia is the account now, with how it syncs; its page says the same.
  const row = page.getByRole('link', { name: new RegExp(EMAIL) })
  await expect(row).toContainText('Synchronizované práve teraz')
  await row.tap()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Účet')
  await expect(page.getByRole('status').filter({ hasText: 'Synchronizované práve teraz' })).toBeVisible()
  // The device's settings went to the account.
  expect(calls.pushed).toContainEqual({ kind: 'settings', key: 'settings' })
})

test('a wrong code says so and lets the learner try again', async ({ page }) => {
  await fakeSupabase(page)
  await signInWithCode(page, '000000')
  await expect(page.getByRole('alert')).toContainText('Kód nesedí alebo už neplatí')
  await expect(page.getByLabel('Kód z e-mailu')).toBeVisible()
})

test('signing out leaves the device without the account', async ({ page }) => {
  const calls = await fakeSupabase(page)
  await signInWithCode(page)
  await page.getByRole('link', { name: new RegExp(EMAIL) }).tap()
  await button(page, 'Odhlásiť sa').tap()
  await expect(page).toHaveURL(/\/$/)
  expect(calls.logout).toBe(1)
  await page.goto('/archive/settings')
  await expect(page.getByRole('link', { name: 'Prihlásiť sa' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('somos-auth'))).toBeNull()
})

test('deleting the account asks first', async ({ page }) => {
  const calls = await fakeSupabase(page)
  await signInWithCode(page)
  await page.getByRole('link', { name: new RegExp(EMAIL) }).tap()
  await button(page, 'Zmazať účet').tap()
  await expect(page.getByText('Zmazať účet?')).toBeVisible()
  await button(page, 'Zrušiť').tap()
  expect(calls.deleted).toBe(0)

  await button(page, 'Zmazať účet').tap()
  await button(page, 'Zmazať natrvalo').tap()
  await expect(page).toHaveURL(/\/$/)
  expect(calls.deleted).toBe(1)
})

test('the privacy policy opens from the sign-in page', async ({ page }) => {
  await page.goto('/archive/account')
  await page.getByRole('link', { name: 'Ochrana súkromia' }).tap()
  await expect(page.getByRole('heading', { name: 'Ochrana súkromia' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'S účtom' })).toBeVisible()
})

test('the first sign-in takes the progress already on the device to the account', async ({ page }) => {
  const calls = await fakeSupabase(page)
  await page.goto('/word/casa')
  await page.getByRole('button', { name: 'Uložiť do archívu' }).first().tap()
  await expect(page.getByRole('button', { name: 'Odstrániť z archívu' }).first()).toBeVisible()
  await signInWithCode(page)
  await expect(page.getByRole('link', { name: new RegExp(EMAIL) })).toContainText('Synchronizované práve teraz')
  expect(calls.pushed).toContainEqual({ kind: 'saved', key: 'word:casa' })
})
