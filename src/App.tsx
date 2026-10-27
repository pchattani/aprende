import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { Routes, Route, NavLink, Navigate, Outlet, useLocation } from 'react-router'
import { useSettings, applyTheme } from './store/settings'
import { useSession } from './store/session'
import { IconRoute, IconPostcard, IconBook, IconVerb, IconChart, IconGamepad } from './components/ui/icons'
import { ErrorBoundary } from './components/ErrorBoundary'

const Course = lazy(() => import('./pages/Course'))
const LessonPage = lazy(() => import('./pages/Lesson'))
const Review = lazy(() => import('./pages/Review'))
const Grammar = lazy(() => import('./pages/Grammar'))
const Verbs = lazy(() => import('./pages/Verbs'))
const Reader = lazy(() => import('./pages/Reader'))
const Listen = lazy(() => import('./pages/Listen'))
const Pronunciation = lazy(() => import('./pages/Pronunciation'))
const Exam = lazy(() => import('./pages/Exam'))
const Profile = lazy(() => import('./pages/Profile'))
const Settings = lazy(() => import('./pages/Settings'))
const Study = lazy(() => import('./pages/Study'))
const Welcome = lazy(() => import('./pages/Welcome'))
const Placement = lazy(() => import('./pages/Placement'))
const Passport = lazy(() => import('./pages/Passport'))
const RegionQuiz = lazy(() => import('./pages/RegionQuiz'))
const Checkpoint = lazy(() => import('./pages/Checkpoint'))
const Writing = lazy(() => import('./pages/Writing'))
const WritingArea = lazy(() => import('./pages/WritingArea'))
const Palabras = lazy(() => import('./pages/Palabras'))
const GamePage = lazy(() => import('./pages/games/GamePage'))
const Perros = lazy(() => import('./pages/Perros'))
const Classifiers = lazy(() => import('./pages/Classifiers'))
const Insights = lazy(() => import('./pages/Insights'))
const ArtGallery = lazy(() => import('./pages/ArtGallery'))

function Loading() {
  return <div className="p-8 text-center text-muted">Loading…</div>
}

/** Remembers the scroll offset of each tab so switching tabs and coming back lands on the same spot. */
function useScrollMemory(pathname: string, skip: boolean) {
  const positions = useRef(new Map<string, number>())
  const current = useRef(pathname)
  useEffect(() => {
    const onScroll = () => positions.current.set(current.current, window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useLayoutEffect(() => {
    current.current = pathname
    if (skip) return
    const y = positions.current.get(pathname) ?? 0
    let tries = 0
    const tick = () => {
      if (document.documentElement.scrollHeight - window.innerHeight >= y - 2 || tries > 40) window.scrollTo(0, y)
      else {
        tries++
        requestAnimationFrame(tick)
      }
    }
    tick()
  }, [pathname, skip])
}

function Shell() {
  const loc = useLocation()
  const immersive = useSession((s) => s.immersive)
  const from = (loc.state as { from?: string } | null)?.from
  useScrollMemory(loc.pathname, Boolean(from) || immersive)
  const tabs = [
    { to: '/', label: 'Journey', icon: IconRoute },
    { to: '/review', label: 'Review', icon: IconPostcard },
    { to: '/games', label: 'Games', icon: IconGamepad },
    { to: '/reader', label: 'Read', icon: IconBook },
    { to: '/study', label: 'Tools', icon: IconVerb },
    { to: '/insights', label: 'Insights', icon: IconChart },
  ]
  return (
    <div className="mx-auto min-h-full max-w-xl pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <main className="px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <ErrorBoundary>
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <nav className={`fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] transition ${immersive ? 'pointer-events-none translate-y-24 opacity-0' : ''}`} aria-label="Main" aria-hidden={immersive}>
        <ul className="mx-auto flex max-w-xl justify-around px-2">
          {tabs.map((t) => {
            const active = t.to === '/' ? loc.pathname === '/' || loc.pathname.startsWith('/lesson') : loc.pathname.startsWith(t.to) || (t.to === '/reader' && loc.pathname.startsWith('/listen')) || (t.to === '/study' && loc.pathname.startsWith('/writing'))
            return (
              <li key={t.to} className="flex-1">
                <NavLink to={t.to} className={`relative mx-auto flex flex-col items-center gap-0.5 pb-2 pt-2.5 text-[11px] font-semibold tracking-wide transition ${active ? 'text-ink' : 'text-ink-2'}`} aria-current={active ? 'page' : undefined}>
                  <span className={`absolute inset-x-5 top-0 h-[3px] rounded-b-full ${active ? 'airmail' : ''}`} aria-hidden="true" />
                  <t.icon width={23} height={23} strokeWidth={active ? 2.2 : 1.7} />
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
        <Route index element={<Course />} />
        <Route path="review" element={<Review />} />
        <Route path="reader" element={<Reader />} />
        <Route path="reader/:id" element={<Reader />} />
        <Route path="listen/:id" element={<Listen />} />
        <Route path="study" element={<Study />} />
        <Route path="grammar" element={<Grammar />} />
        <Route path="grammar/:id" element={<Grammar />} />
        <Route path="verbs" element={<Verbs />} />
        <Route path="pronunciation" element={<Pronunciation />} />
        <Route path="pronunciation/:id" element={<Pronunciation />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="passport" element={<Passport />} />
        <Route path="games" element={<Palabras />} />
        <Route path="games/:id" element={<GamePage />} />
        <Route path="palabras" element={<Navigate to="/games" replace />} />
        <Route path="perros" element={<Perros />} />
        <Route path="classifiers" element={<Classifiers />} />
        <Route path="insights" element={<Insights />} />
        <Route path="art" element={<ArtGallery />} />
        <Route path="writing" element={<WritingArea />} />
      </Route>
      <Route
        path="quiz/:level"
        element={
          <ErrorBoundary>
            <Suspense fallback={<Loading />}>
              <RegionQuiz />
            </Suspense>
          </ErrorBoundary>
        }
      />
      <Route
        path="checkpoint/:unitId"
        element={
          <ErrorBoundary>
            <Suspense fallback={<Loading />}>
              <Checkpoint />
            </Suspense>
          </ErrorBoundary>
        }
      />
      <Route
        path="writing/:unitId"
        element={
          <ErrorBoundary>
            <Suspense fallback={<Loading />}>
              <Writing />
            </Suspense>
          </ErrorBoundary>
        }
      />
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
