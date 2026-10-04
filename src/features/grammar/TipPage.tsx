import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { tipById } from '../../data'
import { useT } from '../../i18n'
import { TipContent } from './TipContent'

const LIST = '/practice/grammar'

/** One tip of the handbook. */
export function TipPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const text = useT().grammar
  const tip = tipById.get(id)

  // "Pozri aj" leads to another tip on the same route: start reading it from the top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  if (!tip) {
    return (
      <div>
        <BackButton fallback={LIST} />
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">{text.notFound}</h1>
        <p className="mt-2 text-ink-muted">
          {text.seeBefore}{' '}
          <Link to={LIST} className="font-medium text-brick underline underline-offset-4">
            {text.seeLink}
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div>
      <BackButton fallback={LIST} />
      <div className="mt-2">
        <TipContent tip={tip} onOpenTip={(other) => void navigate(`${LIST}/${other}`)} />
      </div>
    </div>
  )
}
