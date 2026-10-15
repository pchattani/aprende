import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader, Chip } from '../components/ui/basics'
import { DogButton } from '../components/ui/Dogs'
import { StampCard } from '../components/StampCard'
import { REGIONS, SOUVENIRS, souvenirById, isStamped, type Stop, type Region } from '../engine/journey'
import { QUIZ_PASS } from '../engine/quiz'
import { useLessonRows, useSouvenirs, useKvPrefix } from '../hooks/useProgress'
import { useOutfits } from '../hooks/useOutfits'
import { units } from '../engine/loader'
import type { QuizRecord } from './RegionQuiz'

export default function Passport() {
  const rows = useLessonRows()
  const souvenirs = useSouvenirs()
  const outfits = useOutfits()
  const quizRecords = useKvPrefix<QuizRecord>('regionQuiz:')
  const [open, setOpen] = useState<{ stop: Stop; region: Region } | undefined>()
  if (!rows || !souvenirs) return <div className="p-8 text-center text-muted">Loading…</div>
  const owned = new Set(souvenirs.map((s) => s.id))
  const stamped = (unitId: string) => Boolean(units.get(unitId)?.authored) && isStamped(unitId, rows)
  const stamps = REGIONS.flatMap((r) => r.stops).filter((s) => stamped(s.unitId)).length
  const collectible = SOUVENIRS.filter((s) => !s.badge)
  return (
    <div className="animate-rise pb-6">
      <PageHeader
        title="Passport"
        subtitle="Stamps for every stop you finish, souvenirs from quests and lucky finds, badges from region quizzes."
        right={<div className="flex -space-x-2"><DogButton dog="leo" size={36} outfit={outfits.leo} /><DogButton dog="bonchita" size={36} outfit={outfits.bonchita} /><DogButton dog="luna" size={36} outfit={outfits.luna} /></div>}
      />
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="card text-center"><p className="text-3xl font-extrabold">{stamps}</p><p className="text-xs font-semibold text-muted">stamps of {REGIONS.reduce((n, r) => n + r.stops.length, 0)} stops</p></div>
        <div className="card text-center"><p className="text-3xl font-extrabold">{[...owned].filter((id) => !souvenirById(id)?.badge).length}</p><p className="text-xs font-semibold text-muted">souvenirs of {collectible.length}</p></div>
      </div>
      {open && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" onClick={() => setOpen(undefined)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <StampCard stop={open.stop} region={open.region} onClose={() => setOpen(undefined)} />
          </div>
        </div>
      )}
      {REGIONS.map((region) => {
        const regionSouvenirs = collectible.filter((s) => s.level === region.level)
        const n = region.stops.filter((s) => stamped(s.unitId)).length
        const quiz = quizRecords?.get(`regionQuiz:${region.level}`)
        const quizOpen = n >= Math.ceil(region.stops.length / 2)
        const badge = owned.has(`badge-${region.level}`)
        return (
          <section key={region.level} className="card mb-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl">{region.name} {badge && <span title="Region badge" aria-label="Region badge earned">🏅</span>}</h2>
              <Chip>{n} / {region.stops.length} stamps</Chip>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {region.stops.map((s) => {
                const ok = stamped(s.unitId)
                return ok ? (
                  <button key={s.unitId} type="button" onClick={() => setOpen({ stop: s, region })} title={`${s.name}: stamped`} className="flex aspect-square rotate-[-4deg] flex-col items-center justify-center rounded-2xl border-2 border-brand-500 bg-brand-100 text-center text-brand-700 transition hover:rotate-0 dark:bg-brand-500/20 dark:text-brand-100">
                    <span className="text-xl" aria-hidden="true">{s.emoji}</span>
                    <span className="mt-0.5 line-clamp-2 px-1 text-[9px] font-extrabold leading-tight">{s.name}</span>
                  </button>
                ) : (
                  <Link key={s.unitId} to="/" state={{ from: `unit-${s.unitId}` }} title={`${s.name}: not yet`} className="flex aspect-square flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line text-center text-muted opacity-70">
                    <span className="text-xl" aria-hidden="true">·</span>
                    <span className="mt-0.5 line-clamp-2 px-1 text-[9px] font-extrabold leading-tight">{s.name}</span>
                  </Link>
                )
              })}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs font-bold">
              {quizOpen ? <Link to={`/quiz/${region.level}`} className="btn btn-ghost px-3 py-1.5 text-xs">🏅 Region quiz</Link> : <span className="text-muted">🏅 Region quiz opens at {Math.ceil(region.stops.length / 2)} stamps</span>}
              {quiz && <span className="text-muted">Best {Math.round(quiz.best * 100)}%{quiz.best >= QUIZ_PASS ? ' · badge' : ''}</span>}
            </div>
            <p className="mt-4 text-xs font-extrabold uppercase tracking-wider text-muted">Souvenirs</p>
            <ul className="mt-2 grid grid-cols-2 gap-2">
              {regionSouvenirs.map((sv) => {
                const have = owned.has(sv.id)
                return (
                  <li key={sv.id} className={`flex items-start gap-2 rounded-2xl p-2 ${have ? 'bg-gold-100/70 dark:bg-gold-500/10' : 'bg-surface-2 opacity-60'}`}>
                    <span className="text-2xl" aria-hidden="true">{have ? sv.emoji : '❔'}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-extrabold leading-tight" lang="es">{have ? sv.es : '?????'}</span>
                      <span className="block text-[11px] text-muted">{have ? sv.blurb : sv.en}{have && sv.wearable ? ' · wearable' : ''}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      {souvenirs.length > 0 && (
        <section className="card">
          <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Latest finds</p>
          <ul className="mt-2 space-y-1 text-sm">
            {souvenirs.slice(0, 8).map((s) => {
              const sv = souvenirById(s.id)
              return <li key={s.id}>{sv?.emoji} {sv?.es} <span className="text-muted">· {s.source === 'quest' ? 'quest reward' : s.source === 'quiz' ? 'region quiz' : 'lucky find'} · {new Date(s.ts).toLocaleDateString()}</span></li>
            })}
          </ul>
          <Link to="/perros" className="btn btn-ghost mt-3 w-full py-2 text-sm">🐾 Dress the dogs with your souvenirs</Link>
        </section>
      )}
    </div>
  )
}
