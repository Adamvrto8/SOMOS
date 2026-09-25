import { createBrowserRouter, Navigate } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AppLayout } from './components/AppLayout'
import { ArchivePage } from './features/archive/ArchivePage'
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
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
