// Imported into the generated service worker (vite.config.ts → workbox.importScripts).
// Shows the practice reminder sent by api/reminder.ts, tells the server that it arrived, and brings
// SOMOS up when it is tapped.

// The push service accepting a message says nothing about the phone getting it: this receipt does.
// It names the message by its id and says whether Android took the notification.
function confirm(id, shown, error) {
  if (!id) return Promise.resolve()
  return self.registration.pushManager
    .getSubscription()
    .then((subscription) => {
      if (!subscription) return
      const body = { type: 'received', endpoint: subscription.endpoint, id, shown, ...(error ? { error } : {}) }
      return self.fetch('/api/reminder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    })
    .catch(() => {
      // Best effort: the notification matters, the receipt is only for finding out what went wrong.
    })
}

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // Not JSON: fall back to the defaults below.
  }
  event.waitUntil(
    self.registration
      .showNotification(data.title || 'SOMOS', {
        body: data.body || '',
        icon: '/pwa-192x192.png',
        badge: '/badge-96x96.png',
        tag: 'somos-reminder',
        // Without it, replacing yesterday's unread reminder (same tag) would be silent.
        renotify: true,
        lang: data.lang || 'sk',
        data: { url: data.url || '/' },
      })
      .then(
        () => confirm(data.id, true),
        (error) => confirm(data.id, false, String(error)),
      ),
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
