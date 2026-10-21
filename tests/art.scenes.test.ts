import { describe, it, expect } from 'vitest'
import esJourney from '../content/es/journey.yaml'
import yueJourney from '../content/yue/journey.yaml'
import ptJourney from '../content/pt/journey.yaml'
import itJourney from '../content/it/journey.yaml'
import frJourney from '../content/fr/journey.yaml'
import esSyllabus from '../content/es/syllabus.yaml'
import yueSyllabus from '../content/yue/syllabus.yaml'
import ptSyllabus from '../content/pt/syllabus.yaml'
import itSyllabus from '../content/it/syllabus.yaml'
import frSyllabus from '../content/fr/syllabus.yaml'
import { sceneFor, MOTIFS, ACCENTS, PALETTES, SCENE_OVERRIDES, type Motif } from '@/engine/scenes'
import { LEVEL_ORDER, type LevelId } from '@/engine/schema'

type Journey = { regions: { level: LevelId; stops: { name: string; emoji: string; es: string; en: string }[] }[] }
const COURSES = ['es', 'yue', 'pt', 'it', 'fr'] as const
const JOURNEYS: Record<string, unknown> = { es: esJourney, yue: yueJourney, pt: ptJourney, it: itJourney, fr: frJourney }
const SYLLABI: Record<string, unknown> = { es: esSyllabus, yue: yueSyllabus, pt: ptSyllabus, it: itSyllabus, fr: frSyllabus }

function stopsOf(course: string) {
  const j = JOURNEYS[course] as Journey
  // stop i belongs to the level's i-th unit in syllabus order (Cantonese lists its starter units a1.u13–u22 first)
  const units = (SYLLABI[course] as { levels: { id: LevelId; units: { id: string }[] }[] }).levels
  return j.regions.flatMap((r) => r.stops.map((s, i) => ({ ...s, unitId: units.find((l) => l.id === r.level)!.units[i]!.id, level: r.level })))
}

describe('postcard scenes', () => {
  for (const course of COURSES) {
    describe(course, () => {
      const stops = stopsOf(course)
      const scenes = stops.map((s) => ({ stop: s, scene: sceneFor(s, s.level, course) }))

      it('maps every stop to a known motif, accent and palette', () => {
        expect(stops.length).toBeGreaterThan(40)
        for (const { stop, scene } of scenes) {
          expect(MOTIFS, `${course}:${stop.unitId} ${stop.name}`).toContain(scene.motif)
          if (scene.accent) expect(ACCENTS).toContain(scene.accent)
          expect(scene.palette).toBe(PALETTES[stop.level])
          expect(['dawn', 'day', 'golden', 'dusk', 'night']).toContain(scene.time)
        }
      })

      it('is not degenerate: no motif covers more than a quarter of the stops, and many motifs are used', () => {
        const counts = new Map<Motif, number>()
        for (const { scene } of scenes) counts.set(scene.motif, (counts.get(scene.motif) ?? 0) + 1)
        for (const [motif, n] of counts) expect(n / stops.length, `${course} ${motif}: ${n}/${stops.length}`).toBeLessThanOrEqual(0.25)
        expect(counts.size).toBeGreaterThanOrEqual(14)
      })

      it('is deterministic and varies its seed per stop', () => {
        const again = stops.map((s) => sceneFor(s, s.level, course))
        expect(again.map((s) => [s.motif, s.seed, s.time])).toEqual(scenes.map(({ scene }) => [scene.motif, scene.seed, scene.time]))
        expect(new Set(scenes.map(({ scene }) => scene.seed)).size).toBe(stops.length)
      })

      it('only overrides stops that exist', () => {
        const ids = new Set(stops.map((s) => `${course}:${s.unitId}`))
        for (const key of Object.keys(SCENE_OVERRIDES).filter((k) => k.startsWith(`${course}:`))) expect(ids, key).toContain(key)
      })
    })
  }

  it('has a distinct palette for each region', () => {
    const skies = new Set(LEVEL_ORDER.map((l) => PALETTES[l].sky.join()))
    expect(skies.size).toBe(LEVEL_ORDER.length)
  })

  it('paints real places sensibly', () => {
    const find = (course: string, name: RegExp) => {
      const s = stopsOf(course).find((x) => name.test(x.name))!
      return sceneFor(s, s.level, course).motif
    }
    expect(find('es', /Perito|Calafate/)).toBe('glacier')
    expect(find('es', /Aconcagua/)).toBe('mountains')
    expect(find('es', /Iguazú/)).toBe('waterfall')
    expect(find('yue', /Star Ferry/)).toBe('harbour')
    expect(find('yue', /Wong Tai Sin/)).toBe('temple')
    expect(find('pt', /Copacabana/)).toBe('beach')
    expect(find('pt', /Lisboa/)).toBe('oldtown')
    expect(find('it', /Venezia/)).toBe('canal')
    expect(find('it', /Pisa/)).toBe('tower')
    expect(find('fr', /tour Eiffel/)).toBe('tower')
    expect(find('fr', /Chamonix/)).toBe('mountains')
  })
})
