import { Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { Segmented } from '../../components/Segmented'
import { useT } from '../../i18n'
import { getClient, useAccount } from '../../lib/account'
import { copyText, currentContent, groupReports, type ReportGroup, type StoredReport } from '../../lib/contentReportsAdmin'
import { parseReportError, type UsageReportError } from '../../lib/usageReport'
import { SettingsHint, SettingsSubpage } from './SettingsSubpage'

type Tab = 'open' | 'handled'

/** Rejects with a UsageReportError ('forbidden' for an account not in usage_admins). */
async function loadReports(status: Tab): Promise<StoredReport[]> {
  const client = await getClient()
  const { data, error } = await client.rpc('content_reports_list', { p_status: status })
  if (error) throw parseReportError(error)
  return data as StoredReport[]
}

async function handleGroup(target: string, status: 'open' | 'fixed' | 'rejected'): Promise<void> {
  const client = await getClient()
  const { error } = await client.rpc('content_reports_handle', { p_target: target, p_status: status })
  if (error) throw parseReportError(error)
}

const date = (iso: string) => new Date(iso).toLocaleDateString()

function Group({ group, tab, onHandle }: { group: ReportGroup; tab: Tab; onHandle: (status: 'open' | 'fixed' | 'rejected') => void }) {
  const dictionary = useT()
  const text = dictionary.settings.dev.reports
  const [kind, id] = group.target.split(':')
  const newest = group.reports[0]
  const now = currentContent(group.target, newest.detail)
  const changed = !now || now.es !== newest.shown.es || now.translation !== newest.shown.translation

  return (
    <article className="space-y-3 rounded-card border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">
          {text.kinds[kind] ?? kind} {id}
          {newest.detail && <span className="font-normal text-ink-muted"> · {newest.detail}</span>}
        </h2>
        <span className="shrink-0 text-sm text-ink-muted tabular-nums">{group.reports.length}×</span>
      </div>

      <div className="text-sm">
        <p>
          <span className="text-ink-muted">{text.seen}: </span>
          <span lang="es" className="font-serif text-base">
            {newest.shown.es}
          </span>
        </p>
        <p className="text-ink-muted">{newest.shown.translation}</p>
        {changed && (
          <p className="mt-1">
            <span className="text-ink-muted">{text.now}: </span>
            {now ? (
              <>
                <span lang="es" className="font-serif text-base">
                  {now.es}
                </span>
                <span className="text-ink-muted"> — {now.translation}</span>
              </>
            ) : (
              <span className="text-error">{text.gone}</span>
            )}
          </p>
        )}
        {kind === 'word' && now && (
          <Link to={`/word/${id}`} className="mt-1 inline-block text-brick underline underline-offset-2">
            {text.openWord}
          </Link>
        )}
      </div>

      <ul className="divide-y divide-line border-t border-line text-sm">
        {group.reports.map((r) => (
          <li key={r.id} className="py-2">
            <p>
              <b className="font-medium">{dictionary.report.reasons[r.reason]}</b>
              {r.answer && (
                <span>
                  {' '}
                  · {text.answer}:{' '}
                  <span lang="es" className="font-serif">
                    {r.answer}
                  </span>
                </span>
              )}
            </p>
            {r.note && <p className="mt-0.5">{r.note}</p>}
            <p className="mt-0.5 text-xs text-ink-muted">
              {date(r.created_at)} · {r.exercise}
              {r.detail && r.detail !== newest.detail && ` · ${r.detail}`}
              {tab === 'handled' && ` · ${text.statuses[r.status] ?? r.status}`}
            </p>
          </li>
        ))}
      </ul>

      {tab === 'open' ? (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => onHandle('rejected')}>
            {text.rejected}
          </Button>
          <Button onClick={() => onHandle('fixed')}>{text.fixed}</Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => onHandle('open')} className="w-full">
          {text.reopen}
        </Button>
      )}
    </article>
  )
}

/** Nástroje pre vývoj → Nahlásený obsah (docs/superpowers/specs/2026-10-25-content-reports-design.md). */
export function ContentReports() {
  const dictionary = useT()
  const dev = dictionary.settings.dev
  const text = dev.reports
  const account = useAccount()
  const [tab, setTab] = useState<Tab>('open')
  const [attempt, setAttempt] = useState(0)
  const [copied, setCopied] = useState(false)
  // What the last request brought, under the request it answers: another tab shows nothing until its own answer.
  const [result, setResult] = useState<{ key: string; reports?: StoredReport[]; error?: UsageReportError } | null>(null)
  const [openCount, setOpenCount] = useState<number | null>(null)
  const key = `${tab}:${attempt}`

  useEffect(() => {
    if (!account) return
    let active = true
    loadReports(tab).then(
      (reports) => {
        if (!active) return
        setResult({ key, reports })
        if (tab === 'open') setOpenCount(reports.length)
      },
      (reason: unknown) => {
        if (active) setResult({ key, error: reason === 'forbidden' ? 'forbidden' : 'offline' })
      },
    )
    return () => {
      active = false
    }
  }, [account, tab, key])

  const current = result?.key === key ? result : null
  const groups = current?.reports ? groupReports(current.reports) : null

  const handle = (target: string, status: 'open' | 'fixed' | 'rejected') => {
    handleGroup(target, status).then(
      () => setAttempt((n) => n + 1),
      (reason: unknown) => setResult({ key, error: reason === 'forbidden' ? 'forbidden' : 'offline' }),
    )
  }

  const copy = () => {
    if (!groups) return
    void navigator.clipboard.writeText(copyText(groups, dictionary.report.reasons)).then(() => setCopied(true))
  }

  return (
    <SettingsSubpage title={dev.contentReports}>
      {!account ? (
        <SettingsHint>{text.signIn}</SettingsHint>
      ) : (
        <>
          <Segmented<Tab>
            mode="radio"
            label={text.tabs}
            idPrefix="reports-tab"
            value={tab}
            onChange={(next) => {
              setCopied(false)
              setTab(next)
            }}
            options={[
              { id: 'open', label: openCount === null ? text.open : text.openCount(openCount) },
              { id: 'handled', label: text.handled },
            ]}
          />
          {current?.error === 'forbidden' ? (
            <SettingsHint>{text.forbidden}</SettingsHint>
          ) : current?.error ? (
            <div>
              <SettingsHint>{text.failed}</SettingsHint>
              <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)} className="mt-3">
                {text.retry}
              </Button>
            </div>
          ) : groups && groups.length === 0 ? (
            <SettingsHint>{text.empty}</SettingsHint>
          ) : (
            groups && (
              <>
                {tab === 'open' && (
                  <div>
                    <Button variant="secondary" icon={Copy} onClick={copy} className="w-full">
                      {text.copy}
                    </Button>
                    {copied && (
                      <p role="status" className="mt-2 px-1 text-sm text-ink-muted">
                        {text.copied}
                      </p>
                    )}
                  </div>
                )}
                {groups.map((group) => (
                  <Group key={group.target} group={group} tab={tab} onHandle={(status) => handle(group.target, status)} />
                ))}
              </>
            )
          )}
        </>
      )}
    </SettingsSubpage>
  )
}
