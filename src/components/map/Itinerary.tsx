/**
 * The journey as a travel itinerary: one chapter per region (CEFR level), and per stop
 * its postcard banner followed by a card for each lesson and the checkpoint chest, all
 * strung on a slim route line down the left edge. Each region closes with border control
 * (the level check). The dogs stand on the current lesson's card. Lessons further along
 * the route than the learner has reached are locked (engine/unlock.ts): their card shows
 * what to finish first, and the stop's checkpoint opens once its lessons are done.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { levels } from '../../engine/loader'
import { lessonMastery, ringFor } from '../../engine/mastery'
import { lessonIdsFor, levelComplete, isCheckpointOpen, isWritingOpen, lockHint, type CourseAccess } from '../../engine/unlock'
import { REGIONS, isStamped, type Region, type Stop } from '../../engine/journey'
import { QUIZ_PASS } from '../../engine/quiz'
import { useKvPrefix } from '../../hooks/useProgress'
import type { CheckpointRecord } from '../../engine/checkpoint'
import type { Outfits } from '../../hooks/useOutfits'
import type { LevelId, LevelMeta, Lesson } from '../../engine/schema'
import type { CardRow, ExamRow, LessonRow } from '../../engine/types'
import { StampCard } from '../StampCard'
import { StopBanner } from './StopBanner'
import { RegionChapter } from './RegionChapter'
import { BorderCard, CheckpointCard, LessonCard, RouteDot, WritingCard } from './ItineraryCards'
import { useWritingStops, writingSummary, type WritingRecord } from '../../hooks/useWriting'
import { WRITING_PASS } from '../../engine/writing'
import { MapDogs } from './MapDogs'
import './map.css'

export interface ItineraryProps {
  lessonRows: Map<string, LessonRow>
  lessonMeta: Map<string, Lesson[]>
  lessonCounts: Map<string, number>
  cardsByLesson: Map<string, CardRow[]>
  exams: Map<LevelId, ExamRow>
  startLevel: LevelId
  /** Which lessons are open. */
  access: CourseAccess
  quizRecords?: Map<string, { best: number }>
  /** The lesson the dogs are at (up next). */
  currentId?: string
  /** Element id flashed after return-to-spot. */
  highlight?: string
  outfits: Outfits
  flag: string
}

/** How faded a stop's postcard is: the share of its practised cards that are due now. */
function unitFade(cs: { reps: number; due: number }[]): number {
  const seen = cs.filter((c) => c.reps > 0)
  if (!seen.length) return 0
  const now = Date.now()
  return seen.filter((c) => c.due <= now).length / seen.length
}

export function Itinerary(props: ItineraryProps) {
  const { lessonRows, lessonCounts, exams, startLevel, access, quizRecords, flag, highlight } = props
  const checkpoints = useKvPrefix<CheckpointRecord>('checkpoint:')
  const writing = useKvPrefix<WritingRecord>('writing:')
  const writingStops = useWritingStops()
  const [stamp, setStamp] = useState<{ stop: Stop; region: Region; earned: boolean } | undefined>()

  return (
    <div className="it">
      {stamp &&
        createPortal(
          // Portal: the page's rise animation uses a transform, which would trap a fixed overlay inside it.
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={stamp.stop.name}
            onClick={(e) => {
              // a link inside the card ("Go to this stop") also closes it
              if (e.target === e.currentTarget || (e.target as Element).closest('a')) setStamp(undefined)
            }}
          >
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto">
              <StampCard stop={stamp.stop} region={stamp.region} earned={stamp.earned} onClose={() => setStamp(undefined)} />
            </div>
          </div>,
          document.body,
        )}
      {levels.map((lv, levelIdx) => {
        const region = REGIONS.find((r) => r.level === lv.id)
        const ids = lessonIdsFor(lv, lessonCounts)
        const doneCount = ids.filter((l) => (lessonRows.get(l.id)?.completions ?? 0) > 0).length
        const stamps = lv.units.map((u) => Boolean(u.authored) && isStamped(u.id, lessonRows, lessonCounts.get(u.id) ?? 4))
        const quiz = quizRecords?.get(`regionQuiz:${lv.id}`)
        const exam = exams.get(lv.id)
        const complete = levelComplete(lv, lessonRows, lessonCounts)
        // passing border control opens the next region from its first lesson
        const nextLv = levels[levelIdx + 1]
        const nextFirst = access.order.find((l) => l.level === nextLv?.id)
        const unlocks = nextLv && nextFirst && !access.isOpen(nextFirst.id) ? nextLv.title : undefined
        return (
          <section key={lv.id} id={`region-${lv.id}`} className={`lvl-${lv.id} mb-12 ${highlight === `region-${lv.id}` ? 'wm-highlight rounded-[26px]' : ''}`}>
            <RegionChapter
              chapter={levelIdx + 1}
              level={lv}
              region={region}
              flag={flag}
              recommended={lv.id === startLevel}
              doneCount={doneCount}
              lessonTotal={ids.length}
              stamps={stamps}
              quizOpen={stamps.filter(Boolean).length >= Math.ceil(lv.units.length / 2)}
              quizBest={quiz?.best}
              quizPass={QUIZ_PASS}
            />
            <div className="it-region">
              {lv.units.map((u, unitIdx) => (
                <StopLeg
                  key={u.id}
                  {...props}
                  unit={u}
                  unitIdx={unitIdx}
                  level={lv}
                  region={region}
                  checkpoint={checkpoints?.get(`checkpoint:${u.id}`)}
                  writingCount={writingStops?.get(u.id)?.prompts ?? 0}
                  writing={writing?.get(`writing:${u.id}`)}
                  onStamp={(s, earned) => region && setStamp({ stop: s, region, earned })}
                />
              ))}
              {ids.length > 0 && (
                <div className={`it-row is-border ${complete ? 'is-inked' : ''}`}>
                  <span className="it-rail" aria-hidden="true"><RouteDot kind={exam?.passed ? 'gate-done' : 'gate'} /></span>
                  <BorderCard level={lv.id} title={lv.title} complete={complete} passed={Boolean(exam?.passed)} score={exam?.score} unlocks={unlocks} />
                </div>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/**
 * Inks the route line from the top of the stop down to the given dot (or all the way when
 * `to` is 'end'), measured from the layout so the dashes line up with the grey line under it.
 */
function useInkHeight(to: string | undefined) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>()
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !to) {
      setHeight(undefined)
      return
    }
    const measure = () => {
      if (to === 'end') return setHeight(el.offsetHeight)
      const dot = el.querySelector<HTMLElement>(`[data-dot="${to}"] .it-dot`)
      if (!dot) return setHeight(undefined)
      const a = el.getBoundingClientRect()
      const b = dot.getBoundingClientRect()
      setHeight(Math.max(0, Math.round(b.top + b.height / 2 - a.top)))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [to])
  return { ref, height }
}

function StopLeg({ unit: u, unitIdx, level: lv, region, checkpoint, writingCount, writing, onStamp, lessonRows, lessonMeta, lessonCounts, cardsByLesson, access, currentId, highlight, outfits }: ItineraryProps & {
  unit: LevelMeta['units'][number]
  unitIdx: number
  level: LevelMeta
  region?: Region
  checkpoint?: CheckpointRecord
  /** The stop's writing prompts (0: none yet) and the learner's record. */
  writingCount: number
  writing?: WritingRecord
  onStamp: (stop: Stop, earned: boolean) => void
}) {
  const stop = region?.stops[unitIdx]
  const lessons = lessonMeta.get(u.id)
  const list = lessons ?? Array.from({ length: lessonCounts.get(u.id) ?? 4 }, (_, i) => ({ id: `${u.id}.l${i + 1}`, title: `Lesson ${i + 1}`, vocab: [] as string[] }))
  const stamped = Boolean(u.authored) && isStamped(u.id, lessonRows, list.length)
  const doneHere = list.filter((l) => (lessonRows.get(l.id)?.completions ?? 0) > 0).length
  const fade = unitFade(list.flatMap((l) => cardsByLesson.get(l.id) ?? []))
  const stopName = stop?.name ?? u.title

  const rows = list.map((l) => {
    const row = lessonRows.get(l.id)
    const mastery = lessonMastery(cardsByLesson.get(l.id) ?? [])
    return { ...l, mastery, status: ringFor(row, mastery), done: (row?.completions ?? 0) > 0, locked: access.isOpen(l.id) ? undefined : lockHint(access.blocker(l.id), u.id) }
  })
  const cleared = Boolean(checkpoint && checkpoint.passes > 0)
  const ready = doneHere >= list.length
  const cpOpen = isCheckpointOpen(u.id, lessonRows, list.length, Boolean(checkpoint))
  const wrOpen = isWritingOpen(u.id, lessonRows, list.length, Boolean(writing && Object.values(writing.prompts).some((p) => p.checks > 0)))
  const wr = writingSummary(writing, writingCount, WRITING_PASS)
  const best = checkpoint ? `${Math.round(checkpoint.best * 100)}%` : ''
  const cpStatus = cleared ? `Cleared · ${best}` : ready ? (checkpoint ? `Ready · best ${best}` : 'Ready') : `Recommended after the ${list.length} lessons`

  // ink the route up to the first stop not yet reached in order (lessons, then the chest)
  const doneFlags = [...rows.map((r) => r.done), cleared]
  let reached = 0
  while (reached < doneFlags.length && doneFlags[reached]) reached++
  const inkTo = !u.authored || reached === 0 ? undefined : reached === doneFlags.length ? 'end' : String(reached)
  const { ref, height } = useInkHeight(inkTo)

  return (
    <div id={`unit-${u.id}`} ref={ref} className="it-stop">
      <span className="it-line" aria-hidden="true" />
      {height !== undefined && <span className="it-line is-inked" style={{ height }} aria-hidden="true" />}
      <StopBanner
        index={unitIdx}
        unitTitle={u.title}
        subtitle={u.subtitle}
        stop={stop}
        level={lv.id}
        authored={Boolean(u.authored)}
        lessonsDone={doneHere}
        lessonsTotal={list.length}
        stamped={stamped}
        fade={fade}
        highlight={highlight === `unit-${u.id}`}
        onOpen={stop ? () => onStamp(stop, stamped) : undefined}
      />
      {u.authored && (
        <ol className="it-legs" aria-label={`Stop ${unitIdx + 1}: lessons and checkpoint`}>
          {rows.map((l, i) => {
            const current = l.id === currentId
            return (
              <li key={l.id} className={`it-row ${current ? 'is-current' : ''}`} data-dot={i}>
                <span className="it-rail" aria-hidden="true"><RouteDot kind={current ? 'current' : l.locked ? 'locked' : (l.status as 'new')} /></span>
                <LessonCard id={l.id} n={i + 1} title={l.title} status={l.status} mastery={l.mastery} words={l.vocab?.length ?? 0} current={current} highlight={highlight === `lesson-${l.id}`} locked={l.locked}>
                  {current && <MapDogs at={l.id} outfits={outfits} />}
                </LessonCard>
              </li>
            )
          })}
          {writingCount > 0 && (
            <li className="it-row is-cp" data-dot="writing">
              <span className="it-rail" aria-hidden="true"><RouteDot kind={!wrOpen ? 'locked' : wr.done >= writingCount ? 'learned' : wr.done ? 'started' : 'new'} /></span>
              <WritingCard unitId={u.id} stopName={stopName} count={writingCount} done={wr.done} best={wr.best} open={wrOpen} lessonsDone={doneHere} lessonsTotal={list.length} highlight={highlight === `writing-${u.id}`} />
            </li>
          )}
          <li className="it-row is-cp" data-dot={rows.length}>
            <span className="it-rail" aria-hidden="true"><RouteDot kind={cleared ? 'chest-done' : 'chest'} /></span>
            <CheckpointCard unitId={u.id} stopName={stopName} status={cpStatus} cleared={cleared} ready={ready} done={doneHere} total={list.length} highlight={highlight === `checkpoint-${u.id}`} locked={!cpOpen} />
          </li>
        </ol>
      )}
    </div>
  )
}
