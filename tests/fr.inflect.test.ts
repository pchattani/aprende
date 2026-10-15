import { describe, it, expect } from 'vitest'
import { pluralize, adjectiveForms, feminineOf, inflections, buildDictionary, lookup } from '@/lang/fr/inflect'
import { IRREGULAR } from '@/lang/fr/verbs'
import type { VocabEntry } from '@/engine/schema'

const V = (lemma: string, pos: VocabEntry['pos'], extra: Partial<VocabEntry> = {}): VocabEntry =>
  ({ id: `w.${lemma.replace(/[^\p{L}]+/gu, '-')}`, lemma, pos, en: ['x'], level: 'a1', tags: [], ...extra }) as VocabEntry

describe('pluralize', () => {
  const cases: [string, string][] = [
    ['livre', 'livres'], ['maison', 'maisons'], ['ami', 'amis'], ['cheval', 'chevaux'], ['journal', 'journaux'], ['animal', 'animaux'],
    ['hôpital', 'hôpitaux'], ['bal', 'bals'], ['festival', 'festivals'], ['carnaval', 'carnavals'], ['récital', 'récitals'], ['chacal', 'chacals'],
    ['régal', 'régals'], ['bateau', 'bateaux'], ['gâteau', 'gâteaux'], ['tuyau', 'tuyaux'], ['jeu', 'jeux'], ['cheveu', 'cheveux'],
    ['vœu', 'vœux'], ['pneu', 'pneus'], ['bleu', 'bleus'], ['landau', 'landaus'], ['trou', 'trous'], ['fou', 'fous'], ['clou', 'clous'],
    ['bijou', 'bijoux'], ['caillou', 'cailloux'], ['chou', 'choux'], ['genou', 'genoux'], ['hibou', 'hiboux'], ['joujou', 'joujoux'],
    ['pou', 'poux'], ['bras', 'bras'], ['prix', 'prix'], ['nez', 'nez'], ['fils', 'fils'], ['voix', 'voix'], ['œil', 'yeux'],
    ['travail', 'travaux'], ['détail', 'détails'], ['ciel', 'cieux'], ['monsieur', 'messieurs'], ['madame', 'mesdames'],
    ['pomme de terre', 'pommes de terre'], ['carte postale', 'cartes postales'], ['petit déjeuner', 'petits déjeuners'],
    ['salle de bains', 'salles de bains'], ['grand-mère', 'grands-mères'], ['chou-fleur', 'choux-fleurs'], ['arc-en-ciel', 'arcs-en-ciel'],
    ['week-end', 'week-ends'], ['porte-clé', 'porte-clés'], ['sous-sol', 'sous-sols'], ['rendez-vous', 'rendez-vous'], ['après-midi', 'après-midi'],
  ]
  for (const [s, p] of cases) {
    it(`${s} -> ${p}`, () => expect(pluralize(s)[0]).toBe(p))
  }
  it('gives both plurals where both are used', () => {
    expect(pluralize('idéal')).toEqual(['idéaux', 'idéals'])
    expect(pluralize('après-midi')).toContain('après-midis')
  })
})

describe('feminineOf and adjectiveForms', () => {
  const fem: [string, string][] = [
    ['petit', 'petite'], ['grand', 'grande'], ['joli', 'jolie'], ['gris', 'grise'], ['français', 'française'], ['rouge', 'rouge'], ['jeune', 'jeune'],
    ['heureux', 'heureuse'], ['sérieux', 'sérieuse'], ['actif', 'active'], ['sportif', 'sportive'], ['neuf', 'neuve'], ['cher', 'chère'],
    ['premier', 'première'], ['étranger', 'étrangère'], ['ancien', 'ancienne'], ['canadien', 'canadienne'], ['bon', 'bonne'], ['naturel', 'naturelle'],
    ['cruel', 'cruelle'], ['pareil', 'pareille'], ['gentil', 'gentille'], ['muet', 'muette'], ['complet', 'complète'], ['secret', 'secrète'],
    ['inquiet', 'inquiète'], ['beau', 'belle'], ['nouveau', 'nouvelle'], ['vieux', 'vieille'], ['fou', 'folle'], ['mou', 'molle'],
    ['blanc', 'blanche'], ['franc', 'franche'], ['sec', 'sèche'], ['frais', 'fraîche'], ['long', 'longue'], ['doux', 'douce'],
    ['faux', 'fausse'], ['roux', 'rousse'], ['jaloux', 'jalouse'], ['bas', 'basse'], ['gros', 'grosse'], ['épais', 'épaisse'], ['public', 'publique'],
    ['grec', 'grecque'], ['bref', 'brève'], ['meilleur', 'meilleure'], ['travailleur', 'travailleuse'], ['créateur', 'créatrice'], ['aigu', 'aiguë'],
    ['fatigué', 'fatiguée'], ['nul', 'nulle'], ['favori', 'favorite'], ['malin', 'maligne'],
  ]
  for (const [m, f] of fem) {
    it(`${m} -> ${f}`, () => expect(feminineOf(m)).toBe(f))
  }
  it('lists every form', () => {
    expect(adjectiveForms('petit').sort()).toEqual(['petit', 'petite', 'petites', 'petits'])
    expect(adjectiveForms('heureux').sort()).toEqual(['heureuse', 'heureuses', 'heureux'])
    expect(adjectiveForms('rouge').sort()).toEqual(['rouge', 'rouges'])
    expect(adjectiveForms('normal').sort()).toEqual(['normal', 'normale', 'normales', 'normaux'])
    expect(adjectiveForms('final')).toContain('finals')
    expect(adjectiveForms('beau')).toEqual(expect.arrayContaining(['beau', 'bel', 'belle', 'beaux', 'belles']))
    expect(adjectiveForms('nouveau')).toEqual(expect.arrayContaining(['nouvel', 'nouvelle', 'nouveaux', 'nouvelles']))
    expect(adjectiveForms('vieux')).toEqual(expect.arrayContaining(['vieil', 'vieille', 'vieilles']))
    expect(adjectiveForms('fou')).toEqual(expect.arrayContaining(['fol', 'folle', 'fous']))
    expect(adjectiveForms('gris').sort()).toEqual(['gris', 'grise', 'grises'])
  })
  it('keeps invariable colours invariable', () => {
    expect(adjectiveForms('marron')).toEqual(['marron'])
    expect(adjectiveForms('orange')).toEqual(['orange'])
    expect(adjectiveForms('chic')).toEqual(['chic'])
    expect(adjectiveForms('bleu clair')).toEqual(['bleu clair'])
    expect(adjectiveForms('rose').sort()).toEqual(['rose', 'roses'])
  })
  it('nouns with a given feminine', () => {
    expect(adjectiveForms('acteur', { feminine: 'actrice' }).sort()).toEqual(['acteur', 'acteurs', 'actrice', 'actrices'])
  })
})

describe('inflections', () => {
  it('verbs include every conjugated form and participle agreement', () => {
    const f = inflections(V('aller', 'verb'), IRREGULAR)
    for (const w of ['vais', 'vas', 'allons', 'irai', 'iraient', 'allai', 'aille', 'allassions', 'allé', 'allée', 'allés', 'allées', 'allant', 'va']) expect(f, w).toContain(w)
    const g = inflections(V('écrire', 'verb'), IRREGULAR)
    for (const w of ['écris', 'écrivons', 'écrivis', 'écrit', 'écrite', 'écrits', 'écrites']) expect(g, w).toContain(w)
    expect(inflections(V('être', 'verb'), IRREGULAR)).toEqual(expect.arrayContaining(['suis', 'est', 'sommes', 'soit', 'fussent', 'été', 'sois', 'étant']))
  })
  it('pronominal verbs use the base verb', () => {
    const f = inflections(V('se lever', 'verb'), IRREGULAR)
    expect(f).toEqual(expect.arrayContaining(['se lever', 'lever', 'lève', 'levé', 'levée', 'se']))
    expect(inflections(V("s'asseoir", 'verb'), IRREGULAR)).toEqual(expect.arrayContaining(['assieds', 'assis', 'assise', 'assois']))
    expect(inflections(V("s'en aller", 'verb'), IRREGULAR)).toContain('vais')
  })
  it('verb phrases conjugate their head', () => {
    expect(inflections(V('avoir faim', 'verb'), IRREGULAR)).toEqual(expect.arrayContaining(['ai', 'faim']))
    expect(inflections(V('se rendre compte', 'verb'), IRREGULAR)).toEqual(expect.arrayContaining(['rends', 'compte']))
  })
  it('nouns, irregular plurals and nouns with a feminine', () => {
    expect(inflections(V('livre', 'noun', { gender: 'm' }), IRREGULAR).sort()).toEqual(['livre', 'livres'])
    expect(inflections(V('œil', 'noun', { gender: 'm', plural: 'yeux' }), IRREGULAR).sort()).toEqual(['yeux', 'œil'])
    expect(inflections(V('cheval', 'noun', { gender: 'm' }), IRREGULAR).sort()).toEqual(['cheval', 'chevaux'])
    expect(inflections(V('prix', 'noun', { gender: 'm' }), IRREGULAR)).toEqual(['prix'])
    expect(inflections(V('ami', 'noun', { gender: 'mf' }), IRREGULAR).sort()).toEqual(['ami', 'amie', 'amies', 'amis'])
    expect(inflections(V('élève', 'noun', { gender: 'mf' }), IRREGULAR).sort()).toEqual(['élève', 'élèves'])
    expect(inflections(V('acteur', 'noun', { gender: 'm', feminine: 'actrice' }), IRREGULAR).sort()).toEqual(['acteur', 'acteurs', 'actrice', 'actrices'])
  })
  it('adjectives and nationalities', () => {
    expect(inflections(V('français', 'adj'), IRREGULAR).sort()).toEqual(['français', 'française', 'françaises'])
    expect(inflections(V('belge', 'adj'), IRREGULAR).sort()).toEqual(['belge', 'belges'])
  })
  it('determiners get their forms and elisions', () => {
    expect(new Set(inflections(V('le', 'det'), IRREGULAR))).toEqual(new Set(['le', 'la', "l'", 'les']))
    expect(inflections(V('ce', 'det'), IRREGULAR)).toEqual(expect.arrayContaining(['cet', 'cette', 'ces', "c'"]))
    expect(inflections(V('mon', 'det'), IRREGULAR)).toEqual(expect.arrayContaining(['ma', 'mes']))
    expect(inflections(V('je', 'pron'), IRREGULAR)).toEqual(expect.arrayContaining(['je', "j'"]))
    expect(inflections(V('que', 'conj'), IRREGULAR)).toEqual(expect.arrayContaining(['que', "qu'"]))
  })
  it('phrases register their words and elided parts', () => {
    expect(inflections(V("s'il vous plaît", 'phrase'), IRREGULAR)).toEqual(expect.arrayContaining(["s'il vous plaît", "s'il", "s'", 'il', 'vous', 'plaît']))
    expect(inflections(V("qu'est-ce que", 'phrase'), IRREGULAR)).toEqual(expect.arrayContaining(["qu'est-ce", "qu'", 'est', 'ce', 'que']))
  })
})

describe('lookup', () => {
  const dict = buildDictionary(
    [
      V('dire', 'verb'), V('parler', 'verb'), V('donner', 'verb'), V('se lever', 'verb'), V('aller', 'verb'), V('faire', 'verb'), V('avoir', 'verb'),
      V('le', 'det'), V('de', 'prep'), V('ami', 'noun', { gender: 'mf' }), V('eau', 'noun', { gender: 'f', plural: 'eaux' }), V('je', 'pron'),
      V('que', 'conj'), V('ce', 'det'), V('être', 'verb'), V('jusque', 'prep'), V('à', 'prep'), V('il', 'pron'), V('cœur', 'noun', { gender: 'm' }),
      V('grand', 'adj'), V('mère', 'noun', { gender: 'f' }), V('heureux', 'adj'), V('rapide', 'adj'), V('constant', 'adj'), V('évident', 'adj'),
      V('énorme', 'adj'), V('gentil', 'adj'), V('vrai', 'adj'), V('celui', 'pron'), V('livre', 'noun', { gender: 'm' }), V('aujourd’hui', 'adv'),
      V('pouvoir', 'verb'),
    ],
    IRREGULAR,
  )
  const lemmaOf = (w: string) => lookup(dict, w)?.[0]?.lemma
  it('finds direct forms', () => {
    expect(lemmaOf('parle')).toBe('parler')
    expect(lemmaOf('Dit')).toBe('dire')
    expect(lemmaOf('lève')).toBe('se lever')
    expect(lemmaOf("aujourd'hui")).toBe('aujourd’hui')
  })
  it('understands elisions', () => {
    expect(lemmaOf("l'")).toBe('le')
    expect(lemmaOf("L'")).toBe('le')
    expect(lemmaOf("d'")).toBe('de')
    expect(lemmaOf("j'")).toBe('je')
    expect(lemmaOf("qu'")).toBe('que')
    expect(lemmaOf("c'")).toBe('ce')
    expect(lemmaOf('jusqu’')).toBe('jusque')
    expect(lemmaOf("l'ami")).toBe('ami')
    expect(lemmaOf("d'eau")).toBe('eau')
    expect(lemmaOf('l’amie')).toBe('ami')
    expect(lemmaOf("j'ai")).toBe('avoir')
    expect(lemmaOf("qu'il")).toBe('il')
  })
  it('understands pronouns after a hyphen', () => {
    expect(lemmaOf('dis-moi')).toBe('dire')
    expect(lemmaOf('donne-le-moi')).toBe('donner')
    expect(lemmaOf('lève-toi')).toBe('se lever')
    expect(lemmaOf('allez-y')).toBe('aller')
    expect(lemmaOf('vas-y')).toBe('aller')
    expect(lemmaOf("va-t'en")).toBe('aller')
    expect(lemmaOf('fais-le')).toBe('faire')
    expect(lemmaOf('a-t-il')).toBe('avoir')
    expect(lemmaOf('est-ce')).toBe('être')
  })
  it('understands compounds of known words and ligatures typed out', () => {
    expect(lemmaOf('grand-mère')).toBe('mère')
    expect(lemmaOf('celui-ci')).toBe('celui')
    expect(lemmaOf('livre-là')).toBe('livre')
    expect(lemmaOf('peut-être')).toBe('pouvoir')
    expect(lemmaOf('coeur')).toBe('cœur')
  })
  it('understands -ment adverbs', () => {
    expect(lemmaOf('heureusement')).toBe('heureux')
    expect(lemmaOf('rapidement')).toBe('rapide')
    expect(lemmaOf('vraiment')).toBe('vrai')
    expect(lemmaOf('constamment')).toBe('constant')
    expect(lemmaOf('évidemment')).toBe('évident')
    expect(lemmaOf('énormément')).toBe('énorme')
    expect(lemmaOf('gentiment')).toBe('gentil')
  })
  it('does not invent words', () => {
    expect(lookup(dict, 'famille')).toBeUndefined()
    expect(lookup(dict, 'grand-père')).toBeUndefined()
    expect(lookup(dict, 'parlement')).toBeUndefined()
    expect(lookup(dict, "l'xyz")).toBeUndefined()
  })
})
