/**
 * Word search: 6–8 of the learner's words hidden in a grid of letters (accents left out, or
 * Jyutping without tones for Cantonese), English clues underneath. Swipe across a word, or tap
 * its first and last letter (also with the keyboard: arrows, then Enter on each end).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { VocabEntry, LevelId } from '../../engine/schema'
import { LEVEL_ORDER_LIST, ui } from '../../engine/loader'
import { generateWordSearch, placementCells, snapLine, inLine, findSelection, cellKey, WS_DIRS, type Cell, type WsLevel, type WordSearch as WS } from '../../engine/games/wordSearch'
import { recordAnswer } from '../../db/progress'
import { playSound } from '../../engine/sounds'
import { TL } from '../../engine/course'
import { Chip } from '../../components/ui/basics'
import { TargetText } from '../../components/ui/TargetText'
import { TooFew } from '../palabras/shared'
import { addMinutes, formatTime, e2eHook } from '../palabras/util'
import type { GameProps } from './catalog'
import { GameHeader } from './GameHeader'
import { useGameWords, recordGame } from './util'
import { fold, courseAlphabet, useGameBest } from './wordGames'
import { fitsWordSearch, gridLetters } from './requirements'
import { GameOver, Loading } from './WordGameOver'

const ID = 'wordsearch'
const TITLE = 'Word search'
/** Words asked for: some will not fit or hide inside another. */
const WANT = 14

/** Beginners read left to right and down; later levels add upward diagonals, then backwards words. */
function levelOf(words: VocabEntry[]): WsLevel {
  const top = Math.max(0, ...words.map((v) => LEVEL_ORDER_LIST.indexOf(v.level as LevelId)))
  return top >= 3 ? 'hard' : top >= 1 ? 'normal' : 'easy'
}
const HOW: Record<WsLevel, string> = {
  easy: 'Words run across, down and diagonally.',
  normal: 'Words run across, down and both ways diagonally.',
  hard: 'Words run in every direction, even backwards.',
}
const COUNT: Record<WsLevel, number> = { easy: 6, normal: 7, hard: 8 }
/** Highlighter inks for found words (see-through, so they read in light and dark). */
const INKS = ['var(--blue)', 'var(--ok)', 'var(--sun)', 'var(--red)', '#c2477a', '#e07a2e', '#7a5cd6', '#1f9aa8']

export default function WordSearch({ onDone }: GameProps) {
  const [round, setRound] = useState(0)
  const words = useGameWords(WANT, fitsWordSearch, round)
  const best = useGameBest(ID)
  return (
    <div className="animate-rise pb-6">
      {words === undefined ? (
        <>
          <GameHeader title={TITLE} onBack={onDone} />
          <Loading />
        </>
      ) : (
        <Puzzle key={round} words={words} best={best?.ms} onDone={onDone} onAgain={() => setRound((r) => r + 1)} />
      )}
    </div>
  )
}

function Puzzle({ words, best, onDone, onAgain }: { words: VocabEntry[]; best?: number; onDone: () => void; onAgain: () => void }) {
  const [seed] = useState(() => Date.now() >>> 0)
  const level = levelOf(words)
  const puzzle = useMemo<WS>(() => {
    // two spare words stand in for any that hide inside another; the round keeps to its size
    const ws = generateWordSearch(
      words.map((v) => ({ id: v.id, letters: gridLetters(v)!.map(fold) })).slice(0, COUNT[level] + 2),
      seed,
      { dirs: WS_DIRS[level], alphabet: courseAlphabet() },
    )
    if (ws.placements.length <= COUNT[level]) return ws
    return generateWordSearch(ws.placements.slice(0, COUNT[level]), seed, { dirs: WS_DIRS[level], alphabet: courseAlphabet() })
  }, [words, seed, level])
  const byId = useMemo(() => new Map(words.map((v) => [v.id, v])), [words])
  if (puzzle.placements.length < 4)
    return (
      <>
        <GameHeader title={TITLE} onBack={onDone} />
        <TooFew onBack={onDone} game={ID}>The word search needs a few more words that fit a grid.</TooFew>
      </>
    )
  return <Board ws={puzzle} level={level} byId={byId} best={best} onDone={onDone} onAgain={onAgain} />
}

function Board({ ws, level, byId, best, onDone, onAgain }: { ws: WS; level: WsLevel; byId: Map<string, VocabEntry>; best?: number; onDone: () => void; onAgain: () => void }) {
  const { size, grid, placements } = ws
  /** id → highlighter ink (index into INKS, -1 = shown by "Show answers"), in the order found. */
  const [found, setFound] = useState<Map<string, number>>(new Map())
  const [hinted, setHinted] = useState<Set<string>>(new Set())
  const [hintCell, setHintCell] = useState<Cell | undefined>()
  const [gaveUp, setGaveUp] = useState(false)
  /** The line under the finger while swiping. */
  const [line, setLine] = useState<Cell[] | undefined>()
  /** First end of a tap-tap selection. */
  const [pending, setPending] = useState<Cell | undefined>()
  const [focus, setFocus] = useState<Cell>([0, 0])
  const [miss, setMiss] = useState<Cell[] | undefined>()
  const [note, setNote] = useState('')
  const [startedAt] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [finishedMs, setFinishedMs] = useState<number | undefined>()
  /** The best time before this round (the kv value updates once the round is recorded). */
  const [bestBefore, setBestBefore] = useState<number | undefined>()
  const gridRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ start: Cell; moved: boolean; id: number } | undefined>(undefined)
  const missTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const finishing = useRef(false)
  const finished = gaveUp || found.size === placements.length

  useEffect(() => {
    e2eHook('wordsearch', { size, placements: placements.map((p) => ({ id: p.id, word: p.letters.join(''), cells: placementCells(p) })) })
  }, [size, placements])
  useEffect(() => {
    if (finished) return
    const t = setInterval(() => setElapsed(Date.now() - startedAt), 500)
    return () => clearInterval(t)
  }, [startedAt, finished])
  useEffect(() => () => clearTimeout(missTimer.current), [])

  useEffect(() => {
    if (!finished || finishing.current) return
    finishing.current = true
    const ms = Date.now() - startedAt
    setFinishedMs(ms)
    setBestBefore(best)
    setPending(undefined)
    if (!gaveUp) playSound('finish')
    void (async () => {
      // only clean finishes (no hints, nothing shown) set a best time; every round counts as played
      await recordGame(ID, !gaveUp && hinted.size === 0 ? { ms } : {})
      await addMinutes(ms)
    })()
  }, [finished]) // eslint-disable-line react-hooks/exhaustive-deps

  const lemma = (id: string) => byId.get(id)?.lemma ?? ''
  const startNote = (cell: Cell) => setNote(`From ${grid[cell[0]]![cell[1]]!.toUpperCase()}: now tap the last letter`)
  const select = (cells: Cell[]) => {
    const p = findSelection(
      placements.filter((x) => !found.has(x.id)),
      cells,
    )
    if (p) {
      const next = new Map(found)
      next.set(p.id, found.size % INKS.length)
      setFound(next)
      if (hintCell && placementCells(p).some(([r, c]) => r === hintCell[0] && c === hintCell[1])) setHintCell(undefined)
      void recordAnswer(p.id, hinted.has(p.id) ? 'almost' : 'correct', 'choiceEn')
      if (next.size < placements.length) playSound('correct')
      setNote(`Found ${lemma(p.id)}: ${byId.get(p.id)?.en[0] ?? ''}`)
      return
    }
    if (cells.length < 2) return
    clearTimeout(missTimer.current)
    setMiss(cells)
    missTimer.current = setTimeout(() => setMiss(undefined), 600)
    const again = findSelection(
      placements.filter((x) => found.has(x.id)),
      cells,
    )
    setNote(again ? 'Already found' : `${cells.map(([r, c]) => grid[r]![c]).join('').toUpperCase()} is not one of the words`)
  }
  const tap = (cell: Cell) => {
    setFocus(cell)
    if (finished) return
    if (!pending) {
      setPending(cell)
      return startNote(cell)
    }
    if (pending[0] === cell[0] && pending[1] === cell[1]) {
      setPending(undefined)
      return setNote('')
    }
    if (!inLine(pending, cell)) {
      // not a straight line: start again from here
      setPending(cell)
      return startNote(cell)
    }
    setPending(undefined)
    setNote('')
    select(snapLine(pending, cell, size))
  }

  // ------------------------------------------------------------------ swiping
  const cellAt = (e: React.PointerEvent, clamp: boolean): Cell | undefined => {
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect || !rect.width) return undefined
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * size)
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * size)
    if (!clamp && (r < 0 || c < 0 || r >= size || c >= size)) return undefined
    return [Math.max(0, Math.min(size - 1, r)), Math.max(0, Math.min(size - 1, c))]
  }
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (finished || drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    const cell = cellAt(e, false)
    if (!cell) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { start: cell, moved: false, id: e.pointerId }
    setLine([cell])
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const cell = cellAt(e, true)
    if (!cell) return
    const l = snapLine(d.start, cell, size)
    if (l.length > 1) d.moved = true
    setLine(l)
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = undefined
    setLine(undefined)
    const cell = cellAt(e, true)
    const l = cell ? snapLine(d.start, cell, size) : [d.start]
    if (d.moved && l.length > 1) {
      setPending(undefined)
      setFocus(l[l.length - 1]!)
      select(l)
    } else tap(d.start)
  }
  const onPointerCancel = () => {
    drag.current = undefined
    setLine(undefined)
  }

  // ------------------------------------------------------------------ keyboard
  const onKeyDown = (e: React.KeyboardEvent) => {
    const moves: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }
    const m = moves[e.key]
    if (m) {
      e.preventDefault()
      const r = Math.max(0, Math.min(size - 1, focus[0] + m[0]))
      const c = Math.max(0, Math.min(size - 1, focus[1] + m[1]))
      setFocus([r, c])
      gridRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${cellKey(r, c)}"]`)?.focus()
    } else if (e.key === 'Escape' && pending) {
      setPending(undefined)
      setNote('')
    }
  }

  const hint = () => {
    const p = placements.find((x) => !found.has(x.id) && !hinted.has(x.id)) ?? placements.find((x) => !found.has(x.id))
    if (!p) return
    setHinted((h) => new Set(h).add(p.id))
    setHintCell([p.row, p.col])
    setNote(`“${byId.get(p.id)?.en[0] ?? ''}” starts at the ringed letter (row ${p.row + 1}, column ${p.col + 1})`)
  }
  const giveUp = () => {
    const next = new Map(found)
    for (const p of placements) {
      if (next.has(p.id)) continue
      next.set(p.id, -1)
      void recordAnswer(p.id, 'wrong', 'choiceEn')
    }
    setFound(next)
    setHintCell(undefined)
    setGaveUp(true)
  }

  const foundCount = [...found.values()].filter((i) => i >= 0).length
  const ink = (id: string) => {
    const i = found.get(id)
    return i === undefined ? undefined : i < 0 ? 'var(--ink-2)' : INKS[i]!
  }
  const keys = (cells: Cell[] | undefined) => new Set((cells ?? []).map(([r, c]) => cellKey(r, c)))
  const lineSet = keys(line)
  const missSet = keys(miss)
  const foundSet = keys(placements.filter((p) => found.has(p.id)).flatMap((p) => placementCells(p)))
  const stroke = (cells: Cell[]) => {
    const [r0, c0] = cells[0]!
    const [r1, c1] = cells[cells.length - 1]!
    return `M${c0 + 0.5} ${r0 + 0.5}L${c1 + 0.5} ${r1 + 0.5}`
  }
  const newBest = finishedMs !== undefined && !gaveUp && hinted.size === 0 && (bestBefore === undefined || finishedMs < bestBefore)

  return (
    <>
      <GameHeader
        title={TITLE}
        subtitle={`${foundCount} / ${placements.length} words`}
        right={
          <Chip tone={finished ? 'ok' : 'sky'} className="shrink-0 whitespace-nowrap">
            {formatTime(finishedMs ?? elapsed)}
          </Chip>
        }
        onBack={onDone}
      />
      {!finished && <p className="-mt-2 mb-3 text-sm text-muted">Swipe across a word, or tap its first and last letters. {HOW[level]}</p>}

      <div className="card mx-auto p-2" style={{ width: `min(100%, ${size * 40 + 18}px)` }}>
        <div
          ref={gridRef}
          className="relative select-none"
          style={{ touchAction: 'none', WebkitUserSelect: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
            {placements.map((p) =>
              found.has(p.id) ? <path key={p.id} d={stroke(placementCells(p))} stroke={ink(p.id)} strokeOpacity={found.get(p.id)! < 0 ? 0.22 : 0.42} strokeWidth={0.74} strokeLinecap="round" fill="none" /> : null,
            )}
            {miss && <path d={stroke(miss)} stroke="var(--bad)" strokeOpacity={0.3} strokeWidth={0.74} strokeLinecap="round" fill="none" />}
            {line && <path d={stroke(line)} stroke="var(--blue)" strokeOpacity={0.32} strokeWidth={0.8} strokeLinecap="round" fill="none" />}
            {pending && !line && <circle cx={pending[1] + 0.5} cy={pending[0] + 0.5} r={0.4} fill="var(--blue)" fillOpacity={0.28} />}
            {hintCell && !finished && <circle cx={hintCell[1] + 0.5} cy={hintCell[0] + 0.5} r={0.42} fill="none" stroke="var(--sun)" strokeWidth={0.09} className="motion-safe:animate-pulse" />}
          </svg>
          <div className="relative grid" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }} role="group" aria-label={`Letter grid, ${size} by ${size}`}>
            {grid.flatMap((row, r) =>
              row.map((ch, c) => {
                const k = cellKey(r, c)
                const isPending = pending?.[0] === r && pending[1] === c
                const tone = missSet.has(k) ? 'text-[var(--bad)]' : lineSet.has(k) || isPending ? 'text-blue' : 'text-ink'
                return (
                  <button
                    key={k}
                    type="button"
                    data-cell={k}
                    tabIndex={focus[0] === r && focus[1] === c ? 0 : -1}
                    disabled={finished}
                    aria-pressed={isPending}
                    aria-label={`${ch.toUpperCase()}, row ${r + 1}, column ${c + 1}${foundSet.has(k) ? ', in a found word' : ''}`}
                    onFocus={() => setFocus([r, c])}
                    onKeyDown={onKeyDown}
                    // taps and swipes are handled on the grid (pointer events); this is the keyboard and screen-reader path
                    onClick={(e) => e.detail === 0 && tap([r, c])}
                    className={`flex aspect-square min-w-0 items-center justify-center rounded-md font-display uppercase leading-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] disabled:cursor-default ${tone} ${foundSet.has(k) ? 'font-extrabold' : ''}`}
                    style={{ fontSize: `clamp(0.95rem, ${Math.min(6, 58 / size)}vw, 1.45rem)` }}
                    lang={TL}
                  >
                    {ch}
                  </button>
                )
              }),
            )}
          </div>
        </div>
      </div>

      <p className="mt-2 min-h-5 text-center text-sm font-semibold" role="status" aria-live="polite">
        {note && !finished ? <span className={miss ? 'text-[var(--bad)]' : 'text-ink-2'}>{note}</span> : null}
      </p>

      {finished && finishedMs !== undefined && (
        <GameOver happy={!gaveUp} title={gaveUp ? `Found ${foundCount} of ${placements.length}` : ui.games.win} party={!gaveUp} onAgain={onAgain} onDone={onDone}>
          {gaveUp ? 'The rest are marked in grey; they will come back in your reviews.' : `${placements.length} words in ${formatTime(finishedMs)}${hinted.size ? ` with ${hinted.size} hint${hinted.size === 1 ? '' : 's'}.` : '.'}`}
          {newBest ? ' New best time!' : !gaveUp && bestBefore ? ` Best: ${formatTime(bestBefore)}.` : ''}
        </GameOver>
      )}

      <section className="mt-4" aria-label="Clues">
        <h2 className="eyebrow mb-1.5">Find the words for</h2>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
          {placements.map((p) => {
            const v = byId.get(p.id)
            const color = ink(p.id)
            return (
              <li key={p.id} className="flex min-w-0 items-start gap-2 rounded-lg px-1.5 py-1 text-sm" data-clue={p.id}>
                <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border border-line" style={color ? { background: color, borderColor: color } : undefined} />
                <span className="min-w-0 flex-1 leading-snug">
                  <span className={color ? 'text-muted line-through decoration-[1.5px]' : 'font-semibold'} lang="en">
                    {v?.en[0]}
                  </span>
                  {!color && <span className="text-xs text-muted"> ({p.letters.length})</span>}
                  {color && v && (
                    <span className="block font-bold" style={{ color: found.get(p.id)! < 0 ? 'var(--ink-2)' : 'var(--ok)' }}>
                      <TargetText text={v.lemma} />
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {!finished && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="tile py-2.5 text-center" onClick={hint}>
            Hint
          </button>
          <button type="button" className="tile py-2.5 text-center" onClick={giveUp}>
            Show answers
          </button>
        </div>
      )}
    </>
  )
}
