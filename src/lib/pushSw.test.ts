import { describe, expect, it, vi } from 'vitest'
import source from '../../public/push-sw.js?raw'

// Runs public/push-sw.js against a fake service worker global.

interface FakeWindow {
  url: string
  focus: () => Promise<unknown>
  navigate: (url: string) => Promise<unknown>
}

interface FakeEvent {
  data?: { json(): unknown }
  notification?: { close(): void; data?: { url?: string } }
}

type Listener = (event: FakeEvent & { waitUntil(promise: Promise<unknown>): void }) => void

function loadWorker(windows: FakeWindow[] = [], show: () => Promise<void> = async () => {}) {
  const listeners = new Map<string, Listener>()
  const showNotification = vi.fn(async (_title: string, _options: Record<string, unknown>) => show())
  const openWindow = vi.fn(async (_url: string) => null)
  const fetch = vi.fn(async (_url: string, _init: { method: string; body: string }) => ({ ok: true }))
  const self = {
    location: { origin: 'https://somos.example' },
    registration: { showNotification, pushManager: { getSubscription: async () => ({ endpoint: 'https://push.example/abc' }) } },
    clients: { matchAll: async () => windows, openWindow },
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    fetch,
  }
  new Function('self', source)(self)

  async function dispatch(type: string, event: FakeEvent) {
    let pending: Promise<unknown> = Promise.resolve()
    listeners.get(type)?.({ ...event, waitUntil: (promise) => (pending = promise) })
    await pending
  }
  const reports = () => fetch.mock.calls.map(([url, init]) => ({ url, method: init.method, body: JSON.parse(init.body) as unknown }))
  return { dispatch, showNotification, openWindow, reports }
}

describe('push-sw.js', () => {
  it('alerts again when a new reminder replaces one still on screen', async () => {
    const worker = loadWorker()
    await worker.dispatch('push', { data: { json: () => ({ title: 'Ešte 8 do denného cieľa', body: 'Dnes 12/20', url: '/' }) } })
    expect(worker.showNotification).toHaveBeenCalledWith(
      'Ešte 8 do denného cieľa',
      expect.objectContaining({ body: 'Dnes 12/20', tag: 'somos-reminder', renotify: true }),
    )
  })

  it('tells the server that the message arrived and was shown', async () => {
    const worker = loadWorker()
    await worker.dispatch('push', { data: { json: () => ({ title: 'SOMOS', body: 'x', id: '2026-07-01T17:10:00.000Z' }) } })
    expect(worker.reports()).toEqual([
      { url: '/api/reminder', method: 'POST', body: { type: 'received', endpoint: 'https://push.example/abc', id: '2026-07-01T17:10:00.000Z', shown: true } },
    ])
  })

  it('tells the server why a message could not be shown', async () => {
    const worker = loadWorker([], async () => Promise.reject(new TypeError('No notification permission has been granted')))
    await worker.dispatch('push', { data: { json: () => ({ title: 'SOMOS', id: 'm1' }) } })
    expect(worker.reports()[0].body).toEqual({
      type: 'received',
      endpoint: 'https://push.example/abc',
      id: 'm1',
      shown: false,
      error: 'TypeError: No notification permission has been granted',
    })
  })

  it('has nothing to confirm for a message without an id', async () => {
    const worker = loadWorker()
    await worker.dispatch('push', { data: { json: () => ({ title: 'SOMOS' }) } })
    expect(worker.showNotification).toHaveBeenCalled()
    expect(worker.reports()).toEqual([])
  })

  it('brings an open window to the front without navigating it (a lesson stays as it was)', async () => {
    const lesson: FakeWindow = { url: 'https://somos.example/practice/lesson', focus: vi.fn(async () => undefined), navigate: vi.fn(async () => undefined) }
    const worker = loadWorker([lesson])
    const close = vi.fn()
    await worker.dispatch('notificationclick', { notification: { close, data: { url: '/' } } })
    expect(close).toHaveBeenCalled()
    expect(lesson.focus).toHaveBeenCalled()
    expect(lesson.navigate).not.toHaveBeenCalled()
    expect(worker.openWindow).not.toHaveBeenCalled()
  })

  it('opens the app when no window is open', async () => {
    const worker = loadWorker()
    await worker.dispatch('notificationclick', { notification: { close: () => {}, data: { url: '/' } } })
    expect(worker.openWindow).toHaveBeenCalledWith('/')
  })
})
