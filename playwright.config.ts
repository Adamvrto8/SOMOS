import { defineConfig } from '@playwright/test'

// Its own dev server: the one Adam keeps running on 5173 is never touched.
// E2E_PORT lets a second copy of the repo (a worktree) run its suite next to this one.
const PORT = Number(process.env.E2E_PORT ?? 5199)

// Browser tests of the screens (e2e/): a phone-sized Chrome with touch, tapping like a finger.
// `npm run test:e2e`. Unit tests of the logic stay in vitest (`npm test`).
export default defineConfig({
  testDir: 'e2e',
  // Inside node_modules: nothing to add to .gitignore.
  outputDir: 'node_modules/.cache/e2e',
  fullyParallel: true,
  forbidOnly: true,
  // GitHub's runner is slower than a desktop: one more try there before a timing test counts as failed.
  retries: process.env.CI ? 1 : 0,
  // On GitHub a failure also becomes a note on the commit, readable without the run's log.
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome', // the installed Chrome, no browser download
    viewport: { width: 375, height: 800 },
    hasTouch: true,
    isMobile: true,
    locale: 'sk-SK',
    // The welcome is done: the tests open Domov as a learner who has been through it.
    // e2e/onboarding.spec.ts starts from a new device instead.
    storageState: {
      cookies: [],
      origins: [{ origin: `http://localhost:${PORT}`, localStorage: [{ name: 'somos-onboarding', value: '{"done":true}' }] }],
    },
    // The tests only talk to localhost, so nothing may wait for the network: with a flaky DNS a fresh
    // Chrome looking for a proxy (WPAD), or the page fetching its Google Fonts, stalls the page load
    // until the test times out. Every other host fails to resolve at once.
    launchOptions: { args: ['--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost'] },
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: true,
    // Accounts switched on against a Supabase that every test answers itself (e2e/account.spec.ts).
    // Duels on the local backend: the tabs of one browser play against each other (src/lib/duel/localBackend.ts).
    env: { VITE_SUPABASE_URL: 'http://supabase.test', VITE_SUPABASE_ANON_KEY: 'e2e-anon-key', VITE_DUEL_BACKEND: 'local' },
  },
})
