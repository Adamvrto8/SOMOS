import { createBrowserRouter, Navigate } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AppLayout } from './components/AppLayout'
import { ArchivePage } from './features/archive/ArchivePage'
import { CustomWordPage } from './features/archive/CustomWordPage'
import { SettingsPage } from './features/archive/SettingsPage'
import { LessonPage } from './features/exercises/LessonPage'
import { PracticePage } from './features/exercises/PracticePage'
import { HomePage } from './features/home/HomePage'
import { SearchPage } from './features/search/SearchPage'
import { TopicPage } from './features/search/TopicPage'
import { WordPage } from './features/word/WordPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'word/:id', element: <WordPage /> },
      { path: 'topic/:id', element: <TopicPage /> },
      { path: 'practice', element: <PracticePage /> },
      { path: 'archive', element: <ArchivePage /> },
      { path: 'archive/new', element: <CustomWordPage /> },
      { path: 'archive/custom/:id', element: <CustomWordPage /> },
      { path: 'archive/settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
  // Full-screen lesson player: no header or tab bar, its own bottom action bar.
  { path: '/practice/lesson', element: <LessonPage /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
