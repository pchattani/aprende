import { useState } from 'react'
import { SouvenirIcon } from '../components/art/SouvenirArt'
import { createPortal } from 'react-dom'
import { StopArt } from '../components/StopArt'
import { Link } from 'react-router'
import { PageHeader, Chip } from '../components/ui/basics'
import { DogButton } from '../components/ui/Dogs'
import { StampCard } from '../components/StampCard'
import { REGIONS, SOUVENIRS, WARDROBE, souvenirById, isStamped, type Stop, type Region } from '../engine/journey'
import { WARDROBE_KINDS } from '../engine/artKinds'
import { wardrobeKindLabel } from '../engine/wardrobe'
import { QUIZ_PASS } from '../engine/quiz'
import { useLessonRows, useSouvenirs, useKvPrefix } from '../hooks/useProgress'
import { useOutfits } from '../hooks/useOutfits'
import { units } from '../engine/loader'
import type { QuizRecord } from './RegionQuiz'
import { TL } from '../engine/course'

export default function Passport() {
  const rows = useLessonRows()
  const souvenirs = useSouvenirs()
  const outfits = useOutfits()
  const quizRecords = useKvPrefix<QuizRecord>('regionQuiz:')
  const [open, setOpen] = useState<{ stop: Stop; region: Region; earned: boolean } | undefined>()
  if (!rows || !souvenirs) return <div className="p-8 text-center text-muted">Loading…</div>
  const owned = new Set(souvenirs.map((s) => s.id))
  const stamped = (unitId: string) => Boolean(units.get(unitId)?.authored) && isStamped(unitId, rows)
  const stamps = REGIONS.flatMap((r) => r.stops).filter((s) => stamped(s.unitId)).length
  const collectible = SOUVENIRS.filter((s) => !s.badge && !s.wardrobe)
  return (
    <div className="animate-rise pb-6">
      <PageHeader
        title="Passport"
        subtitle="Stamps for every stop you finish, souvenirs from quests and lucky finds, badges from region quizzes."
        right={<div className="flex -space-x-2"><DogButton dog="leo" size={36} outfit={outfits.leo} /><DogButton dog="bonchita" size={36} outfit={outfits.bonchita} /><DogButton dog="luna" size={36} outfit={outfits.luna} /></div>}
      />
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="card text-center"><p className="font-mono text-3xl">{stamps}</p><p className="text-xs text-ink-2">stamps of {REGIONS.reduce((n, r) => n + r.stops.length, 0)} stops</p></div>
        <div className="card text-center"><p className="font-mono text-3xl">{collectible.filter((s) => owned.has(s.id)).length}</p><p className="text-xs text-ink-2">souvenirs of {collectible.length}</p></div>
      </div>
      {/* Portal: the page's rise animation uses a transform, which would trap a fixed overlay inside it. */}
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={open.stop.name} onClick={() => setOpen(undefined)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <StampCard stop={open.stop} region={open.region} earned={open.earned} onClose={() => setOpen(undefined)} />
          </div>
        </div>,
        document.body,
      )}
      {REGIONS.map((region) => {
        const regionSouvenirs = collectible.filter((s) => s.level === region.level)
        const n = region.stops.filter((s) => stamped(s.unitId)).length
        const quiz = quizRecords?.get(`regionQuiz:${region.level}`)
        const quizOpen = n >= Math.ceil(region.stops.length / 2)
        const badge = owned.has(`badge-${region.level}`)
        return (
          <section key={region.level} className={`lvl-${region.level} card mb-4`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl">{region.name} {badge && <span title="Region badge" aria-label="Region badge earned">🏅</span>}</h2>
              <Chip>{n} / {region.stops.length} stamps</Chip>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {region.stops.map((s) => {
                const ok = stamped(s.unitId)
                return ok ? (
                  <button key={s.unitId} type="button" onClick={() => setOpen({ stop: s, region, earned: true })} title={`${s.name}: stamped`} className="stamp flex rotate-[-3deg] flex-col items-stretch text-center transition hover:rotate-0">
                    <StopArt stop={s} level={region.level} className="aspect-square w-full" />
                    <span className="mt-1 line-clamp-1 px-0.5 text-[9px] font-semibold leading-tight">{s.name}</span>
                  </button>
                ) : (
                  <button key={s.unitId} type="button" onClick={() => setOpen({ stop: s, region, earned: false })} title={`${s.name}: not yet`} className="flex aspect-square flex-col items-center justify-center rounded-md border-[1.5px] border-dashed border-line text-center text-ink-2 transition hover:border-ink-2">
                    <span className="h-5 w-5 rounded-full border border-dashed border-line" aria-hidden="true" />
                    <span className="mt-0.5 line-clamp-2 px-1 text-[9px] font-semibold leading-tight">{s.name}</span>
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs font-bold">
              {quizOpen ? <Link to={`/quiz/${region.level}`} className="btn btn-ghost px-3 py-1.5 text-xs">🏅 Region quiz</Link> : <span className="text-muted">🏅 Region quiz opens at {Math.ceil(region.stops.length / 2)} stamps</span>}
              {quiz && <span className="text-muted">Best {Math.round(quiz.best * 100)}%{quiz.best >= QUIZ_PASS ? ' · badge' : ''}</span>}
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">Souvenirs</p>
            <ul className="mt-2 grid grid-cols-2 gap-2">
              {regionSouvenirs.map((sv) => {
                const have = owned.has(sv.id)
                return (
                  <li key={sv.id} className={`flex items-start gap-2 rounded-xl border p-2 ${have ? 'border-line bg-card' : 'border-dashed border-line opacity-60'}`}>
                    <span className="shrink-0" aria-hidden="true">{have ? <SouvenirIcon souvenir={sv} size={36} /> : <span className="block h-9 w-9 rounded border border-dashed border-line" />}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-tight" lang={TL}>{have ? sv.es : '?????'}</span>
                      <span className="block text-[11px] text-muted">{have ? sv.blurb : sv.en}{have && sv.wearable ? ' · wearable' : ''}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      <section className="card mb-4" aria-label="Wardrobe">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">Wardrobe</h2>
          <Chip>{WARDROBE.filter((w) => owned.has(w.id)).length} / {WARDROBE.length}</Chip>
        </div>
        <p className="mt-1 text-xs text-ink-2">Hats, glasses, scarves and more in eight colours. Errands hand them out once a region's souvenirs are found.</p>
        <ul className="mt-3 space-y-2">
          {WARDROBE_KINDS.map(({ kind }) => {
            const items = WARDROBE.filter((w) => w.wardrobe?.kind === kind)
            return (
              <li key={kind} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs font-semibold capitalize">{wardrobeKindLabel(kind)}</span>
                <span className="flex flex-wrap gap-1">
                  {items.map((w) => owned.has(w.id)
                    ? <SouvenirIcon key={w.id} souvenir={w} size={28} title={w.en} />
                    : <span key={w.id} className="block h-7 w-7 rounded border border-dashed border-line" title="Not found yet" />)}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
      {souvenirs.length > 0 && (
        <section className="card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Latest finds</p>
          <ul className="mt-2 space-y-1 text-sm">
            {souvenirs.slice(0, 8).map((s) => {
              const sv = souvenirById(s.id)
              return <li key={s.id} className="flex items-center gap-2">{sv && <SouvenirIcon souvenir={sv} size={22} />}<span>{sv?.es} <span className="text-muted">· {s.source === 'quest' ? 'quest reward' : s.source === 'quiz' ? 'region quiz' : 'lucky find'} · {new Date(s.ts).toLocaleDateString()}</span></span></li>
            })}
          </ul>
          <Link to="/perros" className="btn btn-ghost mt-3 w-full py-2 text-sm">🐾 Dress the dogs with your souvenirs</Link>
        </section>
      )}
    </div>
  )
}
