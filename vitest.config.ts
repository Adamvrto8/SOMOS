import { defineConfig } from 'vitest/config'

// Unit tests for pure logic in src/lib and the Vercel functions in api/ (no DOM, no PWA plugin).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
    setupFiles: ['src/test-setup.ts'],
  },
})
