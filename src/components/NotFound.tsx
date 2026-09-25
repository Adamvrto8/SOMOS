import { Link } from 'react-router'
import { BackButton } from './BackButton'

interface NotFoundProps {
  title: string
}

export function NotFound({ title }: NotFoundProps) {
  return (
    <div>
      <BackButton fallback="/search" />
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-ink-muted">
        Skús ho nájsť cez{' '}
        <Link to="/search" className="font-medium text-brick underline underline-offset-4">
          vyhľadávanie
        </Link>
        .
      </p>
    </div>
  )
}
