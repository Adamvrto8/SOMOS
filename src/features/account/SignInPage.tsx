import { Mail } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import { accountsAvailable, completeOAuth, sendCode, signInWithGoogle, useAccount, verifyCode } from '../../lib/account'
import { takeReturnAfterSignIn } from '../../lib/onboarding'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FIELD =
  'h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base text-ink placeholder:text-ink-muted focus:border-brick focus:outline-none focus-visible:ring-1 focus-visible:ring-brick'

/** The Google "G", in its own colours. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/**
 * Signing in: Google, or an e-mail and the 6-digit code sent to it. Google returns here with ?code=,
 * which finishes the sign-in. Signed in, it leads back to Nastavenia (or to the welcome, see takeReturnAfterSignIn).
 */
export function SignInPage() {
  const text = useT().account
  const account = useAccount()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const returning = params.has('code')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(params.has('error') ? text.failed : null)
  const [busy, setBusy] = useState(returning)
  const codeField = useRef<HTMLInputElement>(null)

  // Profil, or where the welcome or the first lesson sent the learner from.
  const done = () => void navigate(takeReturnAfterSignIn() ?? '/profile', { replace: true })

  useEffect(() => {
    if (!returning || !accountsAvailable) return
    let active = true
    completeOAuth()
      .then((ok) => {
        if (!active) return
        if (ok) done()
        else {
          setBusy(false)
          setError(text.failed)
        }
      })
      .catch(() => {
        if (!active) return
        setBusy(false)
        setError(text.failed)
      })
    return () => {
      active = false
    }
    // Once, on the page Google returned to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (step === 'code') codeField.current?.focus()
  }, [step])

  const attempt = async (action: () => Promise<void>, message: string) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch {
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  const submitEmail = (e: FormEvent) => {
    e.preventDefault()
    const address = email.trim()
    if (!EMAIL.test(address)) return setError(text.badEmail)
    void attempt(async () => {
      await sendCode(address)
      setEmail(address)
      setStep('code')
    }, text.failed)
  }

  const submitCode = (e: FormEvent) => {
    e.preventDefault()
    void attempt(async () => {
      await verifyCode(email, code.replace(/\s/g, ''))
      done()
    }, text.badCode)
  }

  if (!accountsAvailable) {
    return (
      <div>
        <BackButton fallback="/profile" />
        <p className="mt-6 text-ink-muted">{text.unavailable}</p>
      </div>
    )
  }

  return (
    <div>
      <BackButton fallback="/profile" />
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">{text.signInTitle}</h1>

      {account && !busy ? (
        <div className="mt-6 space-y-4">
          <p className="font-medium">{text.signedIn(account.email)}</p>
          <Button onClick={done} className="w-full">
            {text.toSettings}
          </Button>
        </div>
      ) : returning && busy ? (
        <p role="status" className="mt-6 text-ink-muted">
          {text.finishing}
        </p>
      ) : (
        <div className="mt-2 space-y-6">
          <p className="leading-relaxed text-ink-muted">{text.signInIntro}</p>

          <button
            type="button"
            disabled={busy}
            onClick={() => void attempt(signInWithGoogle, text.failed)}
            className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-line bg-surface px-5 font-semibold text-ink transition duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick disabled:opacity-50"
          >
            <GoogleMark />
            {text.google}
          </button>

          <div className="flex items-center gap-3 text-sm text-ink-muted" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            {text.orEmail}
            <span className="h-px flex-1 bg-line" />
          </div>

          {step === 'email' ? (
            <form onSubmit={submitEmail} className="space-y-3" noValidate>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">{text.email}</span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={text.emailPlaceholder}
                  className={FIELD}
                />
              </label>
              <Button type="submit" icon={Mail} disabled={busy || email.trim() === ''} className="w-full">
                {text.sendCode}
              </Button>
            </form>
          ) : (
            <form onSubmit={submitCode} className="space-y-3">
              <p className="text-sm text-ink-muted">{text.codeSent(email)}</p>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">{text.code}</span>
                <input
                  ref={codeField}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={`${FIELD} text-center font-serif text-2xl tracking-[0.4em] tabular-nums`}
                />
              </label>
              <Button type="submit" disabled={busy || code.replace(/\s/g, '').length < 6} className="w-full">
                {text.confirm}
              </Button>
              <div className="flex justify-between gap-3 text-sm">
                <button type="button" className="min-h-11 text-brick hover:underline" onClick={() => (setStep('email'), setCode(''), setError(null))}>
                  {text.otherEmail}
                </button>
                <button type="button" disabled={busy} className="min-h-11 text-brick hover:underline" onClick={() => void attempt(() => sendCode(email), text.failed)}>
                  {text.resend}
                </button>
              </div>
            </form>
          )}

          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}

          <p className="text-xs text-ink-muted">
            {text.privacyNote}{' '}
            <Link to="/privacy" className="text-brick underline-offset-2 hover:underline">
              {text.privacy}
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
