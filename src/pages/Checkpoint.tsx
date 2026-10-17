import { useEffect, useRef, useState } from 'react'
import { SouvenirIcon } from '../components/art/SouvenirArt'
import { useNavigate, useParams, Link } from 'react-router'
import type { Unit } from '../engine/schema'
import { loadUnit, levels, units, vocab, vocabUpTo, levelOf, unitIsAuthored } from '../engine/loader'
import { buildCheckpoint, checkpointSeed, CHECKPOINT_PASS, CHECKPOINT_PARTS, type CheckpointExercise, type CheckpointPart, type CheckpointRecord } from '../engine/checkpoint'
import { getKv, setKv, ownedSouvenirs, awardSouvenir } from '../db/progress'
import { pickReward } from '../engine/quests'
import { stopFor, type Souvenir } from '../engine/journey'
import { todayKey } from '../engine/mastery'
import { hashString } from '../engine/random'
import { rememberReturn } from '../engine/returnTo'
import { playSound } from '../engine/sounds'
import { lookupForm } from '../hooks/useDeps'
import { IRREGULAR } from '@lang/verbs'
import { LANGUAGE } from '../engine/course'
import { LessonRunner } from '../components/LessonRunner'
import { Button } from '../components/ui/basics'
import { IconArrowLeft, IconBook, IconCheck } from '../components/ui/icons'
import { Confetti } from '../components/ui/Confetti'

type Tally = Record<CheckpointPart, { ok: number; total: number }>
interface Outcome {
  score: number
  ok: number
  total: number
  parts: Tally
  passed: boolean
  best: number
  souvenir?: Souvenir
  firstPass: boolean
}
type Phase =
  | { kind: 'loading' }
  | { kind: 'intro'; exercises: CheckpointExercise[]; record?: CheckpointRecord }
  | { kind: 'run'; exercises: CheckpointExercise[]; record?: CheckpointRecord }
  | { kind: 'done'; outcome: Outcome }
  | { kind: 'error'; message: string }

const PART_LABEL: Record<CheckpointPart, string> = { reading: 'Reading', writing: 'Writing', recall: 'Recall' }
const PART_BLURB: Record<CheckpointPart, string> = {
  reading: 'a scene from this stop, with questions',
  writing: `say it in ${LANGUAGE}, from all four lessons`,
  recall: 'a few things from the stops before',
}

const pct = (x: number) => `${Math.round(x * 100)}%`

/** The stops just before this one in the same region, nearest first. */
async function previousUnits(unitId: string): Promise<Unit[]> {
  const ref = units.get(unitId)
  const level = ref && levels.find((l) => l.id === ref.level)
  if (!ref || !level) return []
  const ids = level.units.slice(Math.max(0, ref.index - 2), ref.index).map((u) => u.id).reverse().filter(unitIsAuthored)
  const out: Unit[] = []
  for (const id of ids) {
    try {
      out.push(await loadUnit(id))
    } catch {
      /* skip */
    }
  }
  return out
}

export default function CheckpointPage() {
  const { unitId = '' } = useParams()
  const nav = useNavigate()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const answers = useRef<{ part: CheckpointPart; ok: boolean }[]>([])
  const where = stopFor(unitId)
  const level = levelOf(unitId)
  const stopName = where?.stop.name ?? units.get(unitId)?.title ?? unitId

  useEffect(() => {
    if (phase.kind !== 'loading') return
    let alive = true
    ;(async () => {
      try {
        const unit = await loadUnit(unitId)
        const previous = await previousUnits(unitId)
        const record = await getKv<CheckpointRecord | undefined>(`checkpoint:${unitId}`, undefined)
        const ctx = { vocab, pool: vocabUpTo(level), verbs: IRREGULAR, stageOf: () => undefined, speech: false, lookup: lookupForm }
        const exercises = buildCheckpoint(unit, previous, ctx, checkpointSeed(unitId, record?.attempts ?? 0))
        if (alive) setPhase({ kind: 'intro', exercises, record })
      } catch (e) {
        if (alive) setPhase({ kind: 'error', message: (e as Error).message })
      }
    })()
    return () => {
      alive = false
    }
  }, [phase.kind, unitId, level])

  const back = () => {
    rememberReturn(`unit-${unitId}`)
    nav('/', { state: { from: `unit-${unitId}` } })
  }

  const finish = async (exercises: CheckpointExercise[], prev: CheckpointRecord | undefined) => {
    const parts: Tally = { reading: { ok: 0, total: 0 }, writing: { ok: 0, total: 0 }, recall: { ok: 0, total: 0 } }
    for (const ex of exercises) parts[ex.part].total++
    for (const a of answers.current) if (a.ok) parts[a.part].ok++
    const total = exercises.length
    const ok = answers.current.filter((a) => a.ok).length
    const score = total ? ok / total : 0
    const passed = score >= CHECKPOINT_PASS
    const key = `checkpoint:${unitId}`
    // Re-read: another tab may have saved since the page opened.
    const saved = (await getKv<CheckpointRecord | undefined>(key, undefined)) ?? prev
    const firstPass = passed && (saved?.passes ?? 0) === 0
    const record: CheckpointRecord = {
      best: Math.max(saved?.best ?? 0, score),
      last: score,
      date: todayKey(),
      passes: (saved?.passes ?? 0) + (passed ? 1 : 0),
      attempts: (saved?.attempts ?? 0) + 1,
    }
    await setKv(key, record)
    let souvenir: Souvenir | undefined
    if (firstPass) {
      const reward = pickReward(level, await ownedSouvenirs(), hashString(`checkpoint:${unitId}`))
      if (reward && (await awardSouvenir(reward.id, 'checkpoint', unitId))) souvenir = reward
    }
    if (passed) playSound('finish')
    setPhase({ kind: 'done', outcome: { score, ok, total, parts, passed, best: record.best, souvenir, firstPass } })
  }

  if (phase.kind === 'loading') return <div className="p-6 text-center text-muted">Preparing your checkpoint…</div>
  if (phase.kind === 'error')
    return (
      <div className="p-6">
        <p className="font-bold">This checkpoint is not available yet.</p>
        <p className="text-sm text-muted">{phase.message}</p>
        <Link to="/" className="btn btn-ghost mt-4">Back to the journey</Link>
      </div>
    )
  if (phase.kind === 'run')
    return (
      <div className={`lvl-${level}`}>
        <LessonRunner
          exercises={phase.exercises}
          mode="checkpoint"
          lessonId={unitId}
          title={`Checkpoint · ${stopName}`}
          onAnswer={(ex, verdict) => answers.current.push({ part: (ex as CheckpointExercise).part, ok: verdict !== 'wrong' })}
          onQuit={back}
          onFinish={() => void finish(phase.exercises, phase.record)}
        />
      </div>
    )
  if (phase.kind === 'intro') {
    const counts = CHECKPOINT_PARTS.map((p) => ({ part: p, n: phase.exercises.filter((e) => e.part === p).length })).filter((c) => c.n > 0)
    const rec = phase.record
    return (
      <div className={`lvl-${level} animate-rise mx-auto flex min-h-full max-w-xl flex-col px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))]`}>
        <button type="button" onClick={back} className="mb-3 flex items-center gap-1 self-start text-sm text-ink-2">
          <IconArrowLeft width={18} height={18} /> Journey
        </button>
        <div className="card relative overflow-hidden !p-0">
          <div className="airmail h-1.5 w-full" aria-hidden="true" />
          <div className="p-5">
            <p className="eyebrow">Checkpoint · {where ? `Stop ${where.index + 1}` : 'Stop'}</p>
            <h1 className="mt-1 text-[2.1rem]">{stopName}</h1>
            <p className="mt-1 text-sm text-ink-2">A short quiz on everything from this stop's four lessons. About 5 minutes, {phase.exercises.length} questions.</p>
            <ul className="mt-4 divide-y divide-[var(--line)] border-y border-line">
              {counts.map(({ part, n }) => (
                <li key={part} className="flex items-center gap-3 py-2.5">
                  <span className="w-6 shrink-0 font-mono text-sm" style={{ color: 'var(--lvl)' }}>{n}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{PART_LABEL[part]}</span>
                    <span className="block text-xs text-ink-2">{PART_BLURB[part]}</span>
                  </span>
                  {part === 'reading' && <IconBook width={18} height={18} className="text-ink-2" />}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-2">
              Score <span className="font-mono">{pct(CHECKPOINT_PASS)}</span> or more to clear it.
              {rec ? <> Best so far <span className="font-mono text-ink">{pct(rec.best)}</span>{rec.passes > 0 ? ' · cleared' : ''}.</> : ' Each try is a different version.'}
            </p>
            {rec && rec.passes > 0 && <span className="inkstamp absolute right-4 top-6 text-xs" style={{ color: 'var(--lvl)' }}>Cleared</span>}
          </div>
        </div>
        <div className="mt-auto pt-8">
          <Button
            className="w-full py-4"
            onClick={() => {
              answers.current = []
              setPhase({ kind: 'run', exercises: phase.exercises, record: phase.record })
            }}
          >
            Start the checkpoint
          </Button>
        </div>
      </div>
    )
  }
  const o = phase.outcome
  return (
    <div className={`lvl-${level} animate-rise mx-auto flex min-h-full max-w-xl flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]`}>
      {o.passed && <Confetti />}
      <p className="eyebrow text-center">Checkpoint · {stopName}</p>
      <div className="relative mx-auto mt-4 w-full max-w-sm rounded-2xl border border-line bg-card px-5 pb-6 pt-5 text-center shadow-card">
        <p className="eyebrow">Your score</p>
        <p className="mt-1 font-mono text-[3.4rem] leading-none" aria-label={`Score ${pct(o.score)}`}>
          <span>{pct(o.score)}</span>
        </p>
        <p className="mt-2 text-sm text-ink-2">
          <span className="font-mono">{o.ok}</span> of <span className="font-mono">{o.total}</span> right
        </p>
        <div className="mt-4 flex justify-center">
          {o.passed ? (
            <p className="inkstamp animate-stamp text-base text-ok-500"><IconCheck width={20} height={20} strokeWidth={3} />Checkpoint cleared</p>
          ) : (
            <p className="font-hand text-2xl leading-tight text-ink-2">Not yet: {pct(CHECKPOINT_PASS)} clears it</p>
          )}
        </div>
      </div>

      <dl className="mx-auto mt-4 grid w-full max-w-sm divide-x divide-line rounded-2xl border border-line bg-card text-center shadow-card" style={{ gridTemplateColumns: `repeat(${CHECKPOINT_PARTS.filter((p) => o.parts[p].total).length}, minmax(0, 1fr))` }}>
        {CHECKPOINT_PARTS.filter((p) => o.parts[p].total).map((p) => (
          <div key={p} className="py-3">
            <dt className="eyebrow">{PART_LABEL[p]}</dt>
            <dd className="mt-1 font-mono text-xl">
              {o.parts[p].ok}<span className="text-xs text-ink-2">/{o.parts[p].total}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-center text-xs text-ink-2">
        Best <span className="font-mono text-ink">{pct(o.best)}</span>
        {o.passed ? (o.firstPass ? ' · first time cleared' : ' · cleared again') : ' · go over the lessons and try another version'}
      </p>

      {o.souvenir && (
        <div className="animate-pop mx-auto mt-4 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-card">
          <span className="stamp p-1" aria-hidden="true"><SouvenirIcon souvenir={o.souvenir} size={44} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Souvenir: {o.souvenir.es}</p>
            <p className="text-xs text-ink-2">{o.souvenir.blurb} Added to your passport.</p>
          </div>
        </div>
      )}

      <div className="mx-auto mt-auto grid w-full max-w-sm gap-3 pt-8">
        <Button variant="ghost" onClick={() => setPhase({ kind: 'loading' })}>Try another version</Button>
        <Button variant="primary" className="py-4" onClick={back}>Back to the journey</Button>
      </div>
    </div>
  )
}
