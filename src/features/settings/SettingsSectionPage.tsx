import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router'
import { useDevMode } from '../../lib/devMode'
import { AutoReviewSettings } from './AutoReviewSettings'
import { BackupSettings } from './BackupSettings'
import { ContentReports } from './ContentReports'
import { GoalSettings, LanguageSettings, LookSettings, SoundSettings } from './ChoiceSettings'
import { DevSettings } from './DevSettings'
import { ReminderSettings } from './ReminderSettings'
import { UsageSettings } from './UsageSettings'
import { UsageStats } from './UsageStats'
import { VoiceSettings } from './VoiceSettings'

/** Pages of Nástroje pre vývoj: outside developer mode they lead back to the list. */
const DEV_ONLY = new Set(['dev', 'usage-stats', 'content-reports'])

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
  'usage-stats': () => <UsageStats />,
  'content-reports': () => <ContentReports />,
}

/** `/profile/:section`: one setting's page; an unknown one, or the tools outside developer mode, lead back to the list. */
export function SettingsSectionPage() {
  const { section = '' } = useParams()
  const devMode = useDevMode()
  const page = Object.hasOwn(SECTIONS, section) ? SECTIONS[section] : undefined
  if (!page || (DEV_ONLY.has(section) && !devMode)) return <Navigate to="/profile" replace />
  return page()
}
