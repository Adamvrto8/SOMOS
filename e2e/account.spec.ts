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

async function fakeSupabase(page: Page, { goodCode = '123456', usageReport }: { goodCode?: string; usageReport?: object | 'forbidden' } = {}): Promise<Calls> {
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
      case '/rest/v1/rpc/usage_report':
        // What usage_report() raises for an account not in usage_admins.
        if (usageReport === 'forbidden' || !usageReport) return json(route, { code: 'P0001', message: 'forbidden', details: null, hint: null }, 400)
        return json(route, usageReport)
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
  await page.goto('/profile')
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
  await expect(page).toHaveURL(/\/profile$/)
  // The top of Profil is the e-mail with how it syncs, nothing to open.
  await expect(page.getByText(EMAIL)).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(EMAIL) })).toHaveCount(0)
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
  await button(page, 'Odhlásiť sa').tap()
  await expect(page).toHaveURL(/\/$/)
  expect(calls.logout).toBe(1)
  await page.goto('/profile')
  await expect(page.getByRole('link', { name: 'Prihlásiť sa' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('somos-auth'))).toBeNull()
})

test('deleting the account asks first', async ({ page }) => {
  const calls = await fakeSupabase(page)
  await signInWithCode(page)
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
  await page.goto('/profile/sign-in')
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
  await expect(page.getByRole('status').filter({ hasText: 'Synchronizované práve teraz' })).toBeVisible()
  expect(calls.pushed).toContainEqual({ kind: 'saved', key: 'word:casa' })
})

const USAGE_REPORT = {
  since: '2026-09-26',
  devices: 12,
  active: Array.from({ length: 30 }, (_, i) => ({ day: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`, devices: 3 + (i % 7) })),
  returning: { new: 8, nextDay: 3, weekOld: 4, withinWeek: 2 },
  welcome: { welcome: 8, motivation: 7, level: 7, goal: 6, ready: 5, done: 5 },
  lessons: [
    { by: 'type', key: 'cloze', started: 10, finished: 6, quit: 2, usualStop: 3 },
    { by: 'type', key: 'builder', started: 20, finished: 15, quit: 5, usualStop: null },
    { by: 'type', key: 'mixed', started: 4, finished: 4, quit: 0, usualStop: null },
    { by: 'level', key: 'A1', started: 22, finished: 16, quit: 5, usualStop: 4 },
    { by: 'level', key: '-', started: 8, finished: 5, quit: 2, usualStop: 1 },
  ],
  screens: { search: 9, practice: 8, duel: 1 },
}

test('Štatistiky používania show the numbers to an admin, and say no to any other account', async ({ page }) => {
  await fakeSupabase(page, { usageReport: USAGE_REPORT })
  await signInWithCode(page)
  await expect(page.getByText(EMAIL)).toBeVisible()
  await page.goto('/profile/dev')
  await button(page, 'Štatistiky používania').tap()
  await expect(page).toHaveURL(/\/profile\/usage-stats$/)
  await expect(page.getByText('12 zariadení v období')).toBeVisible()
  await expect(page.getByText('Vrátili sa na druhý deň: 3 (38 %)')).toBeVisible()
  // Exercise types by name, most started first; finished as a share; the task they leave at.
  const rows = page.getByRole('row')
  await expect(rows.nth(1)).toContainText('Skladanie viet')
  await expect(rows.nth(1)).toContainText('75 %')
  await expect(rows.nth(2)).toContainText('60 %')
  await expect(rows.nth(2)).toContainText('4')
  await expect(page.getByText('Všetky úrovne')).toBeVisible()
  await expect(rows.nth(3)).toContainText('Zmiešané (chyby, príprava na test)')
  if (process.env.USAGE_SCREENSHOT) await page.screenshot({ path: process.env.USAGE_SCREENSHOT, fullPage: true })
})

test('Štatistiky používania: an account not in usage_admins has no access', async ({ page }) => {
  await fakeSupabase(page, { usageReport: 'forbidden' })
  await signInWithCode(page)
  await expect(page.getByText(EMAIL)).toBeVisible()
  await page.goto('/profile/usage-stats')
  await expect(page.getByText('Tento účet nemá prístup.')).toBeVisible()
})
