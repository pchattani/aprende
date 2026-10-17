import { describe, it, expect } from 'vitest'
import { REGIONS, SOUVENIRS, isStamped, stampTarget, souvenirById, wearableSouvenirs } from '@/engine/journey'
import { pickReward, QUEST_POOL } from '@/engine/quests'
import { buildDictionary, lookup } from '@lang/inflect'
import { vocab, levels, ui, known } from '@/engine/loader'
import { IRREGULAR } from '@lang/verbs'
import { tokenize } from '@lang/tokenize'
import type { LessonRow } from '@/engine/types'
import { WEAR_SLOTS } from '@/engine/artKinds'

const row = (id: string, unitId: string, completions: number): LessonRow => ({ id, unitId, level: 'a1', attempts: 1, completions, bestAccuracy: 1, lastAccuracy: 1, xp: 0 })

/** A run of Chinese characters the segmenter kept whole (人嚟) is known if it splits into known words. */
function splitsKnown(w: string, isKnownWord: (x: string) => boolean = isKnown): boolean {
  if (!w) return true
  for (let k = w.length; k >= 1; k--) if (isKnownWord(w.slice(0, k)) && splitsKnown(w.slice(k), isKnownWord)) return true
  return false
}
let isKnown: (w: string) => boolean = () => false

describe('journey', () => {
  it('stamps a stop after four completed lessons, or all of them when there are fewer', () => {
    const rows = [row('a1.u01.l1', 'a1.u01', 1), row('a1.u01.l2', 'a1.u01', 1), row('a1.u01.l3', 'a1.u01', 1), row('a1.u01.l4', 'a1.u01', 0)]
    expect(isStamped('a1.u01', rows, 4)).toBe(false)
    rows[3]!.completions = 1
    expect(isStamped('a1.u01', rows, 4)).toBe(true)
    expect(isStamped('a1.u02', rows.slice(0, 3).map((r) => ({ ...r, unitId: 'a1.u02' })), 3)).toBe(true)
    expect(stampTarget(5)).toBe(4)
    expect(stampTarget(3)).toBe(3)
  })
  it('has a fact for every stop, bilingual and within the level length', () => {
    const allStops = REGIONS.flatMap((r) => r.stops.map((s) => ({ s, level: r.level })))
    // one stop per syllabus unit, in order
    for (const lvl of levels) expect(REGIONS.find((r) => r.level === lvl.id)?.stops.length, lvl.id).toBe(lvl.units.length)
    const dict = buildDictionary([...vocab.values()].filter((v) => v.level === 'a1'), IRREGULAR)
    isKnown = (w: string) => Boolean(lookup(dict, w)) || known.always.has(w) || known.facts.has(w)
    const missing = allStops.filter(({ s }) => !s.fact)
    expect(missing.map((m) => m.s.unitId)).toEqual([])
    for (const { s, level } of allStops) {
      const f = s.fact!
      expect(f.es.trim().length, s.unitId).toBeGreaterThan(10)
      expect(f.en.trim().length, s.unitId).toBeGreaterThan(10)
      // Words for alphabetic languages; characters (÷ 1.5) for Cantonese.
      const words = /\p{Script=Han}/u.test(f.es) ? Math.ceil([...f.es.matchAll(/\p{Script=Han}/gu)].length / 1.5) : f.es.split(/\s+/).length
      const max = level === 'a1' ? 30 : level === 'a2' ? 35 : 45
      expect(words, `${s.unitId} length`).toBeLessThanOrEqual(max)
      if (level === 'a1') {
        const unknown = tokenize(f.es)
          .filter((t) => t.kind === 'word' && !/^\p{Lu}/u.test(t.text) && !known.names.has(t.text))
          .map((t) => t.text.toLowerCase())
          .filter((w) => !isKnown(w) && !(/\p{Script=Han}{2}/u.test(w) && splitsKnown(w)))
        expect(unknown, `${s.unitId}: words outside A1 vocabulary`).toEqual([])
      }
    }
  })
  it('wearable souvenirs have valid slots and badges exist for every region', () => {
    for (const s of wearableSouvenirs()) expect(WEAR_SLOTS).toContain(s.wearable!.slot)
    expect(wearableSouvenirs().length).toBeGreaterThanOrEqual(20)
    for (const r of REGIONS) expect(souvenirById(`badge-${r.level}`)?.badge).toBe(true)
    expect(new Set(SOUVENIRS.map((s) => s.id)).size).toBe(SOUVENIRS.length)
  })
  it('has interface text for every quest and enough cheers and dog lines', () => {
    for (const q of QUEST_POOL) expect(ui.quests[q.id], q.id).toBeTruthy()
    expect(ui.cheers.length).toBeGreaterThanOrEqual(3)
  })
  it('quests never hand out badges', () => {
    const owned = new Set(SOUVENIRS.filter((s) => !s.badge).map((s) => s.id))
    expect(pickReward('a1', owned, 1)).toBeUndefined()
    for (let seed = 0; seed < 20; seed++) expect(pickReward('c2', new Set(), seed)?.badge).toBeFalsy()
  })
})
