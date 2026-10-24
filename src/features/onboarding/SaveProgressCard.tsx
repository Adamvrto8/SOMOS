import { CloudUpload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import { accountsAvailable, SIGN_IN_PATH, useAccount } from '../../lib/account'
import { getOnboarding, returnAfterSignIn, updateOnboarding } from '../../lib/onboarding'

/**
 * Over the result of the first lesson: an account keeps what was just learned. Offered once; the app
 * works the same without one.
 */
export function SaveProgressCard() {
  const text = useT().onboarding.save
  const account = useAccount()
  const navigate = useNavigate()
  // Decided when the result opens: the offer counts as made from then on, even after a reload.
  const [shown, setShown] = useState(() => accountsAvailable && !getOnboarding()?.accountOffered)

  useEffect(() => {
    if (shown) updateOnboarding({ accountOffered: true })
  }, [shown])

  if (!shown || account) return null

  const signIn = () => {
    returnAfterSignIn('/')
    void navigate(SIGN_IN_PATH)
  }

  return (
    <section aria-labelledby="save-progress" className="mb-6 rounded-card border border-brick/40 bg-brick/10 p-5">
      <div className="flex items-start gap-3">
        <CloudUpload size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-brick" aria-hidden />
        <div className="min-w-0">
          <h2 id="save-progress" className="font-semibold">
            {text.title}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{text.hint}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Button onClick={signIn} className="w-full">
          {text.signIn}
        </Button>
        <Button variant="secondary" onClick={() => setShown(false)} className="w-full">
          {text.later}
        </Button>
      </div>
    </section>
  )
}
