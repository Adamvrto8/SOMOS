import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { Segmented } from '../../components/Segmented'
import { useT } from '../../i18n'
import { getClient, useAccount } from '../../lib/account'
import { lessonRows, MIN_DEVICES, parseReportError, percent, type LessonRow, type UsageReport, type UsageReportError } from '../../lib/usageReport'
import { EXERCISES } from '../exercises/exercises'
import { SettingsHint, SettingsPart, SettingsSubpage } from './SettingsSubpage'

const PERIODS = ['7', '30', '90'] as const
type Period = (typeof PERIODS)[number]
const STEP_ORDER = ['welcome', 'motivation', 'level', 'goal', 'reminder', 'install', 'ready', 'done']

/** Rejects with a UsageReportError. */
async function loadUsageReport(days: number): Promise<UsageReport> {
  const client = await getClient()
  const { data, error } = await client.rpc('usage_report', { p_days: days })
  if (error) throw parseReportError(error)
  return data as UsageReport
}

/** A row with a bar: label, bar scaled to `max`, number. */
function Bar({ label, value, max, note }: { label: string; value: number; max: number; note?: string }) {
  return (
    <li className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 text-sm">
      <span className="truncate">{label}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
        <span className="block h-full rounded-full bg-brick" style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }} />
      </span>
      <span className="text-right text-ink-muted tabular-nums">
        {value}
        {note && ` · ${note}`}
      </span>
    </li>
  )
}

function LessonTable({ rows, nameOf, few }: { rows: LessonRow[]; nameOf: (key: string) => string; few: boolean }) {
  const text = useT().settings.dev.usage
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-ink-muted">
          <tr>
            <th className="px-3 py-2 font-normal" />
            <th className="px-2 py-2 font-normal">{text.started}</th>
            <th className="px-2 py-2 font-normal">{text.finished}</th>
            <th className="px-3 py-2 font-normal">{text.usualStop}</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line">
              <td className="px-3 py-2">{nameOf(r.key)}</td>
              <td className="px-2 py-2">{r.started}</td>
              <td className="px-2 py-2">{few ? r.finished : `${percent(r.finished, r.started) ?? 0} %`}</td>
              {/* usualStop counts the tasks answered: the one they left at is the next. */}
              <td className="px-3 py-2">{r.usualStop === null ? '–' : r.usualStop + 1}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Report({ report }: { report: UsageReport }) {
  const text = useT().settings.dev.usage
  const few = report.devices < MIN_DEVICES
  const share = (part: number, whole: number) => (few ? undefined : `${percent(part, whole) ?? 0} %`)
  const maxActive = Math.max(0, ...report.active.map((d) => d.devices))
  const welcomeMax = Math.max(0, ...Object.values(report.welcome))
  const steps = STEP_ORDER.filter((s) => report.welcome[s] !== undefined)
  const screens = Object.entries(report.screens).sort((a, b) => b[1] - a[1])
  const { returning } = report
  const nextDayShare = share(returning.nextDay, returning.new)
  const weekShare = share(returning.withinWeek, returning.weekOld)

  return (
    <>
      <p className="px-1 text-sm text-ink-muted">
        {text.devices(report.devices)}
        {few && ` · ${text.tooFew}`}
      </p>

      <SettingsPart id="usage-learners" title={text.learners}>
        <div className="space-y-3 rounded-card border border-line bg-surface p-4">
          <p className="text-sm text-ink-muted">{text.activePerDay}</p>
          <div className="flex h-20 items-end gap-0.5" role="img" aria-label={text.activePerDay}>
            {report.active.map((d) => (
              <span
                key={d.day}
                title={`${d.day}: ${d.devices}`}
                className="min-w-0 flex-1 rounded-t bg-brick"
                style={{ height: `${maxActive > 0 ? (d.devices / maxActive) * 100 : 0}%` }}
              />
            ))}
          </div>
          <ul className="space-y-1 text-sm">
            <li>
              {text.newDevices}: <b className="tabular-nums">{returning.new}</b>
            </li>
            <li>
              {text.nextDay}: <b className="tabular-nums">{returning.nextDay}</b>
              {nextDayShare && ` (${nextDayShare})`}
            </li>
            <li>
              {text.withinWeek}: <b className="tabular-nums">{returning.withinWeek}</b> / {returning.weekOld}
              {weekShare && ` (${weekShare})`}
            </li>
          </ul>
        </div>
      </SettingsPart>

      {steps.length > 0 && (
        <SettingsPart id="usage-welcome" title={text.welcome}>
          <ul className="space-y-2 rounded-card border border-line bg-surface p-4">
            {steps.map((s) => (
              <Bar key={s} label={text.steps[s] ?? s} value={report.welcome[s]} max={welcomeMax} note={share(report.welcome[s], welcomeMax)} />
            ))}
          </ul>
        </SettingsPart>
      )}

      <SettingsPart id="usage-types" title={text.exercises}>
        <LessonTable rows={lessonRows(report, 'type')} nameOf={(key) => EXERCISES.find((e) => e.type === key)?.label ?? key} few={few} />
      </SettingsPart>

      <SettingsPart id="usage-levels" title={text.levels}>
        <LessonTable rows={lessonRows(report, 'level')} nameOf={(key) => (key === '-' ? text.allLevels : key)} few={few} />
      </SettingsPart>

      {screens.length > 0 && (
        <SettingsPart id="usage-screens" title={text.screens}>
          <ul className="space-y-2 rounded-card border border-line bg-surface p-4">
            {screens.map(([name, n]) => (
              <Bar key={name} label={text.screenNames[name] ?? name} value={n} max={screens[0][1]} />
            ))}
          </ul>
        </SettingsPart>
      )}
    </>
  )
}

/** Nástroje pre vývoj → Štatistiky používania (docs/superpowers/specs/2026-10-25-usage-stats-design.md). */
export function UsageStats() {
  const dev = useT().settings.dev
  const text = dev.usage
  const account = useAccount()
  const [period, setPeriod] = useState<Period>('30')
  const [attempt, setAttempt] = useState(0)
  // What the last request brought, under the request it answers: a new period shows nothing until its own answer.
  const [result, setResult] = useState<{ key: string; report?: UsageReport; error?: UsageReportError } | null>(null)
  const key = `${period}:${attempt}`

  useEffect(() => {
    if (!account) return
    let active = true
    loadUsageReport(Number(period)).then(
      (report) => {
        if (active) setResult({ key, report })
      },
      (reason: unknown) => {
        if (active) setResult({ key, error: reason === 'forbidden' ? 'forbidden' : 'offline' })
      },
    )
    return () => {
      active = false
    }
  }, [account, period, key])

  const current = result?.key === key ? result : null
  const error = current?.error
  const report = current?.report

  return (
    <SettingsSubpage title={dev.usageStats}>
      {!account ? (
        <SettingsHint>{text.signIn}</SettingsHint>
      ) : (
        <>
          <Segmented<Period>
            mode="radio"
            label={text.period}
            idPrefix="usage-period"
            value={period}
            onChange={setPeriod}
            options={PERIODS.map((p) => ({ id: p, label: text.days(Number(p)) }))}
          />
          {error === 'forbidden' ? (
            <SettingsHint>{text.forbidden}</SettingsHint>
          ) : error ? (
            <div>
              <SettingsHint>{text.failed}</SettingsHint>
              <Button variant="secondary" onClick={() => setAttempt(attempt + 1)} className="mt-3">
                {text.retry}
              </Button>
            </div>
          ) : (
            report && <Report report={report} />
          )}
        </>
      )}
    </SettingsSubpage>
  )
}
