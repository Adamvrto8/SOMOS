import { ChevronLeft } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'

interface BackButtonProps {
  // Where to go when the page was opened directly (no history in this app).
  fallback: string
}

export function BackButton({ fallback }: BackButtonProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const goBack = () => {
    // "default" is the key of the first entry in the session's history.
    if (location.key === 'default') void navigate(fallback)
    else void navigate(-1)
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="-ml-3 flex h-11 items-center gap-1 rounded-full pr-4 pl-2 text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick"
    >
      <ChevronLeft size={20} strokeWidth={1.75} aria-hidden />
      Späť
    </button>
  )
}
