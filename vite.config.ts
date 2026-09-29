import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const ONE_YEAR = 60 * 60 * 24 * 365

// https://vite.dev/config/
export default defineConfig({
  define: {
    // Shown in Nastavenia, so the phone's version can be compared with the Vercel deployment.
    __APP_VERSION__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev'),
    __BUILD_TIME__: JSON.stringify(Date.now()),
  },
  build: {
    rolldownOptions: {
      output: {
        // Libraries change rarely: a separate chunk means a deploy only re-downloads app code.
        codeSplitting: { groups: [{ name: 'vendor', test: /node_modules/ }] },
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
  ],
})
