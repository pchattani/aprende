import { describe, it, expect } from 'vitest'
import { normalize, stripAccents, match, words, editDistance, elides } from '@/lang/fr/normalize'
import { tokenize } from '@/lang/fr/tokenize'
import { languagePack } from '@/lang/fr/index'

describe('stripAccents', () => {
  it('removes accents, the cedilla and the diaeresis', () => {
    expect(stripAccents('été')).toBe('ete')
    expect(stripAccents('très, déjà, où, là')).toBe('tres, deja, ou, la')
    expect(stripAccents('ça, garçon, français')).toBe('ca, garcon, francais')
    expect(stripAccents('forêt, hôpital, île, août, être')).toBe('foret, hopital, ile, aout, etre')
    expect(stripAccents('Noël, naïf, maïs, aiguë, L’Haÿ')).toBe('Noel, naif, mais, aigue, L’Hay')
    expect(stripAccents('ÉCOLE À PARIS')).toBe('ECOLE A PARIS')
  })
  it('spells out the ligatures', () => {
    expect(stripAccents('cœur, œuf, sœur, Œuvre, ex æquo')).toBe('coeur, oeuf, soeur, Oeuvre, ex aequo')
  })
})

describe('normalize', () => {
  it('lowercases, strips punctuation and collapses spaces', () => {
    expect(normalize('Comment   allez-vous ?')).toBe('comment allez vous')
    expect(normalize('Bonjour, Marie !')).toBe('bonjour marie')
    expect(normalize('  Le  garçon.  ')).toBe('le garçon')
    expect(normalize('« Allons-y », dit-il.')).toBe('allons y dit il')
    expect(normalize('Il a dit : « non ».')).toBe('il a dit non')
  })
  it('ignores French spacing before ; : ! ? and inside « »', () => {
    expect(normalize('Vraiment ?')).toBe('vraiment')
    expect(normalize('Attention : « danger » !')).toBe('attention danger')
    expect(normalize('Oui ; non')).toBe('oui non')
  })
  it('keeps elisions as one word, with any apostrophe', () => {
    expect(normalize("L'ami de l'école")).toBe("l'ami de l'école")
    expect(normalize('L’amie')).toBe("l'amie")
    expect(normalize('J‘ai')).toBe("j'ai")
    expect(normalize("C'est qu'il est là")).toBe("c'est qu'il est là")
    expect(normalize("l' ami")).toBe("l'ami")
    expect(normalize("qu' il")).toBe("qu'il")
    expect(normalize("Jusqu'à demain, lorsqu'il viendra, puisqu'on part")).toBe("jusqu'à demain lorsqu'il viendra puisqu'on part")
    expect(normalize("Aujourd'hui, quelqu'un")).toBe("aujourd'hui quelqu'un")
  })
  it('drops quote marks', () => {
    expect(normalize("Il a dit 'bonjour'.")).toBe('il a dit bonjour')
  })
  it('treats hyphens as spaces', () => {
    expect(normalize('Est-ce que tu viens ?')).toBe('est ce que tu viens')
    expect(normalize('peut-être')).toBe('peut être')
    expect(normalize('dix-sept')).toBe('dix sept')
    expect(normalize('A-t-il fini ?')).toBe('a t il fini')
  })
  it('folds ligatures and optionally strips accents', () => {
    expect(normalize('Mon cœur')).toBe('mon coeur')
    expect(normalize('Où est la forêt ?', { accentInsensitive: true })).toBe('ou est la foret')
  })
})

describe('match', () => {
  it('accepts exact answers ignoring case and punctuation', () => {
    expect(match('bonjour, comment ça va?', ['Bonjour, comment ça va ?']).verdict).toBe('correct')
    expect(match("L'ami est là", ["L'ami est là."]).verdict).toBe('correct')
    expect(match("l' ami est là", ["L'ami est là."]).verdict).toBe('correct')
    expect(match('C’est vrai', ["C'est vrai."]).verdict).toBe('correct')
    expect(match('Vraiment ?', ['Vraiment ?']).verdict).toBe('correct')
  })
  it('treats œ/oe and æ/ae as the same', () => {
    expect(match("J'ai mal au coeur", ["J'ai mal au cœur."]).verdict).toBe('correct')
    expect(match('un oeuf', ['un œuf']).verdict).toBe('correct')
    expect(match('ex aequo', ['ex æquo']).verdict).toBe('correct')
  })
  it('accepts hyphen or space', () => {
    expect(match('Est ce que tu viens', ['Est-ce que tu viens ?']).verdict).toBe('correct')
  })
  it('flags accent-only mistakes as almost with a note', () => {
    const r = match('ou est le cafe', ['Où est le café ?'])
    expect(r.verdict).toBe('almost')
    expect(r.reason).toBe('accents')
    expect(r.notes.join(' ')).toMatch(/où/)
    expect(match('je vais a paris', ['Je vais à Paris.']).reason).toBe('accents')
    expect(match('il est la', ['Il est là.']).notes[0]).toMatch(/there/)
    expect(match('un garcon francais', ['un garçon français']).reason).toBe('accents')
    expect(match('tres', ['très']).verdict).toBe('almost')
    expect(match('hopital', ['hôpital']).verdict).toBe('almost')
    expect(match('noel', ['Noël']).verdict).toBe('almost')
    expect(match('élève', ['élève']).verdict).toBe('correct')
    expect(match('éléve', ['élève']).reason).toBe('accents')
  })
  it('tolerates one typo in a long word only', () => {
    expect(match('je vais à la bibliotèque', ['Je vais à la bibliothèque']).verdict).toBe('almost')
    expect(match('je vais à la bibliotèque', ['Je vais à la bibliothèque']).reason).toBe('typo')
    expect(match('la bibioteque', ['la bibliothèque']).verdict).toBe('wrong') // two edits
    expect(match('le chat est noire', ['Le chat est noir']).verdict).toBe('wrong') // agreement, not a typo
    expect(match('la fille est petit', ['La fille est petite']).verdict).toBe('wrong')
    expect(match('je parles', ['Je parle']).verdict).toBe('wrong')
    expect(match('les amis', ['les ami']).verdict).toBe('wrong')
  })
  it('rejects wrong answers and empty input', () => {
    expect(match('', ['Bonjour']).verdict).toBe('wrong')
    expect(match('au revoir', ['Bonjour']).verdict).toBe('wrong')
  })
})

describe('words', () => {
  it('splits a sentence into tiles, keeping elisions, hyphens and ligatures', () => {
    expect(words("L'ami de Marie est à l'école.")).toEqual(["l'ami", 'de', 'marie', 'est', 'à', "l'école"])
    expect(words("Qu'est-ce que c'est ?")).toEqual(["qu'est-ce", 'que', "c'est"])
    expect(words('Mon cœur, peut-être.')).toEqual(['mon', 'cœur', 'peut-être'])
    expect(words('« Allons-y » — dit-elle')).toEqual(['allons-y', 'dit-elle'])
    expect(words('Aujourd’hui')).toEqual(["aujourd'hui"])
  })
})

describe('elides', () => {
  it('knows vowels, silent h and aspirated h', () => {
    for (const w of ['ami', 'école', 'hôtel', 'homme', 'habiter', 'heure', 'Yves', 'œuf', 'île']) expect(elides(w), w).toBe(true)
    for (const w of ['livre', 'héros', 'haricot', 'honte', 'hibou', 'onze', 'oui', 'yaourt', 'hais', 'huit']) expect(elides(w), w).toBe(false)
  })
})

describe('editDistance', () => {
  it('counts transpositions as one edit', () => {
    expect(editDistance('chat', 'caht')).toBe(1)
    expect(editDistance('abc', 'abc')).toBe(0)
  })
})

describe('tokenize', () => {
  const show = (s: string) => tokenize(s).map((x) => [x.text, x.kind])
  const wordsOf = (s: string) => tokenize(s).filter((x) => x.kind === 'word').map((x) => x.text)
  it('splits words, numbers, spaces and punctuation', () => {
    const t = tokenize('Tu as 2 frères ?')
    expect(t.map((x) => [x.text, x.kind])).toEqual([
      ['Tu', 'word'], [' ', 'space'], ['as', 'word'], [' ', 'space'], ['2', 'number'], [' ', 'space'], ['frères', 'word'], [' ', 'space'], ['?', 'punct'],
    ])
    expect(t[6]!.start).toBe(8)
    expect(t[6]!.end).toBe(14)
  })
  it('splits elisions into two words', () => {
    expect(show("l'ami")).toEqual([["l'", 'word'], ['ami', 'word']])
    expect(show("J'ai")).toEqual([["J'", 'word'], ['ai', 'word']])
    expect(show('qu’il')).toEqual([['qu’', 'word'], ['il', 'word']])
    expect(wordsOf("C'est jusqu'à lorsqu'il s'en va, puisqu'on n'a d'eau")).toEqual(["C'", 'est', "jusqu'", 'à', "lorsqu'", 'il', "s'", 'en', 'va', "puisqu'", 'on', "n'", 'a', "d'", 'eau'])
    const t = tokenize("l'ami")
    expect(t[0]!.end).toBe(t[1]!.start)
  })
  it('keeps aujourd’hui, quelqu’un and presqu’île whole', () => {
    expect(wordsOf("Aujourd'hui quelqu'un est sur la presqu'île")).toEqual(["Aujourd'hui", "quelqu'un", 'est', 'sur', 'la', "presqu'île"])
  })
  it('keeps hyphenated compounds whole', () => {
    expect(wordsOf('peut-être grand-mère dix-sept quatre-vingt-dix vingt-et-un')).toEqual(['peut-être', 'grand-mère', 'dix-sept', 'quatre-vingt-dix', 'vingt-et-un'])
    expect(wordsOf('celui-ci là-bas jusque-là week-end')).toEqual(['celui-ci', 'là-bas', 'jusque-là', 'week-end'])
    expect(wordsOf("arc-en-ciel rendez-vous c'est-à-dire Aix-en-Provence")).toEqual(['arc-en-ciel', 'rendez-vous', "c'est-à-dire", 'Aix-en-Provence'])
  })
  it('splits pronouns after a hyphen (inversion, imperatives)', () => {
    expect(show('est-ce que')).toEqual([['est', 'word'], ['-', 'punct'], ['ce', 'word'], [' ', 'space'], ['que', 'word']])
    expect(wordsOf('Parlez-vous français ? Donne-le-moi. Allez-y ! Vas-y.')).toEqual(['Parlez', 'vous', 'français', 'Donne', 'le', 'moi', 'Allez', 'y', 'Vas', 'y'])
    expect(show('a-t-il')).toEqual([['a', 'word'], ['-t-', 'punct'], ['il', 'word']])
    expect(wordsOf('Y a-t-il quelqu’un ? Va-t-elle venir ?')).toEqual(['Y', 'a', 'il', 'quelqu’un', 'Va', 'elle', 'venir'])
    expect(wordsOf("Va-t'en ! Allez-vous-en.")).toEqual(['Va', "t'", 'en', 'Allez', 'vous', 'en'])
    expect(wordsOf('ce livre-ci, cette fois-là')).toEqual(['ce', 'livre', 'ci', 'cette', 'fois', 'là'])
  })
  it('does not glue quotation marks to words', () => {
    expect(show("'salut'")).toEqual([["'", 'punct'], ['salut', 'word'], ["'", 'punct']])
  })
})

describe('languagePack', () => {
  it('is the French pack', () => {
    expect(languagePack.id).toBe('fr')
    expect(languagePack.locale).toBe('fr-FR')
    expect(languagePack.stripMarks('été')).toBe('ete')
    expect(languagePack.comparable('Salut')).toBe('Salut')
    expect(languagePack.match('Salut !', ['salut']).verdict).toBe('correct')
    expect(languagePack.words("C'est l'été")).toEqual(["c'est", "l'été"])
  })
})
