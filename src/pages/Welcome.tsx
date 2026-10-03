import { useState } from 'react'
import { useNavigate } from 'react-router'
import { levels, examExists } from '../engine/loader'
import { chooseStartLevel } from '../db/progress'
import { Button } from '../components/ui/basics'
import { IconStar, IconTrophy, IconBook } from '../components/ui/icons'
import type { LevelId } from '../engine/schema'

export default function Welcome() {
  const nav = useNavigate()
  const [picking, setPicking] = useState(false)
  const authored = levels.filter((l) => l.units.some((u) => u.authored))
  const start = async (level: LevelId) => {
    await chooseStartLevel(level)
    nav('/')
  }
  return (
    <div className="mx-auto min-h-full max-w-xl px-4 pb-10 pt-[calc(1.5rem+env(safe-area-inset-top))]">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-600">Aprende</p>
      <h1 className="mt-1 text-3xl font-extrabold">Where should we start?</h1>
      <p className="mt-2 text-muted">
        The course runs from complete beginner (A1) to advanced (C2). If you already know some Spanish, skip ahead: earlier levels stay open for practice.
      </p>

      <div className="mt-6 grid gap-3">
        <button type="button" onClick={() => void start('a1')} className="card flex items-center gap-4 text-left active:scale-[0.99]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600"><IconStar /></span>
          <span>
            <span className="block font-extrabold">I'm new to Spanish</span>
            <span className="block text-sm text-muted">Start at A1, lesson 1.</span>
          </span>
        </button>
        <button type="button" onClick={() => nav('/placement')} className="card flex items-center gap-4 border-gold-500 text-left active:scale-[0.99]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-300 text-gold-600"><IconTrophy /></span>
          <span>
            <span className="block font-extrabold">Take the placement test</span>
            <span className="block text-sm text-muted">About five minutes. Finds the level where you should begin.</span>
          </span>
        </button>
        <button type="button" onClick={() => setPicking((p) => !p)} className="card flex items-center gap-4 text-left active:scale-[0.99]" aria-expanded={picking}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted"><IconBook /></span>
          <span>
            <span className="block font-extrabold">I know my level</span>
            <span className="block text-sm text-muted">Pick where to start. You can change this any time from the path.</span>
          </span>
        </button>
      </div>

      {picking && (
        <div className="card mt-3 grid gap-2" role="group" aria-label="Choose a starting level">
          {levels.map((l) => {
            const hasContent = authored.some((a) => a.id === l.id)
            return (
              <Button key={l.id} variant={hasContent ? 'primary' : 'ghost'} className="w-full justify-between text-left" onClick={() => void start(l.id)}>
                <span>
                  <span className="font-extrabold">{l.title}</span> <span className="text-sm opacity-80">{l.name}</span>
                </span>
                <span className="text-xs opacity-80">{hasContent ? (examExists(l.id) ? 'lessons + exam' : 'lessons') : 'coming soon'}</span>
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}
