import { useMemo, useRef, useState } from 'react'
import type { WordBankExercise } from '../../engine/types'
import { SpeakerButton } from '../ui/basics'
import { Instruction, Prompt, type ExerciseProps } from './shared'

type Drag = { from: 'pool' | 'answer'; index: number; word: string; x: number; y: number; dx: number; dy: number; moved: boolean; pointerId: number }

/**
 * Build a sentence from tiles. Tap a tile to add or remove it, or drag it: from the
 * pool into the answer (dropping between words inserts it there), within the answer
 * to reorder, or out of the answer to remove it. Works with mouse and touch.
 */
export function WordBank({ exercise, value, onChange, checked }: ExerciseProps<WordBankExercise>) {
  const chosen = Array.isArray(value) ? (value as string[]) : []
  // tiles are identified by index so duplicates work
  const tiles = useMemo(() => exercise.tiles.map((t, i) => ({ t, i })), [exercise.tiles])
  const usedIdx = new Set<number>()
  for (const w of chosen) {
    const t = tiles.find((x) => x.t === w && !usedIdx.has(x.i))
    if (t) usedIdx.add(t.i)
  }
  const [drag, setDrag] = useState<Drag | undefined>()
  const [dropAt, setDropAt] = useState<number | undefined>()
  const answerRef = useRef<HTMLDivElement>(null)
  const chosenRefs = useRef<(HTMLButtonElement | null)[]>([])
  const suppressClick = useRef(false)
  const wide = exercise.kind === 'orderText'

  const add = (i: number) => {
    if (checked || usedIdx.has(i)) return
    onChange([...chosen, tiles[i]!.t])
  }
  const remove = (pos: number) => {
    if (checked) return
    const next = [...chosen]
    next.splice(pos, 1)
    onChange(next.length ? next : undefined)
  }

  /** Insert position in the answer row for a pointer at (x, y), or undefined when outside the answer area. */
  const insertIndex = (x: number, y: number): number | undefined => {
    const box = answerRef.current?.getBoundingClientRect()
    if (!box || x < box.left - 12 || x > box.right + 12 || y < box.top - 24 || y > box.bottom + 24) return undefined
    for (let k = 0; k < chosen.length; k++) {
      const el = chosenRefs.current[k]
      if (!el) continue
      const r = el.getBoundingClientRect()
      const sameRow = y >= r.top - 6 && y <= r.bottom + 6
      if (wide ? y < r.top + r.height / 2 : (sameRow && x < r.left + r.width / 2) || y < r.top - 6) return k
    }
    return chosen.length
  }

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>, from: Drag['from'], index: number, word: string) => {
    if (checked || e.button > 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ from, index, word, x: e.clientX, y: e.clientY, dx: 0, dy: 0, moved: false, pointerId: e.pointerId })
  }
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    const moved = drag.moved || Math.hypot(dx, dy) > 8
    setDrag({ ...drag, dx, dy, moved })
    if (moved) setDropAt(insertIndex(e.clientX, e.clientY))
  }
  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    const d = drag
    setDrag(undefined)
    setDropAt(undefined)
    if (!d.moved) return // a tap: the click handler adds or removes the tile
    suppressClick.current = true
    setTimeout(() => (suppressClick.current = false), 50)
    const at = insertIndex(e.clientX, e.clientY)
    if (d.from === 'pool') {
      if (at === undefined || usedIdx.has(d.index)) return
      const next = [...chosen]
      next.splice(at, 0, d.word)
      onChange(next)
    } else {
      const next = [...chosen]
      next.splice(d.index, 1)
      if (at === undefined) {
        onChange(next.length ? next : undefined)
        return
      }
      next.splice(at > d.index ? at - 1 : at, 0, d.word)
      onChange(next)
    }
  }
  const dragStyle = (from: Drag['from'], index: number): React.CSSProperties | undefined =>
    drag && drag.moved && drag.from === from && drag.index === index ? { transform: `translate(${drag.dx}px, ${drag.dy}px) scale(1.05)`, zIndex: 30, position: 'relative', boxShadow: 'var(--shadow-float)', transition: 'none' } : undefined

  const handlers = (from: Drag['from'], index: number, word: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => onPointerDown(e, from, index, word),
    onPointerMove,
    onPointerUp,
    onPointerCancel: () => {
      setDrag(undefined)
      setDropAt(undefined)
    },
    style: { touchAction: 'none' as const, ...dragStyle(from, index) },
  })

  return (
    <div>
      <Instruction>{exercise.kind === 'orderText' ? 'Put the sentences in order' : exercise.kind === 'order' ? 'Put the words in order' : 'Write this in Spanish'}</Instruction>
      <div className="mb-4 flex items-center gap-3">
        {exercise.kind === 'order' && exercise.answers[0] && <SpeakerButton text={exercise.answers[0]} size="sm" />}
        <Prompt lang={exercise.kind === 'order' ? 'es' : 'en'}>{exercise.kind === 'order' ? exercise.translation ?? '' : exercise.kind === 'orderText' ? exercise.translation ?? exercise.prompt : exercise.prompt}</Prompt>
      </div>
      <div ref={answerRef} className={`mb-4 min-h-[3.5rem] rounded-2xl border-b-2 border-dashed px-1 py-2 transition ${drag?.moved && dropAt !== undefined ? 'border-brand-400 bg-brand-100/40 dark:bg-brand-500/10' : 'border-line'}`} aria-label="Your answer" lang="es">
        <div className="flex flex-wrap gap-2">
          {chosen.map((w, pos) => (
            <span key={pos} className={`flex items-center ${wide ? 'w-full' : ''}`}>
              {drag?.moved && dropAt === pos && <span className="mr-1 h-9 w-1 rounded-full bg-brand-500" aria-hidden="true" />}
              <button
                ref={(el) => {
                  chosenRefs.current[pos] = el
                }}
                type="button"
                onClick={() => !suppressClick.current && remove(pos)}
                className={`tile animate-pop cursor-grab px-3 py-2 active:cursor-grabbing ${wide ? 'w-full text-left' : ''}`}
                disabled={checked}
                {...handlers('answer', pos, w)}
              >
                {w}
              </button>
            </span>
          ))}
          {drag?.moved && dropAt === chosen.length && <span className="h-9 w-1 self-center rounded-full bg-brand-500" aria-hidden="true" />}
        </div>
      </div>
      <div className="flex flex-wrap gap-2" lang="es">
        {tiles.map(({ t, i }) => (
          <button
            key={i}
            type="button"
            onClick={() => !suppressClick.current && add(i)}
            disabled={checked || usedIdx.has(i)}
            className={`tile cursor-grab px-3 py-2 active:cursor-grabbing ${wide ? 'w-full text-left' : ''} ${usedIdx.has(i) ? 'invisible' : ''}`}
            {...handlers('pool', i, t)}
          >
            {t}
          </button>
        ))}
      </div>
      {!checked && <p className="mt-3 text-center text-xs text-muted">Tap or drag the tiles. Drag between words to insert, drag out to remove.</p>}
    </div>
  )
}
