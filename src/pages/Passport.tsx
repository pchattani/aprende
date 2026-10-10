import { Link } from 'react-router'
import { PageHeader, Chip } from '../components/ui/basics'
import { Leo, Bonchita, Luna } from '../components/ui/Dogs'
import { REGIONS, SOUVENIRS, souvenirById } from '../engine/journey'
import { useLessonRows, useSouvenirs } from '../hooks/useProgress'
import { units } from '../engine/loader'

export default function Passport() {
  const rows = useLessonRows()
  const souvenirs = useSouvenirs()
  if (!rows || !souvenirs) return <div className="p-8 text-center text-muted">Loading…</div>
  const owned = new Set(souvenirs.map((s) => s.id))
  const stamped = (unitId: string) => {
    const u = units.get(unitId)
    if (!u?.authored) return false
    const done = [...rows.values()].filter((r) => r.unitId === unitId && r.completions > 0).length
    return done >= 4
  }
  const stamps = REGIONS.flatMap((r) => r.stops).filter((s) => stamped(s.unitId)).length
  return (
    <div className="animate-rise pb-6">
      <PageHeader title="Passport" subtitle="Stamps for every stop you finish, souvenirs from quests and lucky finds." right={<div className="flex -space-x-2"><Leo size={36} /><Bonchita size={36} /><Luna size={36} /></div>} />
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="card text-center"><p className="text-3xl font-extrabold">{stamps}</p><p className="text-xs font-semibold text-muted">stamps of {REGIONS.reduce((n, r) => n + r.stops.length, 0)} stops</p></div>
        <div className="card text-center"><p className="text-3xl font-extrabold">{owned.size}</p><p className="text-xs font-semibold text-muted">souvenirs of {SOUVENIRS.length}</p></div>
      </div>
      {REGIONS.map((region) => {
        const regionSouvenirs = SOUVENIRS.filter((s) => s.level === region.level)
        return (
          <section key={region.level} className="card mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl">{region.name}</h2>
              <Chip>{region.stops.filter((s) => stamped(s.unitId)).length} / {region.stops.length} stamps</Chip>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {region.stops.map((s) => {
                const ok = stamped(s.unitId)
                return (
                  <Link key={s.unitId} to="/" title={`${s.name}: ${ok ? 'stamped' : 'not yet'}`} className={`flex aspect-square flex-col items-center justify-center rounded-2xl border-2 text-center ${ok ? 'rotate-[-4deg] border-brand-500 bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100' : 'border-dashed border-line text-muted opacity-70'}`}>
                    <span className="text-xl" aria-hidden="true">{ok ? s.emoji : '·'}</span>
                    <span className="mt-0.5 line-clamp-2 px-1 text-[9px] font-extrabold leading-tight">{s.name}</span>
                  </Link>
                )
              })}
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
                      <span className="block text-[11px] text-muted">{have ? sv.blurb : sv.en}</span>
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
              return <li key={s.id}>{sv?.emoji} {sv?.es} <span className="text-muted">· {s.source === 'quest' ? 'quest reward' : 'lucky find'} · {new Date(s.ts).toLocaleDateString()}</span></li>
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
