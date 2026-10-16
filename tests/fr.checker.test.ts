import { describe, it, expect } from 'vitest'
import { check, definiteArticle, indefiniteArticle, demonstrative, possessive, articulate, explainAccent } from '@/lang/fr/checker'
import { buildDictionary } from '@/lang/fr/inflect'
import { IRREGULAR } from '@/lang/fr/verbs'
import type { VocabEntry, ErrorRule } from '@/engine/schema'

const V = (lemma: string, pos: VocabEntry['pos'], extra: Partial<VocabEntry> = {}): VocabEntry =>
  ({ id: `w.${lemma.replace(/[^\p{L}]+/gu, '-')}`, lemma, pos, en: ['x'], level: 'a1', tags: [], ...extra }) as VocabEntry

const entries: VocabEntry[] = [
  V('maison', 'noun', { gender: 'f' }), V('livre', 'noun', { gender: 'm' }), V('ami', 'noun', { gender: 'mf' }), V('école', 'noun', { gender: 'f' }),
  V('eau', 'noun', { gender: 'f', plural: 'eaux' }), V('homme', 'noun', { gender: 'm' }), V('hôtel', 'noun', { gender: 'm' }), V('héros', 'noun', { gender: 'm' }),
  V('fille', 'noun', { gender: 'f' }), V('garçon', 'noun', { gender: 'm' }), V('pain', 'noun', { gender: 'm' }), V('enfant', 'noun', { gender: 'mf' }),
  V('élève', 'noun', { gender: 'mf' }), V('cheval', 'noun', { gender: 'm' }), V('voiture', 'noun', { gender: 'f' }), V('chat', 'noun', { gender: 'm', feminine: 'chatte' }),
  V('marché', 'noun', { gender: 'm' }), V('heure', 'noun', { gender: 'f' }), V('porte', 'noun', { gender: 'f' }), V('cinéma', 'noun', { gender: 'm' }),
  V('blanc', 'adj'), V('grand', 'adj'), V('petit', 'adj'), V('beau', 'adj'), V('content', 'adj'), V('français', 'adj'), V('heureux', 'adj'), V('vert', 'adj'),
  V('le', 'det'), V('un', 'det'), V('ce', 'det'), V('mon', 'det'), V('de', 'prep'), V('à', 'prep'), V('en', 'prep'), V('dans', 'prep'),
  V('être', 'verb'), V('avoir', 'verb'), V('aller', 'verb'), V('manger', 'verb'), V('arriver', 'verb'), V('parler', 'verb'), V('venir', 'verb'),
  V('tomber', 'verb'), V('rester', 'verb'), V('se lever', 'verb'), V('aimer', 'verb'), V('voir', 'verb'), V('habiter', 'verb'), V('sortir', 'verb'),
  V('très', 'adv'), V('et', 'conj'), V('je', 'pron'), V('tu', 'pron'), V('il', 'pron'), V('elle', 'pron'), V('nous', 'pron'), V('vous', 'pron'),
  V('ils', 'pron'), V('elles', 'pron'), V('hier', 'adv'), V('ici', 'adv'), V('vrai', 'adj'), V('ne', 'adv'), V('pas', 'adv'), V('que', 'conj'),
  V('où', 'adv'), V('ou', 'conj'), V('déjà', 'adv'), V('demain', 'adv'), V('si', 'conj'), V('se', 'pron'), V('me', 'pron'), V('ouvert', 'adj'),
]
const rules: ErrorRule[] = [
  { id: 'etre-age', pattern: "\\b(suis|es|est|sommes|êtes|sont) \\d+ ans\\b", message: 'Age uses avoir.', level: 'a1', example: { wrong: "je suis 20 ans", right: "j'ai 20 ans" } },
]
const deps = { dict: buildDictionary(entries, IRREGULAR), rules, verbs: IRREGULAR }
const codes = (t: string) => check(t, deps).map((f) => f.code)
const find = (t: string, code: string) => check(t, deps).find((f) => f.code === code)

describe('article helpers', () => {
  it('chooses the article', () => {
    expect(definiteArticle('m', 'sg', 'livre')).toBe('le')
    expect(definiteArticle('f', 'sg', 'maison')).toBe('la')
    expect(definiteArticle('m', 'sg', 'ami')).toBe("l'")
    expect(definiteArticle('f', 'sg', 'école')).toBe("l'")
    expect(definiteArticle('m', 'sg', 'hôtel')).toBe("l'")
    expect(definiteArticle('m', 'sg', 'héros')).toBe('le')
    expect(definiteArticle('f', 'pl', 'maisons')).toBe('les')
    expect(indefiniteArticle('m')).toBe('un')
    expect(indefiniteArticle('f')).toBe('une')
    expect(indefiniteArticle('f', 'pl')).toBe('des')
    expect(demonstrative('m', 'sg', 'livre')).toBe('ce')
    expect(demonstrative('m', 'sg', 'homme')).toBe('cet')
    expect(demonstrative('f', 'sg', 'école')).toBe('cette')
    expect(demonstrative('m', 'pl', 'livres')).toBe('ces')
    expect(possessive('m', 'f', 'sg', 'maison')).toBe('ma')
    expect(possessive('m', 'f', 'sg', 'amie')).toBe('mon')
    expect(possessive('t', 'm', 'sg', 'livre')).toBe('ton')
    expect(possessive('s', 'f', 'pl', 'amies')).toBe('ses')
    expect(articulate('de', 'le')).toBe('du')
    expect(articulate('de', 'les')).toBe('des')
    expect(articulate('à', 'le')).toBe('au')
    expect(articulate('à', 'les')).toBe('aux')
    expect(articulate('de', 'la')).toBe('de la')
    expect(articulate('à', "l'")).toBe("à l'")
  })
  it('explains accents', () => {
    expect(explainAccent('ça')).toMatch(/cedilla/)
    expect(explainAccent('forêt')).toMatch(/circumflex/)
    expect(explainAccent('très')).toMatch(/grave/)
    expect(explainAccent('été')).toMatch(/acute/)
    expect(explainAccent('Noël')).toMatch(/diaeresis/)
    expect(explainAccent('à')).toMatch(/homophones/)
  })
})

describe('checker', () => {
  it('accepts correct sentences', () => {
    expect(check('La maison est très grande.', deps)).toEqual([])
    expect(check("L'ami de Marie mange un pain.", deps)).toEqual([])
    expect(check("Les enfants sont allés à l'école.", deps)).toEqual([])
    expect(check("Elle est arrivée hier.", deps)).toEqual([])
    expect(check("Cet homme et cette fille sont français.", deps)).toEqual([])
    expect(check("Mon amie habite dans un bel hôtel.", deps)).toEqual([])
    expect(check("Je me suis levé et je suis sorti.", deps)).toEqual([])
    expect(check("Le héros boit de l'eau.", deps).filter((f) => f.code !== 'unknown')).toEqual([])
  })
  it('flags wrong article forms (l\', cet, mon amie)', () => {
    expect(find("Le ami est ici.", 'article')?.suggestion).toBe("l'")
    expect(find("La école est grande.", 'article')?.suggestion).toBe("l'")
    expect(find("L'héros", 'article')?.suggestion).toBe('le')
    expect(find("Ce homme est grand.", 'article')?.suggestion).toBe('cet')
    expect(find("Cet livre", 'article')?.suggestion).toBe('ce')
    expect(find("Ma amie est ici.", 'article')?.suggestion).toBe('mon')
    expect(find("Ma amie est ici.", 'article')?.message).toMatch(/mon amie/)
    expect(codes('Mon amie est contente.')).toEqual([])
  })
  it('flags contractions: de le → du, à le → au, à les → aux', () => {
    expect(find('Je vais à le marché.', 'article')?.suggestion).toBe('au')
    expect(find('Il mange de le pain.', 'article')?.suggestion).toBe('du')
    expect(find('Je parle à les enfants.', 'article')?.suggestion).toBe('aux')
    expect(codes('Je vais au marché.')).toEqual([])
    expect(codes("Je vais à l'école.")).toEqual([])
  })
  it('flags article and adjective agreement', () => {
    expect(find('Le maison', 'agreement')?.suggestion).toBe('la')
    expect(find('Un voiture', 'agreement')?.suggestion).toBe('une')
    expect(find('Les livre', 'agreement')).toBeDefined()
    expect(find('Mon maison', 'agreement')?.suggestion).toBe('ma')
    expect(find('Cette homme', 'agreement')?.suggestion).toBe('cet')
    expect(find('Du eau', 'agreement')?.suggestion).toBe("de l'")
    expect(find('Il mange de la pain.', 'agreement')?.suggestion).toBe('du')
    expect(check('La maison blanc', deps).filter((f) => f.code === 'agreement')).toHaveLength(1)
    expect(check('Le maison blanc', deps).filter((f) => f.code === 'agreement')).toHaveLength(2)
    expect(codes('Une grand maison')).toContain('agreement')
    expect(codes('Les voitures vert')).toContain('agreement')
    expect(codes('Les voitures vertes')).toEqual([])
    expect(codes('Un élève, une élève, les élèves')).toEqual([])
    expect(codes('La chatte et le chat')).toEqual([])
  })
  it('flags predicate adjectives and participles that do not agree', () => {
    expect(codes('La maison est blanc.')).toContain('agreement')
    expect(codes('La maison est blanche.')).toEqual([])
    expect(codes('Les livres sont grand.')).toContain('agreement')
    expect(codes("La porte n'est pas ouvert.")).toContain('agreement')
    expect(codes("La porte n'est pas ouverte.")).toEqual([])
    expect(find('Elle est content.', 'agreement')?.suggestion).toBe('contente')
    expect(find('Elle est allé au cinéma.', 'agreement')?.suggestion).toBe('allée')
    expect(find('Ils sont arrivé hier.', 'agreement')?.suggestion).toBe('arrivés')
    expect(codes('Nous sommes content.')).toContain('agreement')
    expect(codes('Nous sommes contentes.')).toEqual([])
    expect(codes('Vous êtes content ?')).toEqual([])
    expect(codes('Je suis contente.')).toEqual([])
    expect(codes('Elle est très heureuse.')).toEqual([])
  })
  it('flags missing accents', () => {
    const f = check('Le garcon est tres content.', deps)
    expect(f.filter((x) => x.code === 'accent').map((x) => x.suggestion)).toEqual(['garçon', 'très'])
    expect(f[0]!.message).toMatch(/cedilla/)
    expect(find('Il habite ou ?', 'accent')).toBeUndefined()
    expect(find("C'est deja fait.", 'accent')?.suggestion).toBe('déjà')
    expect(find("L'ecole", 'accent')?.suggestion).toBe('école')
  })
  it('flags a, ou, la, sur that need an accent', () => {
    expect(find('Je vais a Paris.', 'accent')?.suggestion).toBe('à')
    expect(find('A demain !', 'accent')).toBeUndefined() // capital A is tolerated
    expect(find('a demain !', 'accent')?.suggestion).toBe('à')
    expect(find("Il parle jusqu'a demain.", 'accent')?.suggestion).toBe('à')
    expect(find('Ou est la maison ?', 'accent')?.suggestion).toBe('où')
    expect(find('Il est la.', 'accent')?.suggestion).toBe('là')
    expect(find('Oui, bien sur.', 'accent')?.suggestion).toBe('sûr')
    expect(codes('Il a un livre.')).toEqual([])
    expect(codes('Elle a mangé.')).toEqual([])
    expect(codes('Un livre ou une maison ?')).toEqual([])
    expect(codes('Il voit la maison.')).toEqual([])
  })
  it('flags missing elision', () => {
    expect(find('Je aime le pain.', 'elision')?.suggestion).toBe("j'aime")
    expect(find('Je habite ici.', 'elision')?.suggestion).toBe("j'habite")
    expect(find("Je ne ai pas de pain.", 'elision')?.suggestion).toBe("n'ai")
    expect(find('Je pense que il vient.', 'elision')?.suggestion).toBe("qu'il")
    expect(find('Si il vient', 'elision')?.suggestion).toBe("s'il")
    expect(find('Ce est vrai.', 'elision')?.suggestion).toBe("c'est")
    expect(find('Je le aime.', 'elision')?.suggestion).toBe("l'aime")
    expect(codes('Si elle vient, je mange.')).toEqual([])
    expect(codes('Je mange le héros.').filter((c) => c === 'elision')).toEqual([])
  })
  it('flags avoir with an être verb', () => {
    const a = find("J'ai allé au cinéma.", 'auxiliary')
    expect(a?.suggestion).toBe('je suis allé')
    expect(a?.message).toMatch(/être/)
    expect(find('Nous avons arrivé hier.', 'auxiliary')?.suggestion).toBe('sommes arrivés')
    expect(find('Il a déjà tombé.', 'auxiliary')?.suggestion).toBe('est déjà tombé')
    expect(find("Je n'ai pas resté.", 'auxiliary')?.suggestion).toBe('ne suis pas resté')
    expect(find("Elle s'a levée.", 'auxiliary')?.suggestion).toBe("s'est levée")
    expect(codes("J'ai mangé un pain.")).toEqual([])
    expect(codes("J'ai sorti le livre.")).toEqual([]) // sortir takes avoir with an object
    expect(codes("J'ai été content.")).toEqual([])
  })
  it('flags subject–verb agreement', () => {
    const v = find('Je parles français.', 'verb-agreement')
    expect(v?.suggestion).toBe('parle')
    expect(find('Tu parle français.', 'verb-agreement')?.suggestion).toBe('parles')
    expect(find('Ils parle français.', 'verb-agreement')?.suggestion).toBe('parlent')
    expect(find('Nous a un livre.', 'verb-agreement')?.suggestion).toBe('avons')
    expect(find('Je es content.', 'verb-agreement')?.suggestion).toBe('suis')
    expect(codes("Je ne t'aime pas.")).not.toContain('verb-agreement')
    expect(codes('Elle et moi parlons.')).not.toContain('verb-agreement')
    expect(codes('Il nous voit.')).not.toContain('verb-agreement')
    expect(codes('Je vous aime.')).not.toContain('verb-agreement')
    expect(codes('Parlez-vous français ?')).not.toContain('verb-agreement')
  })
  it('applies learner-error rules', () => {
    expect(codes('Je suis 20 ans.')).toContain('learner-error')
  })
  it('suggests spelling fixes and reports unknown words', () => {
    expect(find('La miason est grande.', 'spelling')?.suggestion).toBe('maison')
    expect(codes('La maison est xyzzy.')).toContain('unknown')
    expect(codes('Il est Marc.')).toEqual([])
  })
  it('knows elided words and hyphenated pronouns', () => {
    expect(check("L'eau est ici.", deps)).toEqual([])
    expect(check("J'aime l'école.", deps)).toEqual([])
    expect(check('Lève-toi !', deps).filter((f) => f.code !== 'unknown')).toEqual([])
    expect(check("Où est l'hôtel ?", deps)).toEqual([])
  })
})

describe('no false positives on correct French', () => {
  const more = [
    ...entries, V('serveur', 'noun', { gender: 'm', feminine: 'serveuse' }), V('gentil', 'adj'), V('taxi', 'noun', { gender: 'm' }), V('prêt', 'adj'),
    V('week-end', 'noun', { gender: 'm' }), V('travailler', 'verb'), V('porter', 'verb'), V('chef', 'noun', { gender: 'm' }), V('payer', 'verb'),
    V('dîner', 'noun', { gender: 'm' }), V('préparer', 'verb'), V('café', 'noun', { gender: 'm' }), V('parc', 'noun', { gender: 'm' }), V('près', 'adv'),
    V('chemise', 'noun', { gender: 'f' }), V('bleu', 'adj'), V('clair', 'adj'), V('marron', 'adj'), V('chaussure', 'noun', { gender: 'f' }),
    V('long', 'adj'), V('rue', 'noun', { gender: 'f' }), V('heureusement', 'adv'), V('connaître', 'verb'), V('savoir', 'verb'), V('Paris', 'noun', { gender: 'm' }),
    V('vouloir', 'verb'), V('pouvoir', 'verb'), V('faire', 'verb'), V('prendre', 'verb'), V('train', 'noun', { gender: 'm' }), V('gare', 'noun', { gender: 'f' }),
    V('y', 'pron'), V('il y a', 'phrase'), V('pomme de terre', 'noun', { gender: 'f' }), V('aujourd’hui', 'adv'), V('quelqu’un', 'pron'),
    V('peut-être', 'adv'), V('grand-mère', 'noun', { gender: 'f' }), V('dire', 'verb'), V('donner', 'verb'), V('moi', 'pron'), V('lui', 'pron'),
    V('fermer', 'verb'), V('ferme', 'noun', { gender: 'f' }), V('mal', 'adv'), V('pour', 'prep'), V('avec', 'prep'), V('fatigué', 'adj'),
    V('fleur', 'noun', { gender: 'f' }), V('acheter', 'verb'), V('jardin', 'noun', { gender: 'm' }), V('à côté de', 'phrase'), V('on', 'pron'),
    V('table', 'noun', { gender: 'f' }), V('sur', 'prep'), V('mettre', 'verb'), V('tout', 'det'), V('monde', 'noun', { gender: 'm' }), V('chez', 'prep'),
    V('vin', 'noun', { gender: 'm' }), V('rouge', 'adj'), V('boire', 'verb'), V('nouveau', 'adj'), V('appartement', 'noun', { gender: 'm' }),
    V('vieux', 'adj'), V('arbre', 'noun', { gender: 'm' }), V('femme', 'noun', { gender: 'f' }), V('médecin', 'noun', { gender: 'm' }), V('lire', 'verb'),
    V('quand', 'conj'), V('pluie', 'noun', { gender: 'f' }), V('pleuvoir', 'verb'), V('falloir', 'verb'), V('partir', 'verb'), V('tôt', 'adv'),
    V('mais', 'conj'), V('passer', 'verb'), V('soirée', 'noun', { gender: 'f' }), V('bon', 'adj'), V('idée', 'noun', { gender: 'f' }),
    V('assez', 'adv'), V('plein', 'adj'), V('gens', 'noun', { gender: 'm', plural: 'gens' }), V('français', 'noun', { gender: 'm' }),
    V('parce que', 'phrase'), V('étudiant', 'noun', { gender: 'mf' }), V('venir de', 'phrase'), V('Lyon', 'noun', { gender: 'm' }),
    V('gagner', 'verb'), V('maintenant', 'adv'), V('vendre', 'verb'), V("s'il te plaît", 'phrase'), V('huit', 'num'), V('parent', 'noun', { gender: 'm' }),
    V('lettre', 'noun', { gender: 'f' }), V('écrire', 'verb'), V('envoyer', 'verb'), V('appeler', 'verb'), V("s'appeler", 'verb'),
    V('boisson', 'noun', { gender: 'f' }), V('vue', 'noun', { gender: 'f' }), V('voir', 'verb'), V('magnifique', 'adj'), V('plage', 'noun', { gender: 'f' }),
    V('calme', 'adj'), V('élève', 'noun', { gender: 'mf' }), V('trente', 'num'), V('air', 'noun', { gender: 'm' }), V('avoir', 'verb'), V('mariage', 'noun', { gender: 'm' }),
    V('lieu', 'noun', { gender: 'm' }), V('sympa', 'adj', { feminine: 'sympa' }), V('sœur', 'noun', { gender: 'f' }), V('quel', 'det'),
  ]
  const d2 = { dict: buildDictionary(more, IRREGULAR), rules: [], verbs: IRREGULAR }
  const ok = (t: string) => expect(check(t, d2).filter((f) => f.code !== 'unknown'), t).toEqual([])
  const sentences = [
    'Quelle boisson tu prends ?',
    'Cette vue est magnifique.',
    'Quelle est la plage la plus calme ?',
    'Il y a trente et un élèves.',
    'Elle a l\'air fatiguée.',
    'Le mariage a eu lieu à Paris.',
    'Ta sœur est très sympa.',
    'Le serveur est très gentil.',
    'Voici le taxi ! Tu es prête ?',
    'Le week-end, je ne travaille pas.',
    'Ce livre ? Je le porte, moi.',
    'Le chef est français.',
    "Si je gagne, c'est toi qui paies le dîner.",
    'Il prépare le café ; elle met la table.',
    "L'école des enfants est près du parc.",
    'Je voudrais une chemise bleu clair.',
    'Elle porte des chaussures marron.',
    'Paris est grand.',
    'Lui et elle ! Et maintenant ?',
    'La rue est longue, mais heureusement, j’arrive.',
    'Je la vois et je les aime.',
    "Je l'ai vue hier.",
    "Je leur parle, et ils me disent que la maison est à vendre.",
    'Est-ce que tu connais Marie ? Oui, je la connais.',
    "Qu'est-ce que tu veux faire aujourd'hui ?",
    "Il y a quelqu'un à la porte.",
    'Peut-être que ma grand-mère viendra.',
    'Donne-le-moi, s’il te plaît !',
    'Allez-y, prenez le train de huit heures.',
    'A-t-il pris le train ? Oui, il est parti tôt.',
    'Nous sommes allés au parc avec les enfants.',
    'Elles sont arrivées à la gare.',
    'Vous êtes fatiguée ?',
    'La ferme est fermée.',
    'Ils ferment la porte.',
    "Tout le monde est content.",
    'Mon ami et mon amie boivent du vin rouge.',
    'Un nouvel appartement, un vieil arbre, un bel homme.',
    'Cette femme est médecin.',
    'Quand il pleut, il faut partir tôt.',
    "J'ai passé une bonne soirée.",
    "C'est une bonne idée, mais je suis fatigué.",
    'La maison de mes parents est grande.',
    "Il est plein d'idées.",
    "Les gens sont gentils parce qu'ils sont heureux.",
    'Je viens de Lyon.',
    "Je t'écris une lettre et je l'envoie demain.",
    "Elle s'appelle Marie et il s'appelle Paul.",
    'Je mange des pommes de terre.',
    'Nous nous sommes levés tôt.',
    "Elle s'est levée tôt.",
    "Où vas-tu ? Je vais à l'hôtel.",
    "On est allés chez Paul.",
  ]
  it(`accepts ${sentences.length} correct sentences`, () => {
    expect(sentences.length).toBeGreaterThanOrEqual(20)
    for (const s of sentences) ok(s)
  })
  const harder = [...more, V('partout', 'adv'), V('tard', 'adv'), V('peu', 'adv'), V('soir', 'noun', { gender: 'm' }), V('penser', 'verb'), V('court', 'adj'),
    V('laver', 'verb'), V('main', 'noun', { gender: 'f' }), V('bien', 'adv'), V('téléphone', 'noun', { gender: 'm' }), V('midi', 'noun', { gender: 'm' }),
    V('voisin', 'noun', { gender: 'mf' }), V('gris', 'adj'), V('classe', 'noun', { gender: 'f' }), V('malade', 'adj'), V('seul', 'adj'), V('parent', 'noun', { gender: 'm' }),
    V('chose','noun',{gender:'f'}), V('dont','pron'), V('qui','pron'), V('ville','noun',{gender:'f'}), V('beaucoup','adv'), V('temps','noun',{gender:'m'}), V('trouver','verb'), V('difficile','adj'), V('important','adj'), V('nécessaire','adj'), V('il faut','phrase'), V('rien','pron'), V('personne','noun',{gender:'f'}), V('jamais','adv'), V('plus','adv'), V('encore','adv'), V('frère','noun',{gender:'m'}), V('sœur','noun',{gender:'f'}), V('cuisine','noun',{gender:'f'}), V('lui','pron'), V('leur','pron'), V('son','det'), V('sa','det'), V('notre','det'), V('votre','det'), V('quel','det'), V('chaque','det'), V('jour','noun',{gender:'m'}), V('semaine','noun',{gender:'f'}), V('dernier','adj'), V('prochain','adj'), V('chien','noun',{gender:'m',feminine:'chienne'}), V('noir','adj'), V('courir','verb'), V('vite','adv'), V('rentrer','verb'), V('mère','noun',{gender:'f'}), V('père','noun',{gender:'m'}), V('voyage','noun',{gender:'m'}), V('voyager','verb'), V('Québec','noun',{gender:'m'}), V('France','noun',{gender:'f'}), V('pays','noun',{gender:'m'}), V('été','noun',{gender:'m'}), V('hiver','noun',{gender:'m'}), V('froid','adj'), V('chaud','adj'), V('faire froid','phrase'), V('devoir','verb'), V('nouvelle','noun',{gender:'f'}), V('chanson','noun',{gender:'f'}), V('chanter','verb'), V('fort','adv'), V('premier','adj'), V('fois','noun',{gender:'f'}), V('mieux','adv'), V('ça','pron'), V('cela','pron'), V('comme','conj'), V('dès que','phrase'), V('lorsque','conj'), V('puisque','conj'), V('jusque','prep'), V('après','prep'), V('avant','prep'), V('pendant','prep'), V('depuis','prep'), V('an','noun',{gender:'m'}), V('année','noun',{gender:'f'}), V('deux','num'), V('trois','num'), V('vacances','noun',{gender:'f',plural:'vacances'}), V('plage','noun',{gender:'f'}), V('mer','noun',{gender:'f'}), V('regarder','verb'), V('film','noun',{gender:'m'}), V('intéressant','adj'), V('ennuyeux','adj'), V('trop','adv'), V('cher','adj'), V('coûter','verb'), V('euro','noun',{gender:'m'}), V('combien','adv'), V('pourquoi','adv'), V('comment','adv'), V('question','noun',{gender:'f'}), V('réponse','noun',{gender:'f'}), V('répondre','verb'), V('demander','verb'), V('fenêtre','noun',{gender:'f'}), V('ouvrir','verb'), V('seul','adj'), V('ensemble','adv'), V('lait','noun',{gender:'m'}), V('fromage','noun',{gender:'m'}), V('sans','prep'), V('entre','prep'), V('vers','prep'), V('loin','adv'), V('content','adj'), V('pouvoir','verb'), V('rire','verb'), V('autre','det'), V('même','adj'), V('aider','verb'), V('perdre','verb'), V('clé','noun',{gender:'f'}), V('chercher','verb'), V('bureau','noun',{gender:'m'}), V('travail','noun',{gender:'m'}), V('fini','adj'), V('finir','verb'), V('naître','verb'), V('mourir','verb'), V('devenir','verb'), V('célèbre','adj'), V('écrivain','noun',{gender:'m'}), V('petite','noun',{gender:'f'}), V('dommage','noun',{gender:'m'}), V('possible','adj')]
  const d3 = { dict: buildDictionary(harder, IRREGULAR), rules: [], verbs: IRREGULAR }
  const harderSentences = [
  "C'est la première fois que je viens en France.",
  "Il fait froid en hiver et chaud en été.",
  "Les vacances sont trop courtes.",
  "Elle a perdu ses clés ; elle les cherche partout.",
  "Combien coûte ce fromage ? Deux euros.",
  "Pourquoi est-ce que tu ris ?",
  "Ma mère et mon père sont rentrés tard.",
  "Le chien noir court vite.",
  "La chienne de mon frère est très gentille.",
  "Chaque jour, je lis un peu.",
  "Quelle chanson chante-t-elle ?",
  "Quel film regardez-vous ce soir ?",
  "La semaine dernière, nous avons voyagé au Québec.",
  "Notre maison est loin de la ville.",
  "Il est important de répondre à la question.",
  "Il est difficile de trouver un appartement.",
  "Je n'ai jamais vu ce film.",
  "Je ne mange plus de fromage.",
  "Il n'y a rien dans la cuisine.",
  "Elle lui a donné une fleur.",
  "Nous leur avons demandé de venir.",
  "Les enfants, venez manger !",
  "Elle est devenue célèbre.",
  "Victor Hugo est né en France.",
  "Ouvre la fenêtre, s'il te plaît.",
  "Je pense que c'est possible.",
  "Ses parents sont partis en vacances.",
  "Sa sœur est seule à la maison.",
  "Il a fini son travail et il est rentré.",
  "Ils se sont levés tôt pour aller à la plage.",
  "Elle s'est lavé les mains.",
  "La fille que j'ai vue hier est la sœur de Paul.",
  "Les fleurs que tu m'as données sont belles.",
  "Depuis deux ans, j'habite à Paris.",
  "Ce film est plus intéressant que l'autre.",
  "Il est trop cher pour moi.",
  "C'est dommage !",
  "Ça va ? Oui, ça va bien.",
  "Je veux qu'elle vienne avec nous.",
  "Il faut que nous partions.",
  "Est-ce qu'il pleut ?",
  "Il y a trois ans, je suis allé à la mer.",
  "J'ai lu le livre dont tu m'as parlé.",
  "Elles se sont parlé au téléphone.",
  "Mes amis et moi sommes contents.",
  "Le lait est dans la cuisine, à côté du fromage.",
  "Vous êtes allés au cinéma ?",
  "Il m'a vu, et je l'ai aidé.",
  "Ils ont couru jusqu'à la gare.",
  "Cette année, l'été est chaud.",
  "On va au cinéma ce soir ?",
  "Nous, on mange ensemble.",
  "C'est à moi de payer.",
  "Il est midi.",
  "Le chat de la voisine est gris.",
  "La porte du bureau est ouverte.",
  "Les élèves de la classe sont contents.",
  "Je me demande pourquoi il est parti.",
  "Tu es allée où ?",
  "Je vais à la maison de ma grand-mère.",
  "A Paris, il pleut.",
  "Ma petite est malade.",
]
  it(`accepts ${harderSentences.length} harder correct sentences (negation, pronouns, relatives, inversion, subjunctive)`, () => {
    for (const s of harderSentences) expect(check(s, d3).filter((f) => f.code !== 'unknown'), s).toEqual([])
  })
  it('still catches the real mistakes with the bigger dictionary', () => {
    expect(check('Le serveuse est gentille.', d2).map((f) => f.code)).toContain('agreement')
    expect(check('La taxi est prêt.', d2).map((f) => f.code)).toContain('agreement')
    expect(check('Le livre est blanche.', d2).map((f) => f.code)).toContain('agreement')
    expect(check("J'ai partie tôt.", d2).map((f) => f.code)).toContain('auxiliary')
    expect(check('Elles sont arrivé.', d2).map((f) => f.code)).toContain('agreement')
    expect(check('Ils parle.', d2).map((f) => f.code)).toContain('verb-agreement')
  })
})
