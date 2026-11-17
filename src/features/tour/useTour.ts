import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'

/**
 * The tour runs on its own history entry, like SOMO's sheet: the phone's Back closes it and stays on Domov.
 * `/?tour=1` (Profil → Zopakovať zoznámenie) starts it; the address is cleaned so a reload does not start it again.
 */
export function useTour() {
  const location = useLocation()
  const navigate = useNavigate()
  const touring = (location.state as { tour?: unknown } | null)?.tour === true
  const replay = new URLSearchParams(location.search).get('tour') === '1'
  const handled = useRef(false) // StrictMode runs the effect twice in development

  const start = useCallback(() => void navigate('/', { state: { tour: true }, preventScrollReset: true }), [navigate])

  const close = useCallback(() => {
    // Started in this session: step back to Domov. From a reloaded entry: just drop the flag.
    if (((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0) void navigate(-1)
    else void navigate('/', { replace: true, preventScrollReset: true })
  }, [navigate])

  useEffect(() => {
    if (!replay || handled.current) return
    handled.current = true
    void navigate('/', { replace: true })
    void navigate('/', { state: { tour: true } })
  }, [replay, navigate])

  return { touring, start, close }
}
