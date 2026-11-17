import { Navigate } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { useT } from '../../i18n'
import { useDevMode } from '../../lib/devMode'
import { AssistantChat } from './AssistantChat'

/** /assistant — SOMO as a page, reachable from developer tools; everywhere else it opens as a sheet (SomoButton). */
export function AssistantPage() {
  const text = useT().assistant
  const devMode = useDevMode()

  // The prototype is reachable from developer tools only; anyone else lands on Domov.
  if (!devMode) return <Navigate to="/" replace />

  // Full-screen like the lesson player: no tab bar, so the input bar needs no offset above it.
  return (
    <div className="mx-auto flex h-dvh max-w-[480px] flex-col px-4">
      <header className="shrink-0 pt-2">
        <BackButton fallback="/profile" />
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{text.title}</h1>
      </header>
      <AssistantChat />
    </div>
  )
}
