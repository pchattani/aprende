import { useState } from 'react'
import { useNavigate } from 'react-router'
import { levels, examExists } from '../engine/loader'
import { chooseStartLevel } from '../db/progress'
import { Button } from '../components/ui/basics'
import { IconStar, IconTrophy, IconBook } from '../components/ui/icons'
import { Mark } from '../components/ui/Mark'
import { DogsScene } from '../components/ui/Dogs'
import type { LevelId } from '../engine/schema'
import { ui, LANGUAGE } from '../engine/loader'

export default function Welcome() {
  const nav = useNavigate()
  const [picking, setPicking] = useState(false)
  const authored = levels.filter((l) => l.units.some((u) => u.authored))
  const start = async (level: LevelId) => {
    await chooseStartLevel(level)
    nav('/')
  }
  return (
    <div className="animate-rise mx-auto min-h-full max-w-xl px-4 pb-10 pt-[calc(1.5rem+env(safe-area-inset-top))]">
      <div className="flex items-center gap-3">
        <Mark size={56} className="animate-float" />
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-brand-600">{ui.appName}</p>
          <p className="text-sm font-semibold text-muted">{ui.tagline}</p>
        </div>
      </div>
      <DogsScene size={320} className="mt-4" />
      <h1 className="text-gradient mt-2 text-[2.4rem]">{ui.welcome.title}</h1>
      <p className="mt-3 text-lg text-muted">{ui.welcome.intro}</p>

      <div className="mt-6 grid gap-3">
        <button type="button" onClick={() => void start('a1')} className="card flex items-center gap-4 text-left transition hover:-translate-y-0.5 active:scale-[0.99]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white"><IconStar /></span>
          <span>
            <span className="block font-extrabold">I'm new to {LANGUAGE}</span>
            <span className="block text-sm text-muted">{ui.welcome.firstStop}</span>
          </span>
        </button>
        <button type="button" onClick={() => nav('/placement')} className="card flex items-center gap-4 text-left transition hover:-translate-y-0.5 active:scale-[0.99]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sunset-gradient text-white"><IconTrophy /></span>
          <span>
            <span className="block font-extrabold">Take the placement test</span>
            <span className="block text-sm text-muted">About five minutes. Finds the stop where the dogs should pick you up.</span>
          </span>
        </button>
        <button type="button" onClick={() => setPicking((p) => !p)} className="card flex items-center gap-4 text-left transition hover:-translate-y-0.5 active:scale-[0.99]" aria-expanded={picking}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mint-gradient text-white"><IconBook /></span>
          <span>
            <span className="block font-extrabold">I know my level</span>
            <span className="block text-sm text-muted">Pick a region. You can change this any time from the journey page.</span>
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
      <p className="mt-8 text-center text-xs leading-relaxed text-muted">
        Free, open source and private: no account, no tracking, everything stays on your device. Aprende is an independent project and is not affiliated with any other language-learning product.
      </p>
    </div>
  )
}
