import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router'
import { getOnboarding, shouldOnboard } from '../../lib/onboarding'

/**
 * The developer on localhost goes straight to Domov (nothing is stored: Nástroje pre vývoj still open the welcome).
 * Not under Playwright, which also runs on localhost and tests the welcome.
 */
const skipOnLocalhost =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) &&
  !navigator.webdriver

/**
 * Domov for a learner who has been through the welcome (or learned before it existed), the welcome for
 * a new one. Only Domov asks: a duel invite or a word link opens what it points to.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  // Known at once on every launch but the first: Domov does not flash before the welcome.
  const [welcome, setWelcome] = useState<boolean | null>(() => (skipOnLocalhost || getOnboarding()?.done ? false : null))

  useEffect(() => {
    if (welcome !== null) return
    let active = true
    void shouldOnboard()
      .catch(() => false) // without IndexedDB, Domov rather than a welcome every time
      .then((show) => {
        if (active) setWelcome(show)
      })
    return () => {
      active = false
    }
  }, [welcome])

  if (welcome === null) return null
  return welcome ? <Navigate to="/welcome" replace /> : children
}
