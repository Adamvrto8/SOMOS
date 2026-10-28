import { Bell, Briefcase, CircleUser, GraduationCap, House, Palette, PencilLine, Plane, Search, Smile, Sprout, TreeDeciduous, Users, Flower2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Azulejos } from '../../components/Azulejos'
import { Button } from '../../components/Button'
import { Segmented } from '../../components/Segmented'
import type { Level } from '../../data/types'
import { dictionaries, useT } from '../../i18n'
import { accountsAvailable, SIGN_IN_PATH } from '../../lib/account'
import { GOAL_OPTIONS, setDailyGoal, useDailyGoal } from '../../lib/dailyGoal'
import { installWay, promptInstall } from '../../lib/install'
import { LANGUAGES, setLanguage, useLanguage, type Language } from '../../lib/language'
import { enableReminder, getReminderSettings, reminderSupport, ReminderFailure } from '../../lib/reminder'
import { finishOnboarding, getOnboarding, MOTIVATIONS, returnAfterSignIn, START_LEVELS, startFilter, updateOnboarding, useOnboarding, type Motivation } from '../../lib/onboarding'
import { filterLabel, filterToParams } from '../exercises/exercises'
import { track } from '../../lib/usage'
import { firstUnit, stepHref, unitSteps, unitTitle } from '../../lib/path'
import { OptionList } from './OptionList'
import { StepFrame } from './StepFrame'

type StepId = 'welcome' | 'motivation' | 'level' | 'goal' | 'reminder' | 'install' | 'ready'

const MOTIVATION_ICONS: Record<Motivation, typeof Plane> = {
  travel: Plane,
  work: Briefcase,
  family: Users,
  school: GraduationCap,
  hobbies: Palette,
  fun: Smile,
}
const LEVEL_ICONS: Record<Level, typeof Plane> = { A1: Sprout, A2: Flower2, B1: TreeDeciduous, B2: TreeDeciduous }

/** Minutes a goal takes, roughly: about four right answers a minute. */
const minutesFor = (answers: number) => Math.max(2, Math.round(answers / 4))

/**
 * The welcome of a new learner (/welcome): language, why, level, daily goal, reminder, home screen,
 * then straight into the first lesson. One question per screen, each can be skipped; the step is in
 * the URL, so the phone's back button goes back a step.
 */
export function WelcomePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  // Decided once: the reminder and the home screen steps only where they can work.
  const steps = useMemo<StepId[]>(
    () => [
      'welcome',
      'motivation',
      'level',
      'goal',
      ...(reminderSupport() === 'ok' ? (['reminder'] as const) : []),
      ...(installWay() ? (['install'] as const) : []),
      'ready',
    ],
    [],
  )
  const requested = params.get('step') as StepId | null
  const step: StepId = requested && steps.includes(requested) ? requested : 'welcome'
  const index = steps.indexOf(step)
  // Read on entry, not followed: the last step finishes the welcome on its way into the lesson.
  const [alreadyDone] = useState(() => getOnboarding()?.done === true)

  // Usage statistics: where new learners leave the welcome.
  useEffect(() => {
    if (!alreadyDone) track('welcome', { step })
  }, [step, alreadyDone])

  const go = (next: StepId) => void navigate({ search: `?step=${next}` })
  const next = () => go(steps[index + 1])
  const back = () => {
    if (location.key !== 'default') void navigate(-1)
    else void navigate({ search: `?step=${steps[Math.max(0, index - 1)]}` }, { replace: true })
  }

  // Done already: back from the first lessons (the welcome's steps are still in the history) goes to Domov.
  if (alreadyDone) return <Navigate to="/" replace />
  if (step === 'welcome') return <WelcomeStep onStart={next} />

  const frame = { position: index, count: steps.length - 1, onBack: back }
  switch (step) {
    case 'motivation':
      return <MotivationStep frame={frame} onNext={next} />
    case 'level':
      return <LevelStep frame={frame} onNext={next} />
    case 'goal':
      return <GoalStep frame={frame} onNext={next} />
    case 'reminder':
      return <ReminderStep frame={frame} onNext={next} />
    case 'install':
      return <InstallStep frame={frame} onNext={next} />
    case 'ready':
      return <ReadyStep frame={frame} />
  }
}

interface StepProps {
  frame: { position: number; count: number; onBack: () => void }
  onNext: () => void
}

function WelcomeStep({ onStart }: { onStart: () => void }) {
  const text = useT().onboarding.welcome
  const language = useLanguage()
  const navigate = useNavigate()

  const signIn = () => {
    returnAfterSignIn('/welcome/restore')
    void navigate(SIGN_IN_PATH)
  }

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col overflow-hidden px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:border-x sm:border-line">
      <Azulejos className="mask-b-from-0% mask-b-to-70% opacity-50" />
      <div className="relative flex justify-end">
        <div className="w-40">
          <Segmented<Language>
            options={LANGUAGES.map((id) => ({ id, label: dictionaries[id].languageName }))}
            value={language}
            onChange={setLanguage}
            label={text.language}
            mode="radio"
            idPrefix="welcome-language"
          />
        </div>
      </div>

      <div className="relative mt-auto pt-16">
        <p className="font-serif text-2xl font-semibold tracking-tight text-ink-muted">somos</p>
        <h1 lang="es" className="mt-1 font-serif text-5xl font-semibold tracking-tight">
          ¡Hola!
        </h1>
        <p className="mt-3 text-lg">{text.tagline}</p>
        <ul className="mt-6 space-y-2 text-ink-muted">
          {text.points.map((point) => (
            <li key={point} className="flex gap-3">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brick" aria-hidden />
              {point}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mt-10 flex flex-col gap-3">
        <Button onClick={onStart} className="w-full">
          {text.start}
        </Button>
        {accountsAvailable && (
          <Button variant="secondary" onClick={signIn} className="w-full">
            {text.haveAccount}
          </Button>
        )}
        <p className="mt-1 text-center text-xs text-ink-muted">
          {text.consentBefore}{' '}
          <Link to="/privacy" className="underline underline-offset-2">
            {text.consentLink}
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

function MotivationStep({ frame, onNext }: StepProps) {
  const text = useT().onboarding
  const picked = useOnboarding()?.motivation
  return (
    <StepFrame
      {...frame}
      onSkip={onNext}
      title={text.motivation.title}
      hint={text.motivation.hint}
      footer={
        <Button onClick={onNext} disabled={!picked} className="w-full">
          {text.next}
        </Button>
      }
    >
      <OptionList<Motivation>
        label={text.motivation.title}
        options={MOTIVATIONS.map(({ id }) => ({ id, label: text.motivation.options[id], icon: MOTIVATION_ICONS[id] }))}
        value={picked}
        onChange={(motivation) => updateOnboarding({ motivation })}
      />
    </StepFrame>
  )
}

function LevelStep({ frame, onNext }: StepProps) {
  const text = useT().onboarding
  const picked = useOnboarding()?.level
  return (
    <StepFrame
      {...frame}
      onSkip={onNext}
      title={text.level.title}
      hint={text.level.hint}
      footer={
        <Button onClick={onNext} disabled={!picked} className="w-full">
          {text.next}
        </Button>
      }
    >
      <OptionList<Level>
        label={text.level.title}
        options={START_LEVELS.map((level) => {
          const option = text.level.options[level as 'A1' | 'A2' | 'B1']
          return { id: level, label: option.label, detail: option.example, icon: LEVEL_ICONS[level] }
        })}
        value={picked}
        onChange={(level) => updateOnboarding({ level })}
      />
    </StepFrame>
  )
}

function GoalStep({ frame, onNext }: StepProps) {
  const text = useT().onboarding
  const goal = useDailyGoal()
  return (
    <StepFrame
      {...frame}
      onSkip={onNext}
      title={text.goal.title}
      hint={text.goal.hint}
      footer={
        <Button onClick={onNext} className="w-full">
          {text.next}
        </Button>
      }
    >
      <OptionList<number>
        label={text.goal.title}
        options={GOAL_OPTIONS.map((answers) => ({ id: answers, label: text.goal.options[answers], detail: text.goal.detail(answers, minutesFor(answers)) }))}
        value={goal}
        onChange={setDailyGoal}
      />
    </StepFrame>
  )
}

function ReminderStep({ frame, onNext }: StepProps) {
  const dictionary = useT()
  const text = dictionary.onboarding.reminder
  // Yes or no, as apps ask it: the time is the reminder's own (19:00 unless changed), set in Profil.
  const { time } = getReminderSettings()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enable = async () => {
    setBusy(true)
    setError(null)
    try {
      await enableReminder(time)
      onNext()
    } catch (failure) {
      const code = failure instanceof ReminderFailure ? failure.code : 'failed'
      setError(dictionary.reminder.errors[code])
    } finally {
      setBusy(false)
    }
  }

  return (
    <StepFrame
      {...frame}
      title={text.title}
      hint={text.hint}
      footer={
        <>
          <Button onClick={() => void enable()} disabled={busy} className="w-full">
            {text.enable}
          </Button>
          <Button variant="secondary" onClick={onNext} className="w-full">
            {text.later}
          </Button>
        </>
      }
    >
      <p className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 text-ink-muted">
        <Bell size={20} strokeWidth={1.75} className="shrink-0 text-brick" aria-hidden />
        {text.when(time)}
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-error">
          {error}
        </p>
      )}
    </StepFrame>
  )
}

function InstallStep({ frame, onNext }: StepProps) {
  const dictionary = useT()
  const text = dictionary.onboarding.install
  // Read once: the browser's dialog can be shown only once.
  const [way] = useState(installWay)

  const add = async () => {
    await promptInstall().catch(() => false)
    onNext()
  }

  return (
    <StepFrame
      {...frame}
      title={text.title}
      hint={text.hint}
      footer={
        way === 'prompt' ? (
          <>
            <Button onClick={() => void add()} className="w-full">
              {text.add}
            </Button>
            <Button variant="secondary" onClick={onNext} className="w-full">
              {text.later}
            </Button>
          </>
        ) : (
          <Button onClick={onNext} className="w-full">
            {dictionary.onboarding.next}
          </Button>
        )
      }
    >
      {way === 'ios' && (
        <ol className="space-y-3">
          {text.iosSteps.map((line, i) => (
            <li key={line} className="flex items-start gap-3 rounded-card border border-line bg-surface px-4 py-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brick text-sm font-semibold text-on-accent">{i + 1}</span>
              <span className="pt-0.5">{line}</span>
            </li>
          ))}
        </ol>
      )}
    </StepFrame>
  )
}

function ReadyStep({ frame }: { frame: StepProps['frame'] }) {
  const dictionary = useT()
  const text = dictionary.onboarding.ready
  const navigate = useNavigate()
  const onboarding = useOnboarding()
  const filter = startFilter(onboarding)
  // The first step of the path at the chosen level, else the topic of the reason.
  const unit = firstUnit(onboarding)
  const firstStep = unit && unitSteps(unit)[0]
  const tabs = [
    { key: 'home', icon: House },
    { key: 'search', icon: Search },
    { key: 'practice', icon: PencilLine },
    { key: 'profile', icon: CircleUser },
  ] as const

  const start = () => {
    finishOnboarding()
    const lesson = unit && firstStep ? stepHref(unit, firstStep) : `/practice/lesson?${filterToParams(filter)}&lesson=1`
    // In place of the welcome: closing the lesson goes to Domov, not back into the questions.
    void navigate(`${lesson}&first=1`, { replace: true })
  }

  return (
    <StepFrame
      {...frame}
      title={text.title}
      hint={text.hint}
      footer={
        <>
          <p className="text-center text-sm text-ink-muted">{text.first(unit && firstStep ? `${unitTitle(unit)} · ${dictionary.path.steps[firstStep]}` : filterLabel(filter))}</p>
          <Button onClick={start} className="w-full">
            {text.start}
          </Button>
        </>
      }
    >
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {tabs.map(({ key, icon: Icon }) => (
          <li key={key} className="flex items-center gap-4 px-4 py-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-brick">
              <Icon size={20} strokeWidth={1.75} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{dictionary.nav[key]}</span>
              <span className="block text-sm text-ink-muted">{text.tabs[key]}</span>
            </span>
          </li>
        ))}
      </ul>
    </StepFrame>
  )
}
