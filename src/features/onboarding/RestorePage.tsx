import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import { useAccount } from '../../lib/account'
import { finishOnboarding, hasHistory } from '../../lib/onboarding'
import { syncNow } from '../../lib/sync/scheduler'

/**
 * After "Už mám účet": the account's progress comes down, then Domov. An account without progress
 * (made just now) goes on with the welcome's questions.
 */
export function RestorePage() {
  const text = useT().onboarding.restore
  const account = useAccount()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!account) return
    let active = true
    syncNow()
      .then(hasHistory)
      .then((history) => {
        if (!active) return
        if (history) finishOnboarding()
        void navigate(history ? '/' : '/welcome?step=motivation', { replace: true })
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [account, attempt, navigate])

  // Back from the sign-in without signing in: the welcome again.
  if (!account) return <Navigate to="/welcome" replace />

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-4 px-4 text-center sm:border-x sm:border-line">
      {failed ? (
        <>
          <p role="alert" className="text-ink-muted">
            {text.failed}
          </p>
          <Button
            onClick={() => {
              setFailed(false)
              setAttempt((n) => n + 1)
            }}
            className="w-full"
          >
            {text.retry}
          </Button>
          <Button variant="secondary" onClick={() => void navigate('/welcome?step=motivation', { replace: true })} className="w-full">
            {text.skip}
          </Button>
        </>
      ) : (
        <p role="status" className="font-serif text-2xl font-semibold">
          {text.title}
        </p>
      )}
    </div>
  )
}
