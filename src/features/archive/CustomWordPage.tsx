import { ChevronDown, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { Button } from '../../components/Button'
import { NotFound } from '../../components/NotFound'
import { SpeakButton } from '../../components/SpeakButton'
import { topics, words } from '../../data'
import { deleteCustomWord, saveCustomWord, useCustomWord } from '../../lib/archive'
import type { CustomWord } from '../../lib/db'
import { fold } from '../../lib/text'

const INPUT =
  'w-full rounded-2xl border border-line bg-surface px-4 text-base transition-colors duration-150 placeholder:text-ink-muted focus:border-brick focus:outline-none aria-invalid:border-error'

/** /archive/new and /archive/custom/:id */
export function CustomWordPage() {
  const { id } = useParams()
  const existing = useCustomWord(id ?? '')

  if (id && existing === undefined) return null // loading from IndexedDB
  if (id && !existing) return <NotFound title="Slovo sa nenašlo" />
  return <CustomWordForm key={id ?? 'new'} word={existing ?? undefined} />
}

interface Errors {
  es?: string
  sk?: string
}

function CustomWordForm({ word }: { word?: CustomWord }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [es, setEs] = useState(word?.es ?? '')
  const [sk, setSk] = useState(word?.sk ?? '')
  const [note, setNote] = useState(word?.note ?? '')
  const [topic, setTopic] = useState(word?.topic ?? '')
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const esRef = useRef<HTMLInputElement>(null)
  const skRef = useRef<HTMLInputElement>(null)

  // Already in the dictionary? Offer the real entry (with examples and conjugation).
  const duplicate = useMemo(() => {
    const folded = fold(es.trim())
    return folded ? words.find((w) => fold(w.es.replace(/[¿?¡!]/g, '')) === folded) : undefined
  }, [es])

  // The delete confirmation expires so a later stray tap can't delete.
  useEffect(() => {
    if (!confirmDelete) return
    const timer = setTimeout(() => setConfirmDelete(false), 4000)
    return () => clearTimeout(timer)
  }, [confirmDelete])

  const leave = () => {
    if (location.key === 'default') void navigate('/archive?tab=mine', { replace: true })
    else void navigate(-1)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: Errors = {
      es: es.trim() ? undefined : 'Vyplň slovo po španielsky.',
      sk: sk.trim() ? undefined : 'Vyplň preklad po slovensky.',
    }
    setErrors(next)
    if (next.es) return esRef.current?.focus()
    if (next.sk) return skRef.current?.focus()

    setBusy(true)
    await saveCustomWord({ es, sk, note, topic }, word?.id)
    leave()
  }

  const remove = async () => {
    if (!word) return
    if (!confirmDelete) return setConfirmDelete(true)
    setBusy(true)
    await deleteCustomWord(word.id)
    leave()
  }

  return (
    <div>
      <BackButton fallback="/archive?tab=mine" />
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">{word ? 'Upraviť slovo' : 'Nové slovo'}</h1>

      <form onSubmit={(e) => void submit(e)} noValidate className="mt-6 space-y-5">
        <div>
          <label htmlFor="cw-es" className="mb-1.5 block text-sm font-medium">
            Po španielsky
          </label>
          <div className="flex items-center gap-1">
            <input
              ref={esRef}
              id="cw-es"
              lang="es"
              value={es}
              onChange={(e) => setEs(e.target.value)}
              placeholder="napr. chamba"
              autoCapitalize="off"
              autoComplete="off"
              aria-invalid={Boolean(errors.es)}
              aria-describedby={errors.es ? 'cw-es-error' : undefined}
              className={`${INPUT} h-12 font-serif text-lg`}
            />
            {es.trim() && <SpeakButton text={es.trim()} />}
          </div>
          {errors.es && (
            <p id="cw-es-error" className="mt-1.5 text-sm text-error">
              {errors.es}
            </p>
          )}
          {duplicate && (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <span>
                „<span lang="es">{duplicate.es}</span>“ už je v slovníku.
              </span>
              <Link to={`/word/${duplicate.id}`} className="shrink-0 font-semibold text-brick underline-offset-4 hover:underline">
                Otvoriť
              </Link>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="cw-sk" className="mb-1.5 block text-sm font-medium">
            Po slovensky
          </label>
          <input
            ref={skRef}
            id="cw-sk"
            value={sk}
            onChange={(e) => setSk(e.target.value)}
            placeholder="napr. robota, práca"
            autoComplete="off"
            aria-invalid={Boolean(errors.sk)}
            aria-describedby={errors.sk ? 'cw-sk-error' : undefined}
            className={`${INPUT} h-12`}
          />
          {errors.sk && (
            <p id="cw-sk-error" className="mt-1.5 text-sm text-error">
              {errors.sk}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="cw-note" className="mb-1.5 block text-sm font-medium">
            Poznámka <span className="font-normal text-ink-muted">(nepovinné)</span>
          </label>
          <textarea
            id="cw-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="napr. hovorovo, počul som v Oaxace"
            className={`${INPUT} resize-none py-3`}
          />
        </div>

        <div>
          <label htmlFor="cw-topic" className="mb-1.5 block text-sm font-medium">
            Téma <span className="font-normal text-ink-muted">(nepovinné)</span>
          </label>
          <div className="relative">
            <select
              id="cw-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className={`${INPUT} h-12 appearance-none pr-11`}
            >
              <option value="">Bez témy</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.sk}
                </option>
              ))}
            </select>
            <ChevronDown
              size={18}
              strokeWidth={1.75}
              className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
          </div>
        </div>

        <Button type="submit" disabled={busy} className="w-full">
          {word ? 'Uložiť zmeny' : 'Uložiť slovo'}
        </Button>

        {word && (
          <Button
            variant={confirmDelete ? 'danger-solid' : 'danger'}
            icon={Trash2}
            disabled={busy}
            onClick={() => void remove()}
            className="w-full"
          >
            {confirmDelete ? 'Naozaj vymazať?' : 'Vymazať slovo'}
          </Button>
        )}
      </form>
    </div>
  )
}
