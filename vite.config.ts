import { sentryVitePlugin } from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const ONE_YEAR = 60 * 60 * 24 * 365

/** Shown in Nastavenia, so the phone's version can be compared with the Vercel deployment; also Sentry's release. */
const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev' // || : an empty SHA too (api/usage.ts refuses an empty version)

// Only on Vercel with Sentry set up (docs/error-reports-setup.md): source maps go to Sentry, so a report
// points at our code, and are deleted before the deploy. Locally and in CI the build stays without them.
const SENTRY_UPLOAD = Boolean(process.env.SENTRY_AUTH_TOKEN)

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILD_TIME__: JSON.stringify(Date.now()),
  },
  build: {
    sourcemap: SENTRY_UPLOAD ? 'hidden' : false,
    rolldownOptions: {
      output: {
        // Libraries change rarely: a separate chunk means a deploy only re-downloads app code.
        // Supabase's library has its own, loaded only for accounts (src/lib/account.ts), and so has
        // Sentry's, loaded after the start (src/lib/errorReports.ts).
        codeSplitting: {
          groups: [
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/, priority: 2 },
            { name: 'sentry', test: /node_modules[\\/]@sentry[\\/]/, priority: 2 },
            { name: 'vendor', test: /node_modules/, priority: 1 },
          ],
        },
      },
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // workbox.globPatterns already precaches everything in public/, icons included.
      includeManifestIcons: false,
      manifest: {
        name: 'SOMOS',
        short_name: 'SOMOS',
        description: 'Mexická španielčina zo slovenčiny',
        lang: 'sk',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        // --bg from src/styles/tokens.css (light theme)
        theme_color: '#F4F1EC',
        background_color: '#F4F1EC',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the whole app shell (and JSON content once it exists in the build).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Practice reminders (api/reminder.ts): shows the push notification, handles the tap.
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-css',
              expiration: { maxEntries: 10, maxAgeSeconds: ONE_YEAR },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 30, maxAgeSeconds: ONE_YEAR },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
    // Last, as Sentry asks: it reads the files the other plugins produced.
    SENTRY_UPLOAD &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: { name: APP_VERSION },
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        telemetry: false,
      }),
  ],
})
