import { createBrowserRouter, Navigate, useLocation, useParams } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AppLayout } from './components/AppLayout'
import { ErrorBoundary, RouteErrorScreen } from './components/ErrorScreen'
import { PrivacyPage } from './features/account/PrivacyPage'
import { SignInPage } from './features/account/SignInPage'
import { GoalCelebration } from './components/GoalCelebration'
import { ArchivePage } from './features/archive/ArchivePage'
import { CustomWordPage } from './features/archive/CustomWordPage'
import { DuelHomePage } from './features/duel/DuelHomePage'
import { DuelRoomPage } from './features/duel/DuelRoomPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { SettingsSectionPage } from './features/settings/SettingsSectionPage'
import { LessonPage } from './features/exercises/LessonPage'
import { PracticePage } from './features/exercises/PracticePage'
import { GrammarPage } from './features/grammar/GrammarPage'
import { TipPage } from './features/grammar/TipPage'
import { HomePage } from './features/home/HomePage'
import { ReviewPage } from './features/review/ReviewPage'
import { SearchPage } from './features/search/SearchPage'
import { StatsPage } from './features/stats/StatsPage'
import { TestPage } from './features/tests/TestPage'
import { TestsPage } from './features/tests/TestsPage'
import { TopicPage } from './features/search/TopicPage'
import { WordPage } from './features/word/WordPage'
import { OnboardingGate } from './features/onboarding/OnboardingGate'
import { RestorePage } from './features/onboarding/RestorePage'
import { WelcomePage } from './features/onboarding/WelcomePage'

function LegacySettingsRedirect() {
  return <Navigate to={`/profile/${useParams().section ?? ''}`} replace />
}

/** Keeps ?code= and #… of a sign-in that Google finishes at the old address. */
function LegacySignInRedirect() {
  const { search, hash } = useLocation()
  return <Navigate to={`/profile/sign-in${search}${hash}`} replace />
}

/** Only on the dev server: a screen that crashes, to see the error screen (e2e/error.spec.ts). */
function Crash(): never {
  throw new Error('Test crash')
}

const routes = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      // A new learner goes through the welcome first (src/lib/onboarding.ts).
      { index: true, element: <OnboardingGate><HomePage /></OnboardingGate> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'word/:id', element: <WordPage /> },
      { path: 'topic/:id', element: <TopicPage /> },
      { path: 'practice', element: <PracticePage /> },
      { path: 'practice/grammar', element: <GrammarPage /> },
      { path: 'practice/tests', element: <TestsPage /> },
      { path: 'duel', element: <DuelHomePage /> },
      { path: 'practice/grammar/:id', element: <TipPage /> },
      { path: 'archive', element: <ArchivePage /> },
      { path: 'archive/new', element: <CustomWordPage /> },
      { path: 'archive/custom/:id', element: <CustomWordPage /> },
      { path: 'profile', element: <SettingsPage /> },
      { path: 'profile/sign-in', element: <SignInPage /> },
      { path: 'profile/:section', element: <SettingsSectionPage /> },
      // Where Nastavenia and the sign-in page were: old bookmarks, and Google returning to an older redirect address.
      { path: 'archive/settings', element: <Navigate to="/profile" replace /> },
      { path: 'archive/settings/:section', element: <LegacySettingsRedirect /> },
      { path: 'archive/account', element: <LegacySignInRedirect /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
  // Full-screen players: no header or tab bar, their own bottom action bar.
  { path: '/practice/lesson', element: <LessonPage /> },
  { path: '/practice/test', element: <TestPage /> },
  { path: '/review', element: <ReviewPage /> },
  { path: '/duel/:code', element: <DuelRoomPage /> },
  { path: '/welcome', element: <WelcomePage /> },
  { path: '/welcome/restore', element: <RestorePage /> },
  ...(import.meta.env.DEV ? [{ path: '/dev/crash', element: <Crash /> }] : []),
]

// One errorElement for every screen: a crash anywhere shows the error screen, not the router's own.
const router = createBrowserRouter([{ errorElement: <RouteErrorScreen />, children: routes }])

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
      <GoalCelebration />
    </ErrorBoundary>
  )
}
