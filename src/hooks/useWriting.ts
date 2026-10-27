/**
 * The writing area's bindings: the scoring kit for this course (engine/writing.ts with the
 * @lang pack and the course dictionary), the saved record per stop (kv `writing:<unitId>`,
 * carried by export/import with every other kv row) and the prompt counts per stop.
 */
import { useEffect, useState } from 'react'
import { vocab, known, units, levelOf, readers, journeyData } from '../engine/loader'
import { getDictionary, checkText } from './useDeps'
import { lookup } from '@lang/inflect'
import { tokenize } from '@lang/tokenize'
import { stripAccents } from '@lang/normalize'
import { languagePack } from '@lang'
import { makeWritingKit, scoreWriting, type WritingKit, type WritingResult } from '../engine/writing'
import type { Unit, WritingPrompt } from '../engine/schema'

let kit: WritingKit | undefined
/** The course's scoring kit, built once (a few thousand lemmas, all their forms). */
export function writingKit(): WritingKit {
  if (!kit) {
    const dict = getDictionary()
    const validateText = (languagePack as { validateText?: (t: string) => string[] }).validateText
    kit = makeWritingKit(
      {
        id: languagePack.id,
        tokenize,
        stripAccents,
        lookup: (form) => lookup(dict, form),
        check: checkText,
        forms: dict.keys(),
        hasReading: validateText ? (c) => validateText(c).length === 0 : undefined,
      },
      { vocab, known: { always: known.always, names: known.names }, extra: [...readers.flatMap((r) => [...r.allow, ...r.glossary.map((g) => g.es)]), ...known.facts, ...journeyNames()] },
    )
  }
  return kit
}

/** The journey's names and lines (regions, stops, their facts, souvenirs): what learners write about (tango, alfajor). */
function journeyNames(): string[] {
  return [...journeyData.regions.flatMap((r) => [r.name, ...r.stops.flatMap((st) => [st.name, st.es, st.fact?.es ?? ''])]), ...journeyData.souvenirs.map((sv) => sv.es)]
}

/** Words the stop's lessons teach. */
export function unitWordIds(unit: Unit): Set<string> {
  return new Set(unit.lessons.flatMap((l) => l.vocab))
}

/** Score a text for a prompt of a stop. */
export function scoreFor(unit: Unit, prompt: WritingPrompt, text: string, seenModel = false): WritingResult {
  return scoreWriting(text, prompt, writingKit(), { level: levelOf(unit.id), unitWords: unitWordIds(unit), seenModel })
}

// ---------------------------------------------------------------------------
// Saved progress

export interface WritingPromptRecord {
  /** The text in the box (saved as the learner types). */
  draft: string
  /** Best overall score and its text. */
  best?: number
  bestStars?: number
  bestText?: string
  /** Last checked score. */
  last?: number
  checks: number
  /** First reached WRITING_PASS (coins paid). */
  passed?: boolean
  /** Three stars reached once (bonus paid). */
  starred?: boolean
  seenModel?: boolean
  date?: string
}
export interface WritingRecord {
  /** Keyed by the prompt's index in the unit. */
  prompts: Record<string, WritingPromptRecord>
  /** The set's completion bonus has been paid. */
  setBonus?: boolean
}
export const writingKey = (unitId: string) => `writing:${unitId}`

/** Prompts done (best ≥ pass) and the average best score of the prompts written so far. */
export function writingSummary(record: WritingRecord | undefined, count: number, pass: number): { done: number; best?: number } {
  if (!record || !count) return { done: 0 }
  const rows = Array.from({ length: count }, (_, i) => record.prompts[String(i)])
  const scored = rows.filter((r) => r?.best !== undefined)
  return {
    done: rows.filter((r) => (r?.best ?? 0) >= pass).length,
    best: scored.length ? Math.round(scored.reduce((n, r) => n + r!.best!, 0) / scored.length) : undefined,
  }
}

export interface WritingStop {
  prompts: number
  lessons: number
}
/** The authored stops that have writing prompts: how many, and how many lessons lead to them (unit files are cached by the loader). */
export function useWritingStops(): Map<string, WritingStop> | undefined {
  const [stops, setStops] = useState<Map<string, WritingStop>>()
  useEffect(() => {
    let alive = true
    ;(async () => {
      // the course outline (counts only), not every unit file
      const { unitOutlines } = await import('../engine/lessonIndex')
      const m = new Map<string, WritingStop>()
      for (const u of units.values()) {
        const o = u.authored ? unitOutlines.get(u.id) : undefined
        if (o?.writing) m.set(u.id, { prompts: o.writing, lessons: o.lessons.length })
      }
      if (alive) setStops(m)
    })()
    return () => {
      alive = false
    }
  }, [])
  return stops
}
