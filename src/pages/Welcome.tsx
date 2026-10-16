import { useState } from 'react'
import { useNavigate } from 'react-router'
import { levels, examExists } from '../engine/loader'
import { chooseStartLevel } from '../db/progress'
import { Button } from '../components/ui/basics'
import { IconPassport, IconRoute } from '../components/ui/icons'
import { PawsportMark } from '../components/art/Logo'
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
      <div className="relative mx-auto max-w-sm overflow-hidden rounded-[18px] bg-[#1c2541] px-6 pb-6 pt-7 text-center text-[#e9cf8f] shadow-float">
        <span className="pointer-events-none absolute inset-2 rounded-[12px] border border-[#e9cf8f]/35" aria-hidden="true" />
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] opacity-80">{LANGUAGE} edition</p>
        <p className="mt-1 font-display text-[2.6rem] uppercase leading-none tracking-[0.12em]">Pawsport</p>
        <PawsportMark size={84} className="mx-auto mt-4 block" />
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] opacity-80">Languages · one stamp at a time</p>
      </div>
      <DogsScene size={260} className="relative -mt-4" />
      <h1 className="mt-4 text-center text-[2rem]">{ui.welcome.title}</h1>
      <p className="mx-auto mt-3 max-w-md text-center text-ink-2">{ui.welcome.intro}</p>

      <div className="mt-6 grid gap-3">
        <button type="button" onClick={() => void start('a1')} className="btn btn-primary w-full flex-col gap-0 py-4">
          <span className="block text-lg">I'm new to {LANGUAGE}</span>
          <span className="block text-xs font-medium opacity-80">{ui.welcome.firstStop}</span>
        </button>
        <button type="button" onClick={() => nav('/placement')} className="card flex items-center gap-4 text-left">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-blue text-blue"><IconPassport width={22} height={22} /></span>
          <span>
            <span className="block font-semibold">Take the placement test</span>
            <span className="block text-sm text-ink-2">About five minutes. Finds the stop where the dogs should pick you up.</span>
          </span>
        </button>
        <button type="button" onClick={() => setPicking((p) => !p)} className="card flex items-center gap-4 text-left" aria-expanded={picking}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-red text-red"><IconRoute width={22} height={22} /></span>
          <span>
            <span className="block font-semibold">I know my level</span>
            <span className="block text-sm text-ink-2">Pick a region. You can change this any time from the journey page.</span>
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
                  <span className="font-semibold">{l.title}</span> <span className="text-sm opacity-80">{l.name}</span>
                </span>
                <span className="text-xs opacity-80">{hasContent ? (examExists(l.id) ? 'lessons + exam' : 'lessons') : 'coming soon'}</span>
              </Button>
            )
          })}
        </div>
      )}
      <p className="mt-8 text-center text-xs leading-relaxed text-muted">
        Free, open source and private: no account, no tracking, everything stays on your device. Pawsport is an independent project and is not affiliated with any other language-learning product.
      </p>
    </div>
  )
}
