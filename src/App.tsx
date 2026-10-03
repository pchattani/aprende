import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, NavLink, Outlet, useLocation } from 'react-router'
import { useSettings, applyTheme } from './store/settings'
import { IconHome, IconRepeat, IconBook, IconVerb, IconUser } from './components/ui/icons'
import { ErrorBoundary } from './components/ErrorBoundary'

const Path = lazy(() => import('./pages/Path'))
const LessonPage = lazy(() => import('./pages/Lesson'))
const Review = lazy(() => import('./pages/Review'))
const Grammar = lazy(() => import('./pages/Grammar'))
const Verbs = lazy(() => import('./pages/Verbs'))
const Reader = lazy(() => import('./pages/Reader'))
const Pronunciation = lazy(() => import('./pages/Pronunciation'))
const Exam = lazy(() => import('./pages/Exam'))
const Profile = lazy(() => import('./pages/Profile'))
const Settings = lazy(() => import('./pages/Settings'))
const Study = lazy(() => import('./pages/Study'))
const Welcome = lazy(() => import('./pages/Welcome'))
const Placement = lazy(() => import('./pages/Placement'))

function Loading() {
  return <div className="p-8 text-center text-muted">Loading…</div>
}

function Shell() {
  const loc = useLocation()
  const tabs = [
    { to: '/', label: 'Learn', icon: IconHome },
    { to: '/review', label: 'Review', icon: IconRepeat },
    { to: '/reader', label: 'Read', icon: IconBook },
    { to: '/study', label: 'Study', icon: IconVerb },
    { to: '/profile', label: 'Me', icon: IconUser },
  ]
  return (
    <div className="mx-auto min-h-full max-w-xl pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <main className="px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <ErrorBoundary>
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Main">
        <ul className="mx-auto flex max-w-xl justify-around px-2 pt-1.5">
          {tabs.map((t) => {
            const active = t.to === '/' ? loc.pathname === '/' || loc.pathname.startsWith('/lesson') : loc.pathname.startsWith(t.to)
            return (
              <li key={t.to} className="flex-1">
                <NavLink to={t.to} className={`flex flex-col items-center gap-0.5 pb-1.5 text-[11px] font-extrabold transition ${active ? 'text-brand-600' : 'text-muted'}`} aria-current={active ? 'page' : undefined}>
                  <span className={`flex h-8 w-14 items-center justify-center rounded-full transition ${active ? 'bg-brand-100 dark:bg-brand-500/25' : ''}`}>
                    <t.icon width={22} height={22} className={active ? 'stroke-[2.5]' : ''} />
                  </span>
                  {t.label}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

export default function App() {
  const theme = useSettings((s) => s.theme)
  useEffect(() => applyTheme(theme), [theme])
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Path />} />
        <Route path="review" element={<Review />} />
        <Route path="reader" element={<Reader />} />
        <Route path="reader/:id" element={<Reader />} />
        <Route path="study" element={<Study />} />
        <Route path="grammar" element={<Grammar />} />
        <Route path="grammar/:id" element={<Grammar />} />
        <Route path="verbs" element={<Verbs />} />
        <Route path="pronunciation" element={<Pronunciation />} />
        <Route path="pronunciation/:id" element={<Pronunciation />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route
        path="lesson/:id"
        element={
          <ErrorBoundary>
            <Suspense fallback={<Loading />}>
              <LessonPage />
            </Suspense>
          </ErrorBoundary>
        }
      />
      <Route
        path="exam/:level"
        element={
          <ErrorBoundary>
            <Suspense fallback={<Loading />}>
              <Exam />
            </Suspense>
          </ErrorBoundary>
        }
      />
      <Route
        path="welcome"
        element={
          <ErrorBoundary>
            <Suspense fallback={<Loading />}>
              <Welcome />
            </Suspense>
          </ErrorBoundary>
        }
      />
      <Route
        path="placement"
        element={
          <ErrorBoundary>
            <Suspense fallback={<Loading />}>
              <Placement />
            </Suspense>
          </ErrorBoundary>
        }
      />
      <Route path="*" element={<div className="p-8 text-center">Page not found.</div>} />
    </Routes>
  )
}
