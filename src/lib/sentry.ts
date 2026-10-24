import { captureException, init, type BrowserOptions } from '@sentry/react'

// The part of Sentry the app uses, loaded on its own by errorReports.ts. Named imports, so the build leaves
// out what is not used (replay, feedback, tracing): importing the whole package would bring all of it.

export { captureException }

export function startSentry(options: BrowserOptions) {
  init(options)
}
