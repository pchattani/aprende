/**
 * hanzi-writer hooks: theme colours from the CSS variables, the course's bundled stroke data
 * (engine/strokes.ts) and a writer instance bound to an element.
 */
import { useEffect, useRef, useState, type RefObject } from 'react'
import HanziWriter, { type HanziWriterOptions } from 'hanzi-writer'
import { charDataLoader, strokeData, type StrokeData } from '../../engine/strokes'

export interface Ink {
  stroke: string
  outline: string
  drawing: string
  highlight: string
  radical: string
}

function readInk(): Ink {
  const cs = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : undefined
  const v = (name: string, fallback: string) => cs?.getPropertyValue(name).trim() || fallback
  return { stroke: v('--ink', '#1c2541'), outline: v('--line-strong', '#cfc8b6'), drawing: v('--blue', '#2f5bd3'), highlight: v('--sun', '#e9a92e'), radical: v('--red', '#d9473b') }
}

/** Theme colours for hanzi-writer, updated when the theme (data-theme or the system scheme) changes. */
export function useInk(): Ink {
  const [ink, setInk] = useState(readInk)
  useEffect(() => {
    const update = () => setInk((old) => {
      const next = readInk()
      return JSON.stringify(old) === JSON.stringify(next) ? old : next
    })
    const mo = new MutationObserver(update)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : undefined
    mq?.addEventListener?.('change', update)
    return () => {
      mo.disconnect()
      mq?.removeEventListener?.('change', update)
    }
  }, [])
  return ink
}

/** Stroke data of a character: undefined while loading, null when the course has none for it. */
export function useStrokeData(char: string): StrokeData | null | undefined {
  const [data, setData] = useState<{ char: string; d: StrokeData | null }>()
  useEffect(() => {
    let alive = true
    void strokeData(char).then((d) => alive && setData({ char, d: d ?? null }))
    return () => {
      alive = false
    }
  }, [char])
  return data?.char === char ? data.d : undefined
}

/**
 * A hanzi-writer instance in `ref`'s element, rebuilt when the character, size, options key or theme change.
 * hanzi-writer has no destroy(): the writer draws into a child element that is removed on cleanup.
 */
export function useHanziWriter(ref: RefObject<HTMLDivElement | null>, char: string, size: number, options: Partial<HanziWriterOptions>, key: string): HanziWriter | undefined {
  const ink = useInk()
  const [writer, setWriter] = useState<HanziWriter>()
  const opts = useRef(options)
  useEffect(() => {
    opts.current = options
  })
  useEffect(() => {
    const host = ref.current
    if (!host) return
    const el = document.createElement('div')
    host.appendChild(el)
    const w = HanziWriter.create(el, char, {
      width: size,
      height: size,
      padding: Math.round(size * 0.06),
      charDataLoader,
      strokeColor: ink.stroke,
      outlineColor: ink.outline,
      drawingColor: ink.drawing,
      highlightColor: ink.highlight,
      drawingWidth: Math.max(4, Math.round(size / 28)),
      ...opts.current,
    })
    setWriter(w)
    return () => {
      w.cancelQuiz()
      void w.pauseAnimation()
      el.remove()
      setWriter(undefined)
    }
  }, [ref, char, size, key, ink])
  return writer
}
