import { Link } from 'react-router'
import { useT } from '../i18n'
import { BackButton } from './BackButton'

interface NotFoundProps {
  title: string
}

export function NotFound({ title }: NotFoundProps) {
  const text = useT().common
  return (
    <div>
      <BackButton fallback="/search" />
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-ink-muted">
        {text.notFoundBefore}{' '}
        <Link to="/search" className="font-medium text-brick underline underline-offset-4">
          {text.notFoundLink}
        </Link>
        .
      </p>
    </div>
  )
}
