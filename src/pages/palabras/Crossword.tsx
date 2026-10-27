/**
 * Crucigrama: a small crossword from the learner's words. Clues are English glosses,
 * answers the target-language words (accents optional) or, for Cantonese, Jyutping
 * without tones. A hidden input under the active square brings up the phone keyboard.
 */
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { languagePack } from '@lang'
import type { VocabEntry } from '../../engine/schema'
import { generateCrossword, cellsOf, type Crossword as CW, type CrosswordEntry, type Dir } from '../../engine/crossword'
import { crosswordLetters } from '../../engine/vocabGame'
import { recordAnswer } from '../../db/progress'
import { playSound } from '../../engine/sounds'
import { ui } from '../../engine/loader'
import { TL } from '../../engine/course'
import { PageHeader, Chip } from '../../components/ui/basics'
import { Confetti } from '../../components/ui/Confetti'
import { Leo } from '../../components/ui/Dogs'
import { calmMotion } from '../../components/game/motion'
import { TargetText } from '../../components/ui/TargetText'
import { TooFew, RoundButtons } from './shared'
import { addMinutes, updateBest, formatTime, e2eHook } from './util'

const JYUTPING = languagePack.id === 'yue'
/** Accent- (or tone-) insensitive letter comparison. */
const fold = (ch: string) => languagePack.stripMarks(ch.toLowerCase())
const K = (r: number, c: number) => `${r},${c}`
const other = (d: Dir): Dir => (d === 'across' ? 'down' : 'across')
/** Keeps something in the hidden input so phone keyboards always send a backspace. */
const SENTINEL = '​'

export function Crossword({ words, onDone, onAgain, best }: { words: VocabEntry[]; onDone: () => void; onAgain: () => void; best?: number }) {
  const [seed] = useState(() => Date.now() >>> 0)
  const cw = useMemo(
    () =>
      generateCrossword(
        words.flatMap((v) => {
          const letters = crosswordLetters(v, languagePack.normalize)
          return letters ? [{ id: v.id, letters, clue: v.en[0]! }] : []
        }),
        seed,
      ),
    [words, seed],
  )
  const byId = useMemo(() => new Map(words.map((v) => [v.id, v])), [words])
  if (cw.entries.length < 4) return <TooFew onBack={onDone} game="crossword">The crossword needs a few more words that fit a grid.</TooFew>
  return <Board cw={cw} byId={byId} onDone={onDone} onAgain={onAgain} best={best} />
}

// ---------------------------------------------------------------------------- state

interface S {
  cw: CW
  /** cell → index of the across / down entry through it */
  at: Map<string, Partial<Record<Dir, number>>>
  fills: Record<string, string>
  revealed: Set<string>
  wrong: Set<string>
  /** Entries that had a wrong letter when the learner pressed Check. */
  flagged: Set<string>
  r: number
  c: number
  dir: Dir
  /** Result of the last Check, until the next change. */
  checked?: { wrong: number; empty: number }
  /** The last word accepted without its accents, shown with them for a moment. */
  accented?: string
}
type A =
  | { t: 'letter'; ch: string }
  | { t: 'back' }
  | { t: 'move'; dr: number; dc: number }
  | { t: 'cell'; r: number; c: number }
  | { t: 'entry'; i: number }
  | { t: 'step'; delta: number }
  | { t: 'check' }
  | { t: 'reveal' }
  /** A word typed without its accents was accepted: write the accented letters into its squares. */
  | { t: 'settle'; keys: string[]; word?: string }
  | { t: 'unnote' }

function init(cw: CW): S {
  const at = new Map<string, Partial<Record<Dir, number>>>()
  cw.entries.forEach((e, i) => cellsOf(e).forEach(([r, c]) => at.set(K(r, c), { ...at.get(K(r, c)), [e.dir]: i })))
  const first = cw.entries[0]!
  return { cw, at, fills: {}, revealed: new Set(), wrong: new Set(), flagged: new Set(), r: first.row, c: first.col, dir: first.dir }
}

const solutionAt = (s: S, k: string) => {
  const [r, c] = k.split(',').map(Number) as [number, number]
  return s.cw.grid[r]![c]!
}
const isSolved = (s: Pick<S, 'fills'>, e: CrosswordEntry) => cellsOf(e).every(([r, c], i) => s.fills[K(r, c)] !== undefined && fold(s.fills[K(r, c)]!) === fold(e.letters[i]!))
const entryIndex = (s: S, r = s.r, c = s.c, dir = s.dir) => s.at.get(K(r, c))?.[dir] ?? s.at.get(K(r, c))?.[other(dir)] ?? 0
/** A square is locked once revealed or part of a solved word. */
const locked = (s: S, k: string) => s.revealed.has(k) || Object.values(s.at.get(k) ?? {}).some((i) => isSolved(s, s.cw.entries[i]!))
const allSolved = (s: S) => s.cw.entries.every((e) => isSolved(s, e))

/** Point the cursor at a square, keeping the direction when a word runs that way through it. */
function go(s: S, r: number, c: number, dir = s.dir): S {
  const there = s.at.get(K(r, c))
  if (!there) return s
  return { ...s, r, c, dir: there[dir] !== undefined ? dir : other(dir) }
}

/**
 * Where typing starts in a word: its first empty square, or its first square when only
 * locked squares come before that (typing the whole word then runs through them).
 */
function startOf(s: S, i: number): S {
  const e = s.cw.entries[i]!
  const cells = cellsOf(e)
  const gap = cells.findIndex(([r, c]) => !s.fills[K(r, c)])
  const at = gap <= 0 || cells.slice(0, gap).every(([r, c]) => locked(s, K(r, c))) ? 0 : gap
  const [r, c] = cells[at]!
  return { ...s, r, c, dir: e.dir }
}

/**
 * After a letter: the next square of this word. At the end of the word, its first
 * empty square, or (once full) the next word that still has one.
 */
function advance(s: S): S {
  const i = entryIndex(s)
  const cells = cellsOf(s.cw.entries[i]!)
  const pos = cells.findIndex(([r, c]) => r === s.r && c === s.c)
  const empty = ([r, c]: [number, number]) => !s.fills[K(r, c)]
  const to = ([r, c]: [number, number]): S => ({ ...s, r, c })
  if (pos < cells.length - 1) return to(cells[pos + 1]!)
  const gap = cells.find(empty)
  if (gap) return to(gap)
  const n = s.cw.entries.length
  for (let d = 1; d < n; d++) {
    const j = (i + d) % n
    if (cellsOf(s.cw.entries[j]!).some(empty)) return startOf(s, j)
  }
  return s
}

/** Type a letter: a locked square (solved crossing or revealed) takes its own letter as typed-through, otherwise the letter goes in the next open square. */
function typeLetter(s: S, ch: string): S {
  const cells = cellsOf(s.cw.entries[entryIndex(s)]!)
  let pos = cells.findIndex(([r, c]) => r === s.r && c === s.c)
  if (locked(s, K(s.r, s.c))) {
    if (fold(ch) === fold(solutionAt(s, K(s.r, s.c)))) return advance(s)
    while (pos < cells.length && locked(s, K(...cells[pos]!))) pos++
    if (pos >= cells.length) return s
  }
  const [r, c] = cells[pos]!
  const k = K(r, c)
  const wrong = new Set(s.wrong)
  wrong.delete(k)
  return advance({ ...s, r, c, fills: { ...s.fills, [k]: ch.toLowerCase() }, wrong, checked: undefined })
}

function reducer(s: S, a: A): S {
  const done = allSolved(s)
  const k = K(s.r, s.c)
  switch (a.t) {
    case 'letter': {
      if (done || !/^\p{L}$/u.test(a.ch)) return s
      return typeLetter(s, a.ch)
    }
    case 'back': {
      if (done) return s
      const clear = (st: S, key: string): S => {
        if (locked(st, key) || !st.fills[key]) return st
        const fills = { ...st.fills }
        delete fills[key]
        const wrong = new Set(st.wrong)
        wrong.delete(key)
        return { ...st, fills, wrong, checked: undefined }
      }
      if (s.fills[k] && !locked(s, k)) return clear(s, k)
      const cells = cellsOf(s.cw.entries[entryIndex(s)]!)
      const pos = cells.findIndex(([r, c]) => r === s.r && c === s.c)
      if (pos <= 0) return s
      const [r, c] = cells[pos - 1]!
      return clear({ ...s, r, c }, K(r, c))
    }
    case 'move': {
      const dir: Dir = a.dc ? 'across' : 'down'
      for (let r = s.r + a.dr, c = s.c + a.dc; r >= 0 && c >= 0 && r < s.cw.height && c < s.cw.width; r += a.dr, c += a.dc) {
        if (s.at.has(K(r, c))) return go(s, r, c, dir)
      }
      return go(s, s.r, s.c, dir)
    }
    case 'cell': {
      if (a.r === s.r && a.c === s.c) {
        const there = s.at.get(k)!
        return there[other(s.dir)] !== undefined ? { ...s, dir: other(s.dir) } : s
      }
      return go(s, a.r, a.c)
    }
    case 'entry':
      return startOf(s, a.i)
    case 'step': {
      const n = s.cw.entries.length
      return startOf(s, (entryIndex(s) + a.delta + n) % n)
    }
    case 'check': {
      if (done) return s
      const wrong = new Set<string>()
      let empty = 0
      for (const key of s.at.keys()) {
        const f = s.fills[key]
        if (!f) empty++
        else if (fold(f) !== fold(solutionAt(s, key))) wrong.add(key)
      }
      const flagged = new Set(s.flagged)
      for (const key of wrong) for (const i of Object.values(s.at.get(key)!)) flagged.add(s.cw.entries[i]!.id)
      return { ...s, wrong, flagged, checked: { wrong: wrong.size, empty } }
    }
    case 'settle': {
      const fills = { ...s.fills }
      for (const key of a.keys) fills[key] = solutionAt(s, key)
      return { ...s, fills, accented: a.word ?? s.accented }
    }
    case 'unnote':
      return { ...s, accented: undefined }
    case 'reveal': {
      if (done) return s
      const right = s.fills[k] !== undefined && fold(s.fills[k]) === fold(solutionAt(s, k))
      if (locked(s, k) || right) return advance(s)
      const revealed = new Set(s.revealed)
      revealed.add(k)
      const wrong = new Set(s.wrong)
      wrong.delete(k)
      return advance({ ...s, fills: { ...s.fills, [k]: solutionAt(s, k) }, revealed, wrong, checked: undefined })
    }
  }
}

// ---------------------------------------------------------------------------- board

function Board({ cw, byId, onDone, onAgain, best }: { cw: CW; byId: Map<string, VocabEntry>; onDone: () => void; onAgain: () => void; best?: number }) {
  const [s, dispatch] = useReducer(reducer, cw, init)
  const [startedAt] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [finishedMs, setFinishedMs] = useState<number | undefined>()
  const recorded = useRef(new Set<string>())
  const input = useRef<HTMLInputElement>(null)
  const comp = useRef('')
  const bar = useRef<HTMLDivElement>(null)

  const solved = useMemo(() => new Set(cw.entries.filter((e) => isSolved(s, e)).map((e) => e.id)), [cw, s])
  const finished = solved.size === cw.entries.length
  const finishing = useRef(false)
  const active = cw.entries[entryIndex(s)]!
  const activeCells = new Set(cellsOf(active).map(([r, c]) => K(r, c)))

  useEffect(() => {
    e2eHook('crossword', cw.entries.map((e) => ({ number: e.number, dir: e.dir, row: e.row, col: e.col, answer: e.letters.join('') })))
  }, [cw])

  useEffect(() => {
    if (finished) return
    const t = setInterval(() => setElapsed(Date.now() - startedAt), 500)
    return () => clearInterval(t)
  }, [startedAt, finished])

  useEffect(() => {
    if (!s.accented) return
    const t = setTimeout(() => dispatch({ t: 'unnote' }), 4000)
    return () => clearTimeout(t)
  }, [s.accented])

  // record each word once, when it is first solved; finish when all are
  useEffect(() => {
    let fresh = 0
    for (const e of cw.entries) {
      if (!solved.has(e.id) || recorded.current.has(e.id)) continue
      recorded.current.add(e.id)
      fresh++
      const shown = cellsOf(e).filter(([r, c]) => s.revealed.has(K(r, c))).length
      const verdict = shown * 2 >= e.letters.length ? 'wrong' : shown || s.flagged.has(e.id) ? 'almost' : 'correct'
      void recordAnswer(e.id, verdict, 'typeEs')
      // accents are optional while typing; once the word is accepted its squares take the accented letters
      const plain = cellsOf(e).map(([r, c]) => K(r, c)).filter((key, i) => s.fills[key] !== e.letters[i])
      if (plain.length) dispatch({ t: 'settle', keys: plain, word: JYUTPING ? undefined : e.letters.join('') })
    }
    if (finished && !finishing.current) {
      finishing.current = true
      const ms = Date.now() - startedAt
      input.current?.blur()
      playSound('finish')
      const clean = s.revealed.size === 0
      void (async () => {
        setFinishedMs(ms)
        await updateBest((b) => ({ ...b, crosswords: (b.crosswords ?? 0) + 1, crosswordMs: clean ? Math.min(b.crosswordMs ?? Infinity, ms) : b.crosswordMs }))
        await addMinutes(ms)
      })()
    } else if (fresh) playSound('correct')
  }, [solved]) // eslint-disable-line react-hooks/exhaustive-deps

  // phone keyboards: letters arrive as beforeinput / composition input events on the hidden field
  useEffect(() => {
    const el = input.current
    if (!el) return
    const reset = () => {
      el.value = SENTINEL
      el.setSelectionRange(1, 1)
    }
    const onBefore = (e: InputEvent) => {
      if (e.inputType.startsWith('delete') && !e.isComposing) {
        e.preventDefault()
        dispatch({ t: 'back' })
      } else if ((e.inputType === 'insertText' || e.inputType === 'insertReplacementText') && e.data && !e.isComposing) {
        e.preventDefault()
        for (const ch of e.data) dispatch({ t: 'letter', ch })
      }
    }
    const onInput = (e: Event) => {
      const ie = e as InputEvent
      if (ie.inputType === 'insertCompositionText' || ie.inputType === 'deleteCompositionText') {
        const d = ie.data ?? ''
        const prev = comp.current
        if (d.length > prev.length && d.startsWith(prev)) for (const ch of d.slice(prev.length)) dispatch({ t: 'letter', ch })
        else if (d.length < prev.length) for (let i = 0; i < prev.length - d.length; i++) dispatch({ t: 'back' })
        else if (d && d !== prev) dispatch({ t: 'letter', ch: [...d].pop()! })
        comp.current = d
        return
      }
      // anything else that reached the field (paste, autofill, a committed composition)
      const v = el.value.replaceAll(SENTINEL, '')
      const fresh = ie.inputType === 'insertFromComposition' && v.startsWith(comp.current) ? v.slice(comp.current.length) : v
      for (const ch of fresh) dispatch({ t: 'letter', ch })
      comp.current = ''
      reset()
    }
    const onEnd = () => {
      comp.current = ''
      reset()
    }
    el.addEventListener('beforeinput', onBefore)
    el.addEventListener('input', onInput)
    el.addEventListener('compositionend', onEnd)
    reset()
    return () => {
      el.removeEventListener('beforeinput', onBefore)
      el.removeEventListener('input', onInput)
      el.removeEventListener('compositionend', onEnd)
    }
  }, [])

  /** Keep the hidden input focused (and the phone keyboard up) while tapping squares, clues and buttons. */
  const keep = (e: React.MouseEvent) => {
    if (document.activeElement === input.current) e.preventDefault()
  }
  const focus = () => {
    if (finished) return
    input.current?.focus({ preventScroll: true })
  }
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const moves: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }
    if (moves[e.key]) {
      e.preventDefault()
      dispatch({ t: 'move', dr: moves[e.key]![0], dc: moves[e.key]![1] })
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      dispatch({ t: 'back' })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      dispatch({ t: 'step', delta: e.shiftKey ? -1 : 1 })
    } else if (e.key.length === 1 && /^\p{L}$/u.test(e.key)) {
      e.preventDefault()
      dispatch({ t: 'letter', ch: e.key })
    }
  }

  const across = cw.entries.map((e, i) => ({ e, i })).filter((x) => x.e.dir === 'across')
  const down = cw.entries.map((e, i) => ({ e, i })).filter((x) => x.e.dir === 'down')
  const shownAnywhere = s.revealed.size > 0
  const newBest = finishedMs !== undefined && !shownAnywhere && (best === undefined || finishedMs < best)

  return (
    <div className="animate-rise pb-6">
      <PageHeader title={ui.games.crossword} subtitle={`${solved.size} / ${cw.entries.length} words`} right={<Chip tone={finished ? 'ok' : 'sky'} className="shrink-0 whitespace-nowrap">{formatTime(finishedMs ?? elapsed)}</Chip>} />
      {finished && <Confetti />}

      {!finished && (
        <div ref={bar} className="mb-3 flex scroll-mt-3 items-stretch gap-1.5">
          <button type="button" onMouseDown={keep} onClick={() => (dispatch({ t: 'step', delta: -1 }), focus())} className="tile flex w-10 shrink-0 items-center justify-center px-0 py-0 text-xl" aria-label="Previous clue">
            ‹
          </button>
          <button
            type="button"
            onMouseDown={keep}
            onClick={focus}
            className="min-w-0 flex-1 rounded-xl border-[1.5px] border-blue bg-[color-mix(in_srgb,var(--blue)_10%,var(--card))] px-3 py-2 text-left"
            aria-label={`Clue ${active.number} ${active.dir}: ${active.clue}. Tap to type.`}
          >
            <span className="block text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-blue">
              {active.number} {active.dir === 'across' ? 'Across' : 'Down'} · {active.letters.length} letters
            </span>
            <span className="block truncate font-semibold leading-snug" lang="en">
              {active.clue}
            </span>
          </button>
          <button type="button" onMouseDown={keep} onClick={() => (dispatch({ t: 'step', delta: 1 }), focus())} className="tile flex w-10 shrink-0 items-center justify-center px-0 py-0 text-xl" aria-label="Next clue">
            ›
          </button>
        </div>
      )}

      <div className="relative mx-auto" style={{ width: `min(100%, ${cw.width * 42}px)` }}>
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cw.width}, minmax(0, 1fr))` }} role="group" aria-label="Crossword grid">
          {cw.grid.flatMap((row, r) =>
            row.map((sol, c) => {
              const k = K(r, c)
              if (sol === null) return <div key={k} className="aspect-square" aria-hidden="true" />
              const isCursor = !finished && s.r === r && s.c === c
              const inWord = !finished && activeCells.has(k)
              const ids = Object.values(s.at.get(k)!).map((i) => cw.entries[i]!.id)
              const good = finished || ids.some((id) => solved.has(id))
              const bad = s.wrong.has(k)
              const num = cw.entries.find((e) => e.row === r && e.col === c)?.number
              const shown = good ? sol : s.fills[k]
              const tone = isCursor
                ? 'border-blue bg-[color-mix(in_srgb,var(--blue)_30%,var(--card))] shadow-[0_2px_0_0_var(--blue)]'
                : bad
                  ? 'border-[var(--bad)] bg-[color-mix(in_srgb,var(--bad)_12%,var(--card))] text-[var(--bad)] shadow-[0_2px_0_0_var(--bad)]'
                  : good
                    ? 'border-[color-mix(in_srgb,var(--ok)_55%,var(--line))] bg-[color-mix(in_srgb,var(--ok)_14%,var(--card))] text-[var(--ok)] shadow-[0_2px_0_0_color-mix(in_srgb,var(--ok)_55%,var(--line))]'
                    : inWord
                      ? 'border-[color-mix(in_srgb,var(--blue)_45%,var(--line))] bg-[color-mix(in_srgb,var(--blue)_11%,var(--card))] shadow-[0_2px_0_0_color-mix(in_srgb,var(--blue)_45%,var(--line))]'
                      : 'border-line bg-surface shadow-[0_2px_0_0_var(--line-strong)]'
              return (
                <button
                  key={k}
                  type="button"
                  disabled={finished}
                  onMouseDown={keep}
                  onClick={() => {
                    dispatch({ t: 'cell', r, c })
                    focus()
                  }}
                  data-cell={k}
                  aria-label={`${num ? `${num}, ` : ''}row ${r + 1}, column ${c + 1}${shown ? `: ${shown}` : ', empty'}`}
                  className={`relative flex aspect-square min-w-0 items-center justify-center rounded-[7px] border-[1.5px] font-display uppercase leading-none transition-colors duration-100 select-none ${tone}`}
                  style={{ fontSize: `clamp(0.85rem, ${Math.min(5.2, 52 / cw.width)}vw, 1.35rem)` }}
                  lang={TL}
                >
                  {num !== undefined && <span className="absolute left-[3px] top-[2px] font-sans text-[9px] font-extrabold normal-case leading-none text-muted">{num}</span>}
                  {s.revealed.has(k) && !good && <span aria-hidden="true" className="absolute right-[2px] top-[2px] h-1.5 w-1.5 rounded-full bg-[var(--sun)]" />}
                  {shown}
                </button>
              )
            }),
          )}
        </div>
        <input
          ref={input}
          type="text"
          aria-label="Type a letter"
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          lang={TL}
          onKeyDown={onKeyDown}
          className="pointer-events-none absolute opacity-0"
          style={{ top: `${(s.r / cw.height) * 100}%`, left: `${(s.c / cw.width) * 100}%`, width: `${100 / cw.width}%`, height: `${100 / cw.height}%`, fontSize: 16, caretColor: 'transparent' }}
        />
      </div>

      {!finished && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" className="tile py-2.5 text-center" onMouseDown={keep} onClick={() => (dispatch({ t: 'check' }), focus())}>
              Check
            </button>
            <button type="button" className="tile py-2.5 text-center" onMouseDown={keep} onClick={() => (dispatch({ t: 'reveal' }), focus())}>
              Reveal letter
            </button>
          </div>
          <p className="mt-2 min-h-5 text-center text-sm font-semibold" role="status" aria-live="polite">
            {s.accented && !s.checked ? (
              <span className="text-[var(--ok)]" lang={TL}>
                Accents added: <span className="font-display">{s.accented}</span>
              </span>
            ) : s.checked ? (
              s.checked.wrong ? (
                <span className="text-[var(--bad)]">{s.checked.wrong === 1 ? '1 letter to fix' : `${s.checked.wrong} letters to fix`}</span>
              ) : s.checked.empty ? (
                <span className="text-[var(--ok)]">All correct so far!</span>
              ) : null
            ) : (
              <span className="text-xs font-medium text-muted">{JYUTPING ? 'Answers in Jyutping, without tone numbers (nei5 hou2 → neihou).' : 'Accents are optional: type e for é.'}</span>
            )}
          </p>
        </>
      )}

      {finished && (
        <div className="card mt-4 text-center">
          <div className="mx-auto -mt-1 w-fit">
            <Leo size={88} act="cheer" />
          </div>
          <p className="text-2xl font-semibold" lang={TL}>
            {ui.games.win}
          </p>
          <p className="text-sm text-muted">
            {cw.entries.length} words in {formatTime(finishedMs ?? elapsed)}
            {shownAnywhere ? ` with ${s.revealed.size} letter${s.revealed.size === 1 ? '' : 's'} revealed.` : '.'}
            {newBest ? ' New best time!' : best ? ` Best: ${formatTime(best)}.` : ''}
          </p>
          <RoundButtons onAgain={onAgain} onDone={onDone} />
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {(
          [
            ['Across', across],
            ['Down', down],
          ] as const
        ).map(([title, list]) =>
          list.length ? (
            <section key={title} aria-label={`${title} clues`}>
              <h2 className="eyebrow mb-1.5">{title}</h2>
              <ol className="grid gap-1">
                {list.map(({ e, i }) => {
                  const isActive = !finished && e === active
                  const ok = solved.has(e.id)
                  const v = byId.get(e.id)
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        disabled={finished}
                        onMouseDown={keep}
                        onClick={() => {
                          dispatch({ t: 'entry', i })
                          focus()
                          // the list sits under the grid: bring the clue bar and grid back into view
                          if ((bar.current?.getBoundingClientRect().top ?? 0) < 0 || (bar.current?.getBoundingClientRect().top ?? 0) > window.innerHeight * 0.4) bar.current?.scrollIntoView({ block: 'start', behavior: calmMotion() ? 'auto' : 'smooth' })
                        }}
                        className={`flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${isActive ? 'bg-[color-mix(in_srgb,var(--blue)_12%,var(--card))]' : ''}`}
                        aria-current={isActive ? 'true' : undefined}
                      >
                        <span className={`w-5 shrink-0 text-right font-extrabold ${isActive ? 'text-blue' : 'text-muted'}`}>{e.number}</span>
                        <span className={`min-w-0 flex-1 ${ok ? 'text-muted line-through decoration-[1.5px]' : 'font-semibold'}`} lang="en">
                          {e.clue}
                        </span>
                        {ok && v && <TargetText text={v.lemma} className="shrink-0 font-bold text-[var(--ok)] no-underline" />}
                      </button>
                    </li>
                  )
                })}
              </ol>
            </section>
          ) : null,
        )}
      </div>

      {!finished && (
        <button type="button" className="btn btn-ghost mt-5 w-full" onClick={onDone}>
          Quit
        </button>
      )}
    </div>
  )
}
