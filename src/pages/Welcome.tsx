import { useState } from 'react'
import { useNavigate } from 'react-router'
import { levels, examExists } from '../engine/loader'
import { chooseStartLevel } from '../db/progress'
import { Button } from '../components/ui/basics'
import { IconTrophy, IconBook } from '../components/ui/icons'
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
      <div className="flex items-center justify-center gap-2">
        <Mark size={40} />
        <p className="font-display text-2xl text-brand-600 dark:text-brand-300">{ui.appName}</p>
      </div>
      <div className="relative mx-auto mt-4 flex h-64 w-64 items-end justify-center">
        <span className="absolute inset-4 rounded-full bg-brand-100 dark:bg-brand-500/20" aria-hidden="true" />
        <span className="absolute inset-0 animate-[spin_40s_linear_infinite] rounded-full border-4 border-dashed border-brand-200 dark:border-brand-500/30" aria-hidden="true" />
        <DogsScene size={300} className="relative -mb-2" />
      </div>
      <h1 className="mt-6 text-center text-[2.3rem] leading-[1.05]">{ui.welcome.title}</h1>
      <p className="mx-auto mt-3 max-w-md text-center font-semibold text-muted">{ui.welcome.intro}</p>
      <p className="mt-2 text-center text-sm font-bold text-brand-600 dark:text-brand-300">{ui.tagline}</p>

      <div className="mt-6 grid gap-3">
        <button type="button" onClick={() => void start('a1')} className="btn btn-primary w-full flex-col gap-0 py-4 text-left">
          <span className="block text-lg">I'm new to {LANGUAGE}</span>
          <span className="block text-xs font-bold opacity-85">{ui.welcome.firstStop}</span>
        </button>
        <button type="button" onClick={() => nav('/placement')} className="card flex items-center gap-4 text-left">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sunset-gradient text-white"><IconTrophy /></span>
          <span>
            <span className="block font-extrabold">Take the placement test</span>
            <span className="block text-sm font-semibold text-muted">About five minutes. Finds the stop where the dogs should pick you up.</span>
          </span>
        </button>
        <button type="button" onClick={() => setPicking((p) => !p)} className="card flex items-center gap-4 text-left" aria-expanded={picking}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mint-gradient text-white"><IconBook /></span>
          <span>
            <span className="block font-extrabold">I know my level</span>
            <span className="block text-sm font-semibold text-muted">Pick a region. You can change this any time from the journey page.</span>
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
