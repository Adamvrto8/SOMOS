import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router'
import { useDevMode } from '../../lib/devMode'
import { AutoReviewSettings } from './AutoReviewSettings'
import { BackupSettings } from './BackupSettings'
import { GoalSettings, LanguageSettings, LookSettings, SoundSettings } from './ChoiceSettings'
import { DevSettings } from './DevSettings'
import { ReminderSettings } from './ReminderSettings'
import { UsageSettings } from './UsageSettings'
import { VoiceSettings } from './VoiceSettings'

const SECTIONS: Record<string, () => ReactNode> = {
  goal: () => <GoalSettings />,
  review: () => <AutoReviewSettings />,
  reminder: () => <ReminderSettings />,
  language: () => <LanguageSettings />,
  look: () => <LookSettings />,
  sound: () => <SoundSettings />,
  voice: () => <VoiceSettings />,
  backup: () => <BackupSettings />,
  usage: () => <UsageSettings />,
  dev: () => <DevSettings />,
}

/** `/profile/:section`: one setting's page; an unknown one, or the tools outside developer mode, lead back to the list. */
export function SettingsSectionPage() {
  const { section = '' } = useParams()
  const devMode = useDevMode()
  const page = Object.hasOwn(SECTIONS, section) ? SECTIONS[section] : undefined
  if (!page || (section === 'dev' && !devMode)) return <Navigate to="/profile" replace />
  return page()
}
