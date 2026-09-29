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

function loadWorker(windows: FakeWindow[] = []) {
  const listeners = new Map<string, Listener>()
  const showNotification = vi.fn(async (_title: string, _options: Record<string, unknown>) => {})
  const openWindow = vi.fn(async (_url: string) => null)
  const self = {
    location: { origin: 'https://somos.example' },
    registration: { showNotification },
    clients: { matchAll: async () => windows, openWindow },
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
  }
  new Function('self', source)(self)

  async function dispatch(type: string, event: FakeEvent) {
    let pending: Promise<unknown> = Promise.resolve()
    listeners.get(type)?.({ ...event, waitUntil: (promise) => (pending = promise) })
    await pending
  }
  return { dispatch, showNotification, openWindow }
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
