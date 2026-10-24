import type { Breadcrumb } from '@sentry/react'

// Crash reports from the learners' phones (Sentry, docs/error-reports-setup.md). Only errors: no session counts,
// no performance tracing, no screen recording, no user, cookies, headers or query strings. The library loads
// once the app has started, and errors from before that wait in a queue.
// Without VITE_SENTRY_DSN, and on the dev server, nothing is loaded or sent.

const DSN = import.meta.env.VITE_SENTRY_DSN

/** At most this many errors wait for the library: a loop of the same crash must not pile up. */
const MAX_QUEUED = 20

export interface ErrorContext {
  /** Where in the components it crashed, from an error boundary. */
  componentStack?: string
}

interface Sink {
  capture(error: unknown, context?: ErrorContext): void
}

/** Holds errors until the library is there, then hands them over and passes every later one straight on. */
export function createReporter() {
  let sink: Sink | null = null
  const queue: [unknown, ErrorContext | undefined][] = []
  return {
    report(error: unknown, context?: ErrorContext) {
      if (sink) sink.capture(error, context)
      else if (queue.length < MAX_QUEUED) queue.push([error, context])
    },
    connect(next: Sink) {
      sink = next
      for (const [error, context] of queue.splice(0)) next.capture(error, context)
    },
  }
}

/** The address without ?query and #hash: Supabase puts the account's id in the query. */
export function withoutQuery(url: string): string {
  return url.replace(/[?#].*$/, '')
}

/** What happened before a crash, without the console (it may print anything) and without query strings. */
export function cleanBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'console') return null
  const data = breadcrumb.data
  if (!data) return breadcrumb
  const cleaned = { ...data }
  for (const key of ['url', 'from', 'to']) {
    if (typeof cleaned[key] === 'string') cleaned[key] = withoutQuery(cleaned[key])
  }
  return { ...breadcrumb, data: cleaned }
}

const reporter = createReporter()

/** Whether this build sends reports at all (Nástroje pre vývoj say so next to the test button). */
export const errorReportsOn = () => Boolean(DSN) && !import.meta.env.DEV

/** Reports an error that the app caught itself, like the error screens. */
export function reportError(error: unknown, context?: ErrorContext) {
  if (errorReportsOn()) reporter.report(error, context)
}

const whenIdle = (run: () => void) => {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 5000 })
  else window.setTimeout(run, 2000)
}

/** Call first in main.tsx: from here on no crash goes unnoticed, the library itself comes later. */
export function startErrorReports() {
  if (!errorReportsOn()) return
  const onError = (event: ErrorEvent) => reporter.report(event.error ?? event.message)
  const onRejection = (event: PromiseRejectionEvent) => reporter.report(event.reason)
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)

  const load = async () => {
    const Sentry = await import('./sentry')
    Sentry.startSentry({
      dsn: DSN,
      release: __APP_VERSION__,
      environment: 'production',
      // The defaults without session counts (one per launch: that would be usage numbers) and without the console.
      integrations: (defaults) => defaults.filter((integration) => !['BrowserSession', 'Console'].includes(integration.name)),
      dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
      beforeBreadcrumb: cleanBreadcrumb,
    })
    // Sentry's own handlers catch window errors from now on.
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
    reporter.connect({
      capture: (error, context) =>
        Sentry.captureException(error, context?.componentStack ? { contexts: { react: { componentStack: context.componentStack } } } : undefined),
    })
  }
  const start = () => whenIdle(() => void load().catch(() => {}))
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}
