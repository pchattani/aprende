/**
 * The journey as a game world map: one chapter per region (CEFR level), and per stop a
 * banner and a winding road of lesson medallions ending in a checkpoint chest. Each
 * region closes with the border-control gate (the level check). The dogs stand at the
 * current lesson. Every lesson stays open: nodes show state, never locks.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { levels } from '../../engine/loader'
import { lessonMastery, ringFor } from '../../engine/mastery'
import { lessonIdsFor, levelComplete } from '../../engine/unlock'
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
import { ChestNode, GateNode, LessonNode, NodePopover } from './MapNodes'
import { MapDogs, DOGS_WIDTH } from './MapDogs'
import { Scenery, type SceneryKind } from './MapArt'
import { MAP, roadSegments, stopLayout, type MapPoint } from './geometry'
import './map.css'

export interface WorldMapProps {
  lessonRows: Map<string, LessonRow>
  lessonMeta: Map<string, Lesson[]>
  lessonCounts: Map<string, number>
  cardsByLesson: Map<string, CardRow[]>
  exams: Map<LevelId, ExamRow>
  startLevel: LevelId
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

const SCENERY: Record<string, SceneryKind[]> = {
  a1: ['tree', 'sign', 'bush', 'flowers'],
  a2: ['flowers', 'bush', 'hill', 'tree'],
  b1: ['rock', 'hill', 'bush', 'sign'],
  b2: ['hill', 'tree', 'rock', 'flowers'],
  c1: ['pine', 'rock', 'pine', 'bush'],
  c2: ['pine', 'rock', 'hill', 'sign'],
}

export function WorldMap(props: WorldMapProps) {
  const { lessonRows, lessonCounts, exams, startLevel, quizRecords, flag } = props
  const checkpoints = useKvPrefix<CheckpointRecord>('checkpoint:')
  // undefined: the current lesson's card is open; null: every card closed
  const [selected, setSelected] = useState<string | null | undefined>(undefined)
  const [stamp, setStamp] = useState<{ stop: Stop; region: Region; earned: boolean } | undefined>()
  const open = selected === undefined ? props.currentId : selected ?? undefined

  // Tap elsewhere or press Escape to close a lesson card.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (t?.closest?.('.wm-pop, .wm-node')) return
      setSelected(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  let stopCounter = 0
  return (
    <div className="wm">
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
        return (
          <section key={lv.id} id={`region-${lv.id}`} className={`lvl-${lv.id} mb-12 ${props.highlight === `region-${lv.id}` ? 'wm-highlight rounded-[26px]' : ''}`}>
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
            {lv.units.map((u, unitIdx) => {
              const dir: 1 | -1 = stopCounter++ % 2 === 0 ? 1 : -1
              return (
                <StopSegment
                  key={u.id}
                  {...props}
                  unit={u}
                  unitIdx={unitIdx}
                  level={lv}
                  region={region}
                  dir={dir}
                  open={open}
                  onSelect={(id) => setSelected(id)}
                  onClose={() => setSelected(null)}
                  checkpoint={checkpoints?.get(`checkpoint:${u.id}`)}
                  onStamp={(s, earned) => region && setStamp({ stop: s, region, earned })}
                />
              )
            })}
            {ids.length > 0 && (
              <div className="relative pb-2 pt-14">
                <span className="wm-road-stub" style={{ bottom: 'auto', height: '6.5rem' }} aria-hidden="true" />
                <span className="wm-border" style={{ top: 'calc(3.5rem + 52px)' }} aria-hidden="true" />
                <GateNode level={lv.id} title={lv.title} complete={levelComplete(lv, lessonRows, lessonCounts)} passed={Boolean(exam?.passed)} score={exam?.score} />
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function StopSegment({ unit: u, unitIdx, level: lv, region, dir, open, onSelect, onClose, checkpoint, onStamp, lessonRows, lessonMeta, lessonCounts, cardsByLesson, currentId, highlight, outfits }: WorldMapProps & {
  unit: LevelMeta['units'][number]
  unitIdx: number
  level: LevelMeta
  region?: Region
  dir: 1 | -1
  open?: string
  onSelect: (id: string) => void
  onClose: () => void
  checkpoint?: CheckpointRecord
  onStamp: (stop: Stop, earned: boolean) => void
}) {
  const stop = region?.stops[unitIdx]
  const lessons = lessonMeta.get(u.id)
  const list = lessons ?? Array.from({ length: lessonCounts.get(u.id) ?? 4 }, (_, i) => ({ id: `${u.id}.l${i + 1}`, title: `Lesson ${i + 1}` }))
  const stamped = Boolean(u.authored) && isStamped(u.id, lessonRows, list.length)
  const doneHere = list.filter((l) => (lessonRows.get(l.id)?.completions ?? 0) > 0).length
  const fade = unitFade(list.flatMap((l) => cardsByLesson.get(l.id) ?? []))
  const stopName = stop?.name ?? u.title
  const banner = (
    <div className="relative pt-7">
      <span className="wm-road-stub" aria-hidden="true" />
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
    </div>
  )
  if (!u.authored) {
    return (
      <div id={`unit-${u.id}`} className="relative">
        {banner}
        <div className="relative h-8"><span className="wm-road-stub" aria-hidden="true" /></div>
      </div>
    )
  }

  const rows = list.map((l) => {
    const row = lessonRows.get(l.id)
    const mastery = lessonMastery(cardsByLesson.get(l.id) ?? [])
    return { ...l, mastery, status: ringFor(row, mastery), done: (row?.completions ?? 0) > 0 }
  })
  const cleared = Boolean(checkpoint && checkpoint.passes > 0)
  const ready = doneHere >= list.length
  const best = checkpoint ? `${Math.round(checkpoint.best * 100)}%` : ''
  const cpStatus = cleared ? `Cleared · ${best}` : ready ? (checkpoint ? `Ready · best ${best}` : 'Ready') : `Recommended after the ${list.length} lessons`

  const { points, height } = stopLayout(rows.length + 1, dir)
  const start: MapPoint = { x: 0, y: 0 }
  const end: MapPoint = { x: 0, y: height }
  const segs = roadSegments([start, ...points, end], { x: 0, y: -MAP.top }, { x: 0, y: height + MAP.bottom })
  const road = `M0 0 ${segs.join(' ')}`
  // ink the road up to the last node reached in order (lessons, then the chest)
  const doneFlags = [...rows.map((r) => r.done), cleared]
  let reached = 0
  while (reached < doneFlags.length && doneFlags[reached]) reached++
  const inked = reached === 0 ? '' : `M0 0 ${segs.slice(0, reached === doneFlags.length ? segs.length : reached).join(' ')}`

  const cur = rows.findIndex((r) => r.id === currentId)
  const curPt = cur >= 0 ? points[cur]! : undefined
  const dogSide = curPt && curPt.x > 8 ? -1 : 1
  const openIdx = rows.findIndex((r) => r.id === open)
  const kinds = SCENERY[lv.id] ?? SCENERY.a1!
  const last = rows.length
  const mid = (a: number, b: number) => (points[a]!.y + points[b]!.y) / 2
  const props = [
    { kind: kinds[unitIdx % kinds.length]!, x: -dir * 150, y: mid(0, 1), size: 52 },
    { kind: kinds[(unitIdx + 1) % kinds.length]!, x: -dir * 118, y: mid(0, 1) + 52, size: 32 },
    { kind: kinds[(unitIdx + 2) % kinds.length]!, x: dir * 150, y: mid(last - 1, last), size: 50 },
    { kind: kinds[(unitIdx + 3) % kinds.length]!, x: dir * 122, y: points[last]!.y + 46, size: 30 },
  ]
  // soft ground patches on the open side of each bend
  const patches = [
    { x: -dir * 120, y: mid(0, 1) + 10, w: 190, h: 150 },
    { x: dir * 120, y: mid(last - 1, last) + 10, w: 200, h: 160 },
  ]

  return (
    <div id={`unit-${u.id}`} className="relative">
      {banner}
      <div className="relative" style={{ height }}>
        {patches.map((p, i) => (
          <span key={`p${i}`} className="wm-patch" style={{ top: p.y, width: p.w, height: p.h, transform: `translate(calc(-50% + ${p.x}px), -50%)` }} aria-hidden="true" />
        ))}
        <svg className="wm-road" width={MAP.width} height={height} viewBox={`${-MAP.width / 2} 0 ${MAP.width} ${height}`} style={{ marginLeft: -MAP.width / 2 }} aria-hidden="true">
          <path d={road} className="edge" fill="none" strokeWidth={38} strokeLinecap="round" />
          <path d={road} className="surface" fill="none" strokeWidth={30} strokeLinecap="round" />
          <path d={road} className="dash" fill="none" strokeWidth={4} strokeDasharray="9 12" strokeLinecap="round" />
          {inked && <path d={inked} className="ink" fill="none" strokeWidth={4.5} strokeDasharray="9 12" strokeLinecap="round" />}
        </svg>
        {props.map((p, i) => (
          <span key={i} className="pointer-events-none absolute left-1/2" style={{ top: p.y, transform: `translate(calc(-50% + ${p.x}px), -75%)` }} aria-hidden="true">
            <Scenery kind={p.kind} size={p.size} />
          </span>
        ))}
        {rows.map((l, i) => (
          <LessonNode key={l.id} id={l.id} n={i + 1} title={l.title} status={l.status} mastery={l.mastery} current={l.id === currentId} open={l.id === open} highlight={highlight === `lesson-${l.id}`} x={points[i]!.x} y={points[i]!.y} onSelect={onSelect} />
        ))}
        <ChestNode unitId={u.id} stopName={stopName} status={cpStatus} cleared={cleared} ready={ready} x={points[rows.length]!.x} y={points[rows.length]!.y} />
        {curPt && (
          <MapDogs
            at={rows[cur]!.id}
            outfits={outfits}
            style={{ left: '50%', top: curPt.y + 22, transform: `translate(calc(${curPt.x + dogSide * (MAP.node / 2 + 10 + DOGS_WIDTH / 2)}px - 50%), -100%)` }}
          />
        )}
        {openIdx >= 0 && (
          <NodePopover id={rows[openIdx]!.id} n={openIdx + 1} count={rows.length} title={rows[openIdx]!.title} status={rows[openIdx]!.status} mastery={rows[openIdx]!.mastery} stopName={stopName} x={points[openIdx]!.x} y={points[openIdx]!.y} onClose={onClose} />
        )}
      </div>
    </div>
  )
}
