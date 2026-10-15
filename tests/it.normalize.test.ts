import { describe, it, expect } from 'vitest'
import { normalize, stripAccents, match, words, editDistance, apostropheAccents } from '@/lang/it/normalize'
import { tokenize } from '@/lang/it/tokenize'
import { languagePack } from '@/lang/it/index'

describe('stripAccents', () => {
  it('removes grave and acute accents', () => {
    expect(stripAccents('città')).toBe('citta')
    expect(stripAccents('perché')).toBe('perche')
    expect(stripAccents('è così')).toBe('e cosi')
    expect(stripAccents('più, può, virtù')).toBe('piu, puo, virtu')
    expect(stripAccents('PERCHÉ')).toBe('PERCHE')
    expect(stripAccents('í ó ú')).toBe('i o u')
  })
  it('treats an accent typed as an apostrophe as the plain vowel', () => {
    expect(stripAccents("perche'")).toBe('perche')
    expect(stripAccents("citta'")).toBe('citta')
    expect(stripAccents("e' vero")).toBe('e vero')
  })
  it('keeps real apostrophes', () => {
    expect(stripAccents("un po'")).toBe("un po'")
    expect(stripAccents("va' via")).toBe("va' via")
    expect(stripAccents("l'amico")).toBe("l'amico")
  })
})

describe('apostropheAccents', () => {
  it('turns vowel + apostrophe into the accented vowel', () => {
    expect(apostropheAccents("perche'")).toBe('perché')
    expect(apostropheAccents("poiche'")).toBe('poiché')
    expect(apostropheAccents("citta'")).toBe('città')
    expect(apostropheAccents("e'")).toBe('è')
    expect(apostropheAccents("E' vero")).toBe('È vero')
    expect(apostropheAccents("cosi'")).toBe('così')
    expect(apostropheAccents("puo'")).toBe('può')
    expect(apostropheAccents("caffe'")).toBe('caffè')
    expect(apostropheAccents("ventitre'")).toBe('ventitré')
    expect(apostropheAccents("ne' tu ne' io")).toBe('né tu né io')
  })
  it('leaves po\', imperatives and elisions alone', () => {
    expect(apostropheAccents("un po' di pane")).toBe("un po' di pane")
    expect(apostropheAccents("di' la verità, fa' presto, va' via, sta' zitto, da' una mano")).toBe("di' la verità, fa' presto, va' via, sta' zitto, da' una mano")
    expect(apostropheAccents("l'amico dell'acqua")).toBe("l'amico dell'acqua")
  })
})

describe('normalize', () => {
  it('lowercases, strips punctuation and collapses spaces', () => {
    expect(normalize('Come   stai?')).toBe('come stai')
    expect(normalize('Ciao, Marco!')).toBe('ciao marco')
    expect(normalize('  Il  bambino.  ')).toBe('il bambino')
    expect(normalize('«Andiamo» – disse.')).toBe('andiamo disse')
  })
  it('keeps elisions as one word', () => {
    expect(normalize("L'amico dell'acqua")).toBe("l'amico dell'acqua")
    expect(normalize('L’amica')).toBe("l'amica")
    expect(normalize("C'è un'amica")).toBe("c'è un'amica")
    expect(normalize("l' amico")).toBe("l'amico")
    expect(normalize("Dov'è?")).toBe("dov'è")
  })
  it('keeps po\' and drops quote marks', () => {
    expect(normalize("Un po' di pane.")).toBe("un po' di pane")
    expect(normalize("Ha detto 'ciao'.")).toBe('ha detto ciao')
  })
  it('turns apostrophe accents into accents', () => {
    expect(normalize("Perche' e' qui?")).toBe('perché è qui')
    expect(normalize("La citta' e' bella")).toBe('la città è bella')
  })
  it('optionally strips accents', () => {
    expect(normalize('Perché è così?', { accentInsensitive: true })).toBe('perche e cosi')
  })
})

describe('match', () => {
  it('accepts exact answers ignoring case and punctuation', () => {
    expect(match('ciao, come stai?', ['Ciao, come stai?']).verdict).toBe('correct')
    expect(match("L'amico è qui", ["L'amico è qui."]).verdict).toBe('correct')
    expect(match("l' amico è qui", ["L'amico è qui."]).verdict).toBe('correct')
  })
  it('accepts accents typed as apostrophes', () => {
    expect(match("Perche' e' qui?", ['Perché è qui?']).verdict).toBe('correct')
    expect(match("La citta' e' bella", ['La città è bella.']).verdict).toBe('correct')
  })
  it('accepts alternatives', () => {
    expect(match('buongiorno', ['Buongiorno', 'Buon giorno']).verdict).toBe('correct')
    expect(match('buon giorno', ['Buongiorno', 'Buon giorno']).verdict).toBe('correct')
  })
  it('flags accent-only mistakes as almost with a note', () => {
    const r = match('perche e qui', ['Perché è qui?'])
    expect(r.verdict).toBe('almost')
    expect(r.reason).toBe('accents')
    expect(r.notes[0]).toMatch(/perché/)
    expect(match('la citta e bella', ['La città è bella']).verdict).toBe('almost')
    expect(match('perchè', ['perché']).reason).toBe('accents')
  })
  it('tolerates one typo in a long word only', () => {
    const r = match('mi piace la biblotecca', ['Mi piace la biblioteca'])
    expect(r.verdict).toBe('wrong') // two edits
    const r2 = match('mi piace la bibloteca', ['Mi piace la biblioteca'])
    expect(r2.verdict).toBe('almost')
    expect(r2.reason).toBe('typo')
    expect(match('il gatto è nera', ['Il gatto è nero']).verdict).toBe('wrong') // agreement, not a typo
    expect(match('la ragazza è alto', ['La ragazza è alta']).verdict).toBe('wrong')
    expect(match('io parla', ['Io parlo']).verdict).toBe('wrong')
    expect(match("l'amico", ["l'amica"]).verdict).toBe('wrong')
  })
  it('rejects wrong answers and empty input', () => {
    expect(match('', ['Ciao']).verdict).toBe('wrong')
    expect(match('arrivederci', ['Ciao']).verdict).toBe('wrong')
  })
})

describe('words', () => {
  it('splits a sentence into tiles, keeping elided words whole', () => {
    expect(words("L'amico di Marco è all'università.")).toEqual(["l'amico", 'di', 'marco', 'è', "all'università"])
    expect(words("C'è un po' di pane.")).toEqual(["c'è", 'un', "po'", 'di', 'pane'])
    expect(words('Un’amica')).toEqual(["un'amica"])
  })
})

describe('editDistance', () => {
  it('counts transpositions as one edit', () => {
    expect(editDistance('casa', 'caas')).toBe(1)
    expect(editDistance('abc', 'abc')).toBe(0)
    expect(editDistance('abc', 'xyz')).toBe(3)
  })
})

describe('tokenize', () => {
  const show = (s: string) => tokenize(s).map((x) => [x.text, x.kind])
  it('splits words, numbers, spaces and punctuation', () => {
    const t = tokenize('Hai 2 fratelli?')
    expect(t.map((x) => [x.text, x.kind])).toEqual([
      ['Hai', 'word'], [' ', 'space'], ['2', 'number'], [' ', 'space'], ['fratelli', 'word'], ['?', 'punct'],
    ])
    expect(t[4]!.start).toBe(6)
    expect(t[4]!.end).toBe(14)
  })
  it('splits elisions into two words', () => {
    expect(show("l'amico")).toEqual([["l'", 'word'], ['amico', 'word']])
    expect(show("dell'acqua")).toEqual([["dell'", 'word'], ['acqua', 'word']])
    expect(show("un'amica")).toEqual([["un'", 'word'], ['amica', 'word']])
    expect(show("C'è")).toEqual([["C'", 'word'], ['è', 'word']])
    expect(show("Dov'è?")).toEqual([["Dov'", 'word'], ['è', 'word'], ['?', 'punct']])
    expect(show('l’uomo')).toEqual([['l’', 'word'], ['uomo', 'word']])
    const t = tokenize("l'amico")
    expect(t[0]!.end).toBe(t[1]!.start)
  })
  it("keeps the apostrophe of po', imperatives and accent apostrophes", () => {
    expect(show("un po' di")).toEqual([['un', 'word'], [' ', 'space'], ["po'", 'word'], [' ', 'space'], ['di', 'word']])
    expect(show("Va' via!")).toEqual([["Va'", 'word'], [' ', 'space'], ['via', 'word'], ['!', 'punct']])
    expect(show("perche'")).toEqual([["perche'", 'word']])
  })
  it('does not glue quotation marks to words', () => {
    expect(show("'ciao'")).toEqual([["'", 'punct'], ['ciao', 'word'], ["'", 'punct']])
  })
})

describe('languagePack', () => {
  it('is the Italian pack', () => {
    expect(languagePack.id).toBe('it')
    expect(languagePack.locale).toBe('it-IT')
    expect(languagePack.stripMarks('città')).toBe('citta')
    expect(languagePack.comparable('Ciao')).toBe('Ciao')
    expect(languagePack.match('Ciao!', ['ciao']).verdict).toBe('correct')
  })
})
