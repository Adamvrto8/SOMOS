import { defineConfig } from 'vitest/config'

// Unit tests for pure logic in src/lib (no DOM, no PWA plugin).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
