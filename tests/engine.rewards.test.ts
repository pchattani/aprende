import { describe, it, expect } from 'vitest'
import { pickReward, WARDROBE_SHARE } from '@/engine/quests'
import { REGIONAL_SOUVENIRS, WARDROBE, SOUVENIRS, souvenirById, wearableSouvenirs, souvenirsFor } from '@/engine/journey'
import { buildWardrobe, wardrobeName, wardrobeId } from '@/engine/wardrobe'
import { ART_KINDS, WARDROBE_KINDS, WARDROBE_COLOURS, WEAR_SLOTS } from '@/engine/artKinds'
import { WardrobeSchema, LEVEL_ORDER, type LevelId } from '@/engine/schema'
import { pack } from '@/engine/loader'

// Every course's wardrobe.yaml (the yaml plugin parses them), to check agreement in all five languages.
const wardrobeFiles = import.meta.glob('/content/*/wardrobe.yaml', { eager: true, import: 'default' }) as Record<string, unknown>
const wardrobeFile = (lang: string) => WardrobeSchema.parse(wardrobeFiles[`/content/${lang}/wardrobe.yaml`])
const rank = (l: LevelId) => LEVEL_ORDER.indexOf(l)

describe(`souvenirs (${pack.name})`, () => {
  it('tags every souvenir with an illustration kind and a valid colour and slot', () => {
    for (const s of SOUVENIRS) {
      expect(ART_KINDS, s.id).toContain(s.art)
      if (s.color) expect(s.color, s.id).toMatch(/^#[0-9a-f]{6}$/i)
      if (s.wearable) expect(WEAR_SLOTS, s.id).toContain(s.wearable.slot)
    }
    expect(new Set(SOUVENIRS.map((s) => s.id)).size).toBe(SOUVENIRS.length)
  })
  it('has about a dozen regional souvenirs per level', () => {
    for (const l of LEVEL_ORDER) expect(REGIONAL_SOUVENIRS.filter((s) => s.level === l).length, l).toBeGreaterThanOrEqual(12)
  })
})

describe(`wardrobe (${pack.name})`, () => {
  it('has every kind in every colour, with unique ids', () => {
    expect(WARDROBE).toHaveLength(WARDROBE_KINDS.length * WARDROBE_COLOURS.length)
    expect(WARDROBE).toHaveLength(96)
    expect(new Set(WARDROBE.map((w) => w.id)).size).toBe(96)
    for (const { kind, slot } of WARDROBE_KINDS) {
      for (const c of WARDROBE_COLOURS) {
        const w = souvenirById(wardrobeId(kind, c.id))!
        expect(w, `${kind}/${c.id}`).toBeDefined()
        expect(w.id).toBe(`wear-${kind}-${c.id}`)
        expect(w.art).toBe(kind)
        expect(w.color).toBe(c.hex)
        expect(w.wearable?.slot).toBe(slot)
        expect(w.wardrobe).toEqual({ kind, colour: c.id })
      }
    }
  })
  it('names every item in the course language and in English', () => {
    for (const w of WARDROBE) {
      expect(w.es.trim(), w.id).not.toBe('')
      expect(w.es, w.id).not.toMatch(/[{}]/)
      expect(w.en, w.id).toMatch(/^(an? )?(red|blue|green|yellow|purple|pink|orange|black) [a-z ]+$/)
      expect(w.blurb.length, w.id).toBeGreaterThan(10)
    }
    // Different colours of one kind have different names.
    for (const { kind } of WARDROBE_KINDS) expect(new Set(WARDROBE.filter((w) => w.wardrobe!.kind === kind).map((w) => w.es)).size).toBe(8)
    expect(souvenirById('wear-umbrella-orange')?.en).toBe('an orange umbrella')
    expect(souvenirById('wear-sunglasses-blue')?.en).toBe('blue sunglasses')
  })
  it('shows up in the dress-up list and the souvenir list', () => {
    const wear = new Set(wearableSouvenirs().map((s) => s.id))
    for (const w of WARDROBE) expect(wear.has(w.id), w.id).toBe(true)
    for (const l of LEVEL_ORDER) expect(souvenirsFor(l).some((s) => s.wardrobe)).toBe(false)
  })
})

describe('wardrobe names agree in gender and number in every course', () => {
  const cases: [string, string, (typeof WARDROBE_COLOURS)[number]['id'], string][] = [
    ['es', 'beret', 'red', 'una boina roja'],
    ['es', 'sunglasses', 'blue', 'unos lentes de sol azules'],
    ['es', 'round-glasses', 'black', 'unos anteojos redondos negros'],
    ['es', 'bowtie', 'yellow', 'un moño amarillo'],
    ['pt', 'beret', 'red', 'uma boina vermelha'],
    ['pt', 'sunglasses', 'blue', 'um par de óculos de sol azuis'],
    ['pt', 'cap', 'purple', 'um boné roxo'],
    ['it', 'beret', 'red', 'un basco rosso'],
    ['it', 'scarf', 'red', 'una sciarpa rossa'],
    ['it', 'sunglasses', 'black', 'un paio di occhiali da sole neri'],
    ['it', 'umbrella', 'blue', 'un ombrello blu'],
    ['fr', 'beret', 'red', 'un béret rouge'],
    ['fr', 'scarf', 'green', 'une écharpe verte'],
    ['fr', 'sunglasses', 'purple', 'des lunettes de soleil violettes'],
    ['fr', 'cap', 'orange', 'une casquette orange'],
    ['yue', 'beret', 'red', '一頂紅色貝雷帽'],
    ['yue', 'umbrella', 'black', '一把黑色遮'],
  ]
  it.each(cases)('%s %s %s → %s', (lang, kind, colour, name) => {
    expect(wardrobeName(wardrobeFile(lang), kind as (typeof ART_KINDS)[number], colour)).toBe(name)
  })
  it('builds 96 distinct names for every course', () => {
    for (const lang of ['es', 'yue', 'pt', 'it', 'fr']) {
      const items = buildWardrobe(wardrobeFile(lang))
      expect(items, lang).toHaveLength(96)
      expect(new Set(items.map((w) => w.es)).size, lang).toBe(96)
    }
  })
})

describe(`pickReward (${pack.name})`, () => {
  const regional = (level: LevelId) => REGIONAL_SOUVENIRS.filter((s) => s.level === level)
  it('gives souvenirs of the current region first', () => {
    for (const level of LEVEL_ORDER) {
      for (let seed = 0; seed < 30; seed++) {
        const r = pickReward(level, new Set(), seed)!
        expect(r.level).toBe(level)
        expect(r.wardrobe).toBeUndefined()
        expect(r.badge).toBeFalsy()
      }
    }
  })
  it('then mixes earlier regions with the wardrobe, wardrobe kinds of the level first', () => {
    const owned = new Set(regional('b2').map((s) => s.id))
    let wear = 0
    for (let seed = 0; seed < 300; seed++) {
      const r = pickReward('b2', owned, seed)!
      expect(r.badge).toBeFalsy()
      if (r.wardrobe) {
        wear++
        expect(rank(r.level)).toBeLessThanOrEqual(rank('b2'))
      } else expect(rank(r.level)).toBeLessThan(rank('b2'))
    }
    // roughly WARDROBE_SHARE of the rewards are wardrobe items
    expect(wear / 300).toBeGreaterThan(WARDROBE_SHARE - 0.15)
    expect(wear / 300).toBeLessThan(WARDROBE_SHARE + 0.15)
  })
  it('keeps later regions as a surprise until the wardrobe and earlier regions are exhausted', () => {
    const owned = new Set([...regional('a1'), ...WARDROBE].map((s) => s.id))
    for (let seed = 0; seed < 50; seed++) expect(pickReward('a1', owned, seed)!.level).not.toBe('a1')
    const ownedA1 = new Set(regional('a1').map((s) => s.id))
    for (let seed = 0; seed < 50; seed++) expect(pickReward('a1', ownedA1, seed)!.wardrobe).toBeDefined()
  })
  it('never returns undefined across 300 draws for a learner who owns every regional souvenir', () => {
    const owned = new Set(REGIONAL_SOUVENIRS.map((s) => s.id))
    for (let seed = 0; seed < 300; seed++) {
      const r = pickReward(LEVEL_ORDER[seed % LEVEL_ORDER.length]!, owned, seed)
      expect(r, `seed ${seed}`).toBeDefined()
      expect(r!.wardrobe).toBeDefined()
    }
  })
  it('hands out every wardrobe item, one at a time, before running dry', () => {
    const owned = new Set(REGIONAL_SOUVENIRS.map((s) => s.id))
    const got: string[] = []
    for (let i = 0; i < 300; i++) {
      const level = LEVEL_ORDER[i % LEVEL_ORDER.length]!
      const r = pickReward(level, owned, i * 7919 + 1)
      if (got.length < 96) {
        expect(r, `draw ${i}`).toBeDefined()
        expect(r!.wardrobe).toBeDefined()
        expect(owned.has(r!.id)).toBe(false)
      }
      if (r) {
        owned.add(r.id)
        got.push(r.id)
      }
    }
    expect(got).toHaveLength(96)
    expect(new Set(got).size).toBe(96)
    expect(pickReward('c2', owned, 1)).toBeUndefined()
  })
  it('never hands out badges', () => {
    const owned = new Set(SOUVENIRS.filter((s) => !s.badge).map((s) => s.id))
    expect(pickReward('a1', owned, 1)).toBeUndefined()
  })
})
