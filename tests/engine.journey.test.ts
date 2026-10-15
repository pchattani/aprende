import { describe, it, expect } from 'vitest'
import { REGIONS, SOUVENIRS, isStamped, stampTarget, souvenirById, wearableSouvenirs } from '@/engine/journey'
import { STOP_FACTS } from '@/engine/journey-facts'
import { pickReward } from '@/engine/quests'
import { buildDictionary, lookup } from '@/lang/es/inflect'
import { vocab } from '@/engine/loader'
import { IRREGULAR } from '@/lang/es/verbs'
import { tokenize } from '@/lang/es/tokenize'
import type { LessonRow } from '@/engine/types'

const row = (id: string, unitId: string, completions: number): LessonRow => ({ id, unitId, level: 'a1', attempts: 1, completions, bestAccuracy: 1, lastAccuracy: 1, xp: 0 })

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
    expect(allStops.length).toBe(66)
    const dict = buildDictionary([...vocab.values()].filter((v) => v.level === 'a1'), IRREGULAR)
    const missing = allStops.filter(({ s }) => !STOP_FACTS[s.unitId])
    expect(missing.map((m) => m.s.unitId)).toEqual([])
    for (const { s, level } of allStops) {
      const f = STOP_FACTS[s.unitId]!
      expect(f.es.trim().length, s.unitId).toBeGreaterThan(10)
      expect(f.en.trim().length, s.unitId).toBeGreaterThan(10)
      const words = f.es.split(/\s+/).length
      const max = level === 'a1' ? 30 : level === 'a2' ? 35 : 45
      expect(words, `${s.unitId} length`).toBeLessThanOrEqual(max)
      if (level === 'a1') {
        const unknown = tokenize(f.es)
          .filter((t) => t.kind === 'word' && !/^[A-ZÁÉÍÓÚÑ]/.test(t.text))
          .map((t) => t.text.toLowerCase())
          .filter((w) => !lookup(dict, w) && !['y', 'e', 'o', 'u', 'a', 'de', 'en', 'el', 'la', 'los', 'las', 'un', 'una', 'que', 'no', 'es', 'por', 'para', 'con', 'su', 'al', 'del', 'muy', 'más', 'hay', 'se', 'lo', 'le', 'mi', 'tu', 'aquí', 'allí', 'cada', 'como', 'cuando', 'donde', 'también', 'siempre', 'sus', 'este', 'esta', 'ese', 'esa', 'unos', 'unas', 'ya', 'bien', 'así', 'son', 'está', 'están', 'tiene', 'tienen', 'km', 'metros', 'mil', 'millones', 'personas', 'ciudad', 'barrio', 'río', 'casa', 'casas', 'plaza', 'calle', 'teatro', 'museo', 'parque', 'puerto', 'isla', 'mar', 'tren', 'barco', 'avión', 'aeropuerto'].includes(w))
        expect(unknown, `${s.unitId}: words outside A1 vocabulary`).toEqual([])
      }
    }
  })
  it('wearable souvenirs have valid slots and badges exist for every region', () => {
    for (const s of wearableSouvenirs()) expect(['hat', 'neck', 'mouth', 'paw']).toContain(s.wearable!.slot)
    expect(wearableSouvenirs().length).toBeGreaterThanOrEqual(20)
    for (const r of REGIONS) expect(souvenirById(`badge-${r.level}`)?.badge).toBe(true)
    expect(new Set(SOUVENIRS.map((s) => s.id)).size).toBe(SOUVENIRS.length)
  })
  it('quests never hand out badges', () => {
    const owned = new Set(SOUVENIRS.filter((s) => !s.badge).map((s) => s.id))
    expect(pickReward('a1', owned, 1)).toBeUndefined()
    for (let seed = 0; seed < 20; seed++) expect(pickReward('c2', new Set(), seed)?.badge).toBeFalsy()
  })
})
