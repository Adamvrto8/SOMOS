// Imported into the generated service worker (vite.config.ts → workbox.importScripts).
// Shows the practice reminder sent by api/reminder.ts and brings SOMOS up when it is tapped.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // Not JSON: fall back to the defaults below.
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'SOMOS', {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/badge-96x96.png',
      tag: 'somos-reminder',
      lang: 'sk',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Focus as it is: navigating an open window could throw away a lesson in progress.
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
      return open ? open.focus() : self.clients.openWindow(url)
    }),
  )
})
