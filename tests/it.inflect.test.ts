import { describe, it, expect } from 'vitest'
import { pluralize, adjectiveForms, inflections, buildDictionary, lookup } from '@/lang/it/inflect'
import { IRREGULAR } from '@/lang/it/verbs'
import type { VocabEntry } from '@/engine/schema'

const V = (lemma: string, pos: VocabEntry['pos'], extra: Partial<VocabEntry> = {}): VocabEntry =>
  ({ id: `w.${lemma.replace(/[^\p{L}]+/gu, '-')}`, lemma, pos, en: ['x'], level: 'a1', tags: [], ...extra }) as VocabEntry

describe('pluralize', () => {
  const cases: [string, VocabEntry['gender'] | undefined, string][] = [
    ['libro', 'm', 'libri'], ['casa', 'f', 'case'], ['studente', 'm', 'studenti'], ['chiave', 'f', 'chiavi'],
    ['amica', 'f', 'amiche'], ['amico', 'm', 'amici'], ['lago', 'm', 'laghi'], ['medico', 'm', 'medici'],
    ['gioco', 'm', 'giochi'], ['parco', 'm', 'parchi'], ['albergo', 'm', 'alberghi'], ['dialogo', 'm', 'dialoghi'],
    ['psicologo', 'm', 'psicologi'], ['greco', 'm', 'greci'], ['farmacia', 'f', 'farmacie'], ['camicia', 'f', 'camicie'],
    ['valigia', 'f', 'valigie'], ['arancia', 'f', 'arance'], ['spiaggia', 'f', 'spiagge'], ['pioggia', 'f', 'piogge'],
    ['energia', 'f', 'energie'], ['bugia', 'f', 'bugie'], ['storia', 'f', 'storie'], ['banca', 'f', 'banche'],
    ['negozio', 'm', 'negozi'], ['figlio', 'm', 'figli'], ['occhio', 'm', 'occhi'], ['bacio', 'm', 'baci'],
    ['orologio', 'm', 'orologi'], ['zio', 'm', 'zii'], ['invio', 'm', 'invii'], ['uomo', 'm', 'uomini'],
    ['uovo', 'm', 'uova'], ['braccio', 'm', 'braccia'], ['mano', 'f', 'mani'], ['dio', 'm', 'dei'],
    ['città', 'f', 'città'], ['caffè', 'm', 'caffè'], ['università', 'f', 'università'], ['virtù', 'f', 'virtù'],
    ['film', 'm', 'film'], ['bar', 'm', 'bar'], ['sport', 'm', 'sport'], ['re', 'm', 're'], ['crisi', 'f', 'crisi'],
    ['analisi', 'f', 'analisi'], ['serie', 'f', 'serie'], ['foto', 'f', 'foto'], ['radio', 'f', 'radio'], ['cinema', 'm', 'cinema'],
    ['problema', 'm', 'problemi'], ['programma', 'm', 'programmi'], ['poeta', 'm', 'poeti'], ['duca', 'm', 'duchi'],
    ['moglie', 'f', 'mogli'], ['ala', 'f', 'ali'], ['carta di credito', 'f', 'carte di credito'],
  ]
  for (const [s, g, p] of cases) {
    it(`${s} -> ${p}`, () => expect(pluralize(s, { gender: g })[0]).toBe(p))
  }
  it('masculine -a nouns are recognised without a gender', () => {
    expect(pluralize('problema')).toEqual(['problemi'])
    expect(pluralize('sistema')).toEqual(['sistemi'])
    expect(pluralize('casa')).toEqual(['case'])
  })
  it('mf nouns in -ista and -a give both plurals', () => {
    expect(pluralize('turista', { gender: 'mf' })).toEqual(['turisti', 'turiste'])
    expect(pluralize('collega', { gender: 'mf' })).toEqual(['colleghi', 'colleghe'])
    expect(pluralize('artista')).toEqual(['artisti', 'artiste'])
  })
})

describe('adjectiveForms', () => {
  it('four-form adjectives', () => {
    expect(adjectiveForms('rosso').sort()).toEqual(['rossa', 'rosse', 'rossi', 'rosso'])
    expect(adjectiveForms('simpatico').sort()).toEqual(['simpatica', 'simpatiche', 'simpatici', 'simpatico'])
    expect(adjectiveForms('bianco').sort()).toEqual(['bianca', 'bianche', 'bianchi', 'bianco'])
    expect(adjectiveForms('lungo').sort()).toEqual(['lunga', 'lunghe', 'lunghi', 'lungo'])
    expect(adjectiveForms('vecchio').sort()).toEqual(['vecchi', 'vecchia', 'vecchie', 'vecchio'])
    expect(adjectiveForms('grigio').sort()).toEqual(['grigi', 'grigia', 'grigie', 'grigio'])
    expect(adjectiveForms('saggio')).toContain('sagge')
    expect(adjectiveForms('antico')).toContain('antichi')
  })
  it('two-form and invariable adjectives', () => {
    expect(adjectiveForms('verde').sort()).toEqual(['verde', 'verdi'])
    expect(adjectiveForms('felice').sort()).toEqual(['felice', 'felici'])
    expect(adjectiveForms('rosa')).toEqual(['rosa'])
    expect(adjectiveForms('blu')).toEqual(['blu'])
    expect(adjectiveForms('viola')).toEqual(['viola'])
    expect(adjectiveForms('ottimista').sort()).toEqual(['ottimista', 'ottimiste', 'ottimisti'])
    expect(adjectiveForms('lavoratore')).toEqual(expect.arrayContaining(['lavoratori', 'lavoratrice', 'lavoratrici']))
  })
  it('bello, buono, quello, grande', () => {
    expect(adjectiveForms('bello')).toEqual(expect.arrayContaining(['bel', "bell'", 'bei', 'begli', 'bella', 'belle', 'belli']))
    expect(adjectiveForms('buono')).toEqual(expect.arrayContaining(['buon', "buon'", 'buona']))
    expect(adjectiveForms('quello')).toEqual(expect.arrayContaining(['quel', 'quei', 'quegli', "quell'"]))
    expect(adjectiveForms('grande')).toContain('gran')
  })
  it('nouns with a given feminine', () => {
    expect(adjectiveForms('attore', { feminine: 'attrice' }).sort()).toEqual(['attore', 'attori', 'attrice', 'attrici'])
  })
})

describe('inflections', () => {
  it('verbs include every conjugated form and participle agreement', () => {
    const f = inflections(V('andare', 'verb'), IRREGULAR)
    for (const w of ['vado', 'vai', 'andiamo', 'andrò', 'andrebbero', 'andai', 'vada', 'andassimo', 'andato', 'andata', 'andati', 'andate', 'andando', "va'"]) expect(f, w).toContain(w)
    const g = inflections(V('scrivere', 'verb'), IRREGULAR)
    for (const w of ['scrivo', 'scrissi', 'scrisse', 'scritto', 'scritta', 'scritti', 'scritte']) expect(g, w).toContain(w)
    expect(inflections(V('essere', 'verb'), IRREGULAR)).toEqual(expect.arrayContaining(['sono', 'è', 'sia', 'fossero', 'stato', 'stata', 'sii']))
  })
  it('reflexive verbs use the base verb', () => {
    const f = inflections(V('alzarsi', 'verb'), IRREGULAR)
    expect(f).toEqual(expect.arrayContaining(['alzarsi', 'alzare', 'alzo', 'alzato', 'alzata']))
    expect(inflections(V('porsi', 'verb'), IRREGULAR)).toContain('pongo')
  })
  it('verb phrases conjugate their head', () => {
    expect(inflections(V('fare colazione', 'verb'), IRREGULAR)).toEqual(expect.arrayContaining(['faccio', 'colazione']))
  })
  it('nouns, irregular plurals and nouns with a feminine', () => {
    expect(inflections(V('libro', 'noun', { gender: 'm' }), IRREGULAR).sort()).toEqual(['libri', 'libro'])
    expect(inflections(V('uovo', 'noun', { gender: 'm', plural: 'uova' }), IRREGULAR).sort()).toEqual(['uova', 'uovo'])
    expect(inflections(V('città', 'noun', { gender: 'f' }), IRREGULAR)).toEqual(['città'])
    expect(inflections(V('amico', 'noun', { gender: 'mf' }), IRREGULAR).sort()).toEqual(['amica', 'amiche', 'amici', 'amico'])
    expect(inflections(V('studente', 'noun', { gender: 'm', feminine: 'studentessa' }), IRREGULAR).sort()).toEqual(['studente', 'studentessa', 'studentesse', 'studenti'])
  })
  it('adjectives and nationalities', () => {
    expect(inflections(V('italiano', 'adj'), IRREGULAR).sort()).toEqual(['italiana', 'italiane', 'italiani', 'italiano'])
    expect(inflections(V('inglese', 'adj'), IRREGULAR).sort()).toEqual(['inglese', 'inglesi'])
  })
  it('determiners with explicit forms get their elisions', () => {
    const f = inflections(V('il', 'det', { forms: ['il', 'lo', 'la', 'i', 'gli', 'le'] }), IRREGULAR)
    expect(new Set(f)).toEqual(new Set(['il', 'lo', 'la', "l'", 'i', 'gli', 'le']))
    expect(inflections(V('uno', 'det', { forms: ['un', 'uno', 'una'] }), IRREGULAR)).toContain("un'")
    expect(inflections(V('questo', 'det'), IRREGULAR)).toEqual(expect.arrayContaining(['questa', 'questi', 'queste', "quest'"]))
  })
  it('phrases register their words and elided parts', () => {
    expect(inflections(V("c'è", 'phrase'), IRREGULAR)).toEqual(expect.arrayContaining(["c'è", "c'", 'è']))
    expect(inflections(V('buona notte', 'phrase'), IRREGULAR)).toEqual(expect.arrayContaining(['buona notte', 'buona', 'notte']))
  })
})

describe('lookup', () => {
  const dict = buildDictionary(
    [
      V('dire', 'verb'), V('parlare', 'verb'), V('dare', 'verb'), V('alzarsi', 'verb'), V('comprare', 'verb'), V('fare', 'verb'),
      V('vedere', 'verb'), V('andare', 'verb'), V('porre', 'verb'), V('portare', 'verb'), V('mangiare', 'verb'),
      V('il', 'det', { forms: ['il', 'lo', 'la', 'i', 'gli', 'le'] }), V('di', 'prep'), V('amico', 'noun', { gender: 'mf' }),
      V('acqua', 'noun', { gender: 'f' }), V('ci', 'pron'), V('essere', 'verb'), V('dove', 'adv'), V('perché', 'conj'),
      V('un', 'det', { forms: ['un', 'uno', 'una'] }), V('ecco', 'adv'), V('poco', 'adv'),
    ],
    IRREGULAR,
  )
  const lemmaOf = (w: string) => lookup(dict, w)?.[0]?.lemma
  it('finds direct forms', () => {
    expect(lemmaOf('parlo')).toBe('parlare')
    expect(lemmaOf('Detto')).toBe('dire')
  })
  it('understands attached pronouns', () => {
    expect(lemmaOf('dimmi')).toBe('dire')
    expect(lemmaOf('dimmelo')).toBe('dire')
    expect(lemmaOf('parlarle')).toBe('parlare')
    expect(lemmaOf('parlargli')).toBe('parlare')
    expect(lemmaOf('dammelo')).toBe('dare')
    expect(lemmaOf('dagli')).toBe('dare')
    expect(lemmaOf('alzati')).toBe('alzarsi')
    expect(lemmaOf('alzarmi')).toBe('alzarsi')
    expect(lemmaOf('comprarlo')).toBe('comprare')
    expect(lemmaOf('compralo')).toBe('comprare')
    expect(lemmaOf('facendolo')).toBe('fare')
    expect(lemmaOf('fallo')).toBe('fare')
    expect(lemmaOf('vederci')).toBe('vedere')
    expect(lemmaOf('andarsene')).toBe('andare')
    expect(lemmaOf('vattene')).toBe('andare')
    expect(lemmaOf('porlo')).toBe('porre')
    expect(lemmaOf('portaglielo')).toBe('portare')
    expect(lemmaOf('mangiatelo')).toBe('mangiare')
    expect(lemmaOf('eccolo')).toBe('ecco')
  })
  it('understands elisions', () => {
    expect(lemmaOf("l'")).toBe('il')
    expect(lemmaOf("L'")).toBe('il')
    expect(lemmaOf("dell'")).toBe('di')
    expect(lemmaOf("c'")).toBe('ci')
    expect(lemmaOf("dov'")).toBe('dove')
    expect(lemmaOf("un'")).toBe('un')
    expect(lemmaOf("l'amico")).toBe('amico')
    expect(lemmaOf("dell'acqua")).toBe('acqua')
    expect(lemmaOf('l’amica')).toBe('amico')
    expect(lemmaOf("po'")).toBe('poco')
  })
  it('understands accents typed as apostrophes', () => {
    expect(lemmaOf("perche'")).toBe('perché')
    expect(lemmaOf("e'")).toBe('essere')
  })
  it('does not invent words', () => {
    expect(lookup(dict, 'famiglia')).toBeUndefined()
    expect(lookup(dict, 'parlarmelo')).toBeDefined()
    expect(lookup(dict, 'casali')).toBeUndefined()
  })
})
