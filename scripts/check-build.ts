// Checks the finished build (`npm run build` first): every file the app needs offline is in the service worker's
// precache. Workbox leaves out a file over maximumFileSizeToCacheInBytes (vite.config.ts, 4 MB) with only a warning,
// and the app then silently stops working offline: the main chunk carries all the content and keeps growing.
// Run with `npm run check:build`; CI runs it after the build (docs/launch-audit-2026-11-05.md, O4).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'
/** Workbox's limit in vite.config.ts. */
const LIMIT = 4 * 1024 * 1024
/** Fail well before it: a content batch adds a few hundred kB. */
const WARN_AT = 3.5 * 1024 * 1024

const sw = readFileSync(join(DIST, 'sw.js'), 'utf8')
const precached = new Set([...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]))

const errors: string[] = []
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`

for (const name of readdirSync(join(DIST, 'assets'))) {
  if (!/\.(js|css)$/.test(name)) continue
  const path = `assets/${name}`
  const size = statSync(join(DIST, path)).size
  if (!precached.has(path)) errors.push(`${path} (${mb(size)}) is not precached: the app will not work offline`)
  else if (size > WARN_AT) errors.push(`${path} is ${mb(size)}, close to the ${mb(LIMIT)} precache limit: split the content before it is left out`)
}
for (const path of ['index.html', 'theme-init.js', 'push-sw.js', 'manifest.webmanifest']) {
  if (!precached.has(path)) errors.push(`${path} is not precached`)
}

const main = [...precached].filter((p) => /^assets\/index-.*\.js$/.test(p)).map((p) => `${p} ${mb(statSync(join(DIST, p)).size)}`)
if (errors.length) {
  console.error(`Build check failed:\n  ${errors.join('\n  ')}`)
  process.exit(1)
}
console.log(`Build check: ${precached.size} files precached; main chunk ${main.join(', ')} (limit ${mb(LIMIT)}, fails at ${mb(WARN_AT)})`)
