import { createBrowserRouter, Navigate, useLocation, useParams } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AppLayout } from './components/AppLayout'
import { PrivacyPage } from './features/account/PrivacyPage'
import { SignInPage } from './features/account/SignInPage'
import { GoalCelebration } from './components/GoalCelebration'
import { ArchivePage } from './features/archive/ArchivePage'
import { CustomWordPage } from './features/archive/CustomWordPage'
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

function LegacySettingsRedirect() {
  return <Navigate to={`/profile/${useParams().section ?? ''}`} replace />
}

/** Keeps ?code= and #… of a sign-in that Google finishes at the old address. */
function LegacySignInRedirect() {
  const { search, hash } = useLocation()
  return <Navigate to={`/profile/sign-in${search}${hash}`} replace />
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'word/:id', element: <WordPage /> },
      { path: 'topic/:id', element: <TopicPage /> },
      { path: 'practice', element: <PracticePage /> },
      { path: 'practice/grammar', element: <GrammarPage /> },
      { path: 'practice/tests', element: <TestsPage /> },
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
])

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <GoalCelebration />
    </>
  )
}
