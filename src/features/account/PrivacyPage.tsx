import { BackButton } from '../../components/BackButton'
import { useT } from '../../i18n'

/** The privacy policy, linked from the sign-in page (Google asks for one). */
export function PrivacyPage() {
  const text = useT().privacy
  return (
    <div>
      <BackButton fallback="/archive/settings" />
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">{text.title}</h1>
      <p className="mt-1 text-sm text-ink-muted">{text.updated}</p>
      <div className="mt-6 space-y-6">
        {text.sections.map(({ heading, body }) => (
          <section key={heading}>
            <h2 className="font-serif text-xl font-semibold">{heading}</h2>
            <p className="mt-1.5 leading-relaxed text-ink-muted">{body}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
