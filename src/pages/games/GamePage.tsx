/** /games/:id — one mini game from the catalog, loaded on demand. */
import { createElement, lazy, Suspense, type ComponentType } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { GAMES, gameById, type GameProps } from './catalog'

const PAGES: Record<string, ComponentType<GameProps>> = Object.fromEntries(GAMES.map((g) => [g.id, lazy(g.load)]))

export default function GamePage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const meta = gameById(id)
  const Game = meta && PAGES[meta.id]
  if (!meta || !Game) return <Navigate to="/games" replace />
  return (
    <Suspense fallback={<p className="py-10 text-center text-sm text-muted">Loading {meta.title}…</p>}>
      {createElement(Game, { key: meta.id, onDone: () => nav('/games') })}
    </Suspense>
  )
}
