import { defineConfig } from '@playwright/test'

// Its own dev server: the one Adam keeps running on 5173 is never touched.
const PORT = 5199

// Browser tests of the screens (e2e/): a phone-sized Chrome with touch, tapping like a finger.
// `npm run test:e2e`. Unit tests of the logic stay in vitest (`npm test`).
export default defineConfig({
  testDir: 'e2e',
  // Inside node_modules: nothing to add to .gitignore.
  outputDir: 'node_modules/.cache/e2e',
  fullyParallel: true,
  forbidOnly: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome', // the installed Chrome, no browser download
    viewport: { width: 375, height: 800 },
    hasTouch: true,
    isMobile: true,
    locale: 'sk-SK',
    // The tests only talk to localhost. Without this, each fresh Chrome first looks for a proxy on the
    // network (WPAD), and with a flaky DNS that lookup stalls the very first page load until the test times out.
    launchOptions: { args: ['--no-proxy-server'] },
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: true,
  },
})
