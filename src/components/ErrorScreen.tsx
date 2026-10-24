import { House, RotateCw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useRouteError } from 'react-router'
import { useT } from '../i18n'
import { Button } from './Button'

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error))

/**
 * What a crash leaves instead of a white page. Full screen on its own, without the layout:
 * the layout may be what crashed. A reload also brings a new deploy whose files the old page could not load.
 */
export function ErrorScreen({ error }: { error: unknown }) {
  const text = useT().error
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center bg-bg px-4 py-10 text-ink">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">{text.title}</h1>
      <p className="mt-3 text-ink-muted">{text.body}</p>
      <div className="mt-8 flex flex-col gap-3">
        <Button icon={RotateCw} onClick={() => window.location.reload()}>
          {text.reload}
        </Button>
        <Button variant="secondary" icon={House} onClick={() => window.location.assign('/')}>
          {text.home}
        </Button>
      </div>
      <details className="mt-8 text-sm text-ink-muted">
        <summary className="cursor-pointer">{text.details}</summary>
        <p className="mt-2 font-mono break-words">{describe(error)}</p>
      </details>
    </div>
  )
}

/** The router's errorElement: a screen that threw while rendering. */
export function RouteErrorScreen() {
  return <ErrorScreen error={useRouteError()} />
}

/** Catches what the router does not: errors outside its routes (the goal's sun) and in the router itself. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error: error ?? 'unknown' } // `throw null` still counts as a crash
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    return this.state.error ? <ErrorScreen error={this.state.error} /> : this.props.children
  }
}
