/**
 * English hints for the verb games: "tú · tener · present" → "you have". Built from the verb's
 * first English gloss ("to have", "to get up", "can") with a small table of irregular English verbs.
 * Best effort: a gloss it cannot read gives no hint rather than a wrong one.
 */

/** Past simple and past participle of common irregular English verbs. */
const IRREGULAR: Record<string, [past: string, participle: string]> = {
  be: ['was', 'been'], have: ['had', 'had'], do: ['did', 'done'], go: ['went', 'gone'], get: ['got', 'got'], take: ['took', 'taken'],
  make: ['made', 'made'], give: ['gave', 'given'], put: ['put', 'put'], find: ['found', 'found'], leave: ['left', 'left'], feel: ['felt', 'felt'],
  come: ['came', 'come'], see: ['saw', 'seen'], know: ['knew', 'known'], say: ['said', 'said'], eat: ['ate', 'eaten'], drink: ['drank', 'drunk'],
  sleep: ['slept', 'slept'], read: ['read', 'read'], write: ['wrote', 'written'], speak: ['spoke', 'spoken'], run: ['ran', 'run'], begin: ['began', 'begun'],
  think: ['thought', 'thought'], understand: ['understood', 'understood'], buy: ['bought', 'bought'], sell: ['sold', 'sold'], pay: ['paid', 'paid'],
  win: ['won', 'won'], lose: ['lost', 'lost'], break: ['broke', 'broken'], bring: ['brought', 'brought'], keep: ['kept', 'kept'], send: ['sent', 'sent'],
  spend: ['spent', 'spent'], build: ['built', 'built'], stand: ['stood', 'stood'], sit: ['sat', 'sat'], meet: ['met', 'met'], tell: ['told', 'told'],
  hear: ['heard', 'heard'], choose: ['chose', 'chosen'], swim: ['swam', 'swum'], sing: ['sang', 'sung'], fall: ['fell', 'fallen'], drive: ['drove', 'driven'],
  ride: ['rode', 'ridden'], wear: ['wore', 'worn'], wake: ['woke', 'woken'], forget: ['forgot', 'forgotten'], forgive: ['forgave', 'forgiven'], fly: ['flew', 'flown'],
  grow: ['grew', 'grown'], throw: ['threw', 'thrown'], show: ['showed', 'shown'], hold: ['held', 'held'], lead: ['led', 'led'], mean: ['meant', 'meant'],
  hang: ['hung', 'hung'], hit: ['hit', 'hit'], cut: ['cut', 'cut'], let: ['let', 'let'], set: ['set', 'set'], shut: ['shut', 'shut'], cost: ['cost', 'cost'],
  catch: ['caught', 'caught'], teach: ['taught', 'taught'], fight: ['fought', 'fought'], become: ['became', 'become'], hide: ['hid', 'hidden'],
  draw: ['drew', 'drawn'], rise: ['rose', 'risen'], shine: ['shone', 'shone'], steal: ['stole', 'stolen'], swear: ['swore', 'sworn'], freeze: ['froze', 'frozen'],
  bet: ['bet', 'bet'], spread: ['spread', 'spread'], lend: ['lent', 'lent'], light: ['lit', 'lit'], bear: ['bore', 'borne'], overcome: ['overcame', 'overcome'],
  withdraw: ['withdrew', 'withdrawn'], forbid: ['forbade', 'forbidden'], bite: ['bit', 'bitten'], ring: ['rang', 'rung'], feed: ['fed', 'fed'], flee: ['fled', 'fled'],
  deal: ['dealt', 'dealt'], shoot: ['shot', 'shot'], sink: ['sank', 'sunk'], stick: ['stuck', 'stuck'], strike: ['struck', 'struck'], sweep: ['swept', 'swept'],
  tear: ['tore', 'torn'], lay: ['laid', 'laid'], lie: ['lay', 'lain'], seek: ['sought', 'sought'], dig: ['dug', 'dug'], hurt: ['hurt', 'hurt'], quit: ['quit', 'quit'],
  upset: ['upset', 'upset'], undo: ['undid', 'undone'], arise: ['arose', 'arisen'], awake: ['awoke', 'awoken'], broadcast: ['broadcast', 'broadcast'],
  rebuild: ['rebuilt', 'rebuilt'], reread: ['reread', 'reread'], mistake: ['mistook', 'mistaken'], shake: ['shook', 'shaken'], slide: ['slid', 'slid'],
  speed: ['sped', 'sped'], spin: ['spun', 'spun'], split: ['split', 'split'], swing: ['swung', 'swung'], weep: ['wept', 'wept'], wind: ['wound', 'wound'],
  blow: ['blew', 'blown'], burst: ['burst', 'burst'], cling: ['clung', 'clung'], creep: ['crept', 'crept'], kneel: ['knelt', 'knelt'], leap: ['leapt', 'leapt'],
  bend: ['bent', 'bent'], bind: ['bound', 'bound'], breed: ['bred', 'bred'], forecast: ['forecast', 'forecast'], foresee: ['foresaw', 'foreseen'],
}
/** Two-syllable verbs that double their last consonant (British spelling: travelled, cancelled). */
const DOUBLE = new Set(['admit', 'commit', 'regret', 'prefer', 'refer', 'occur', 'permit', 'control', 'travel', 'cancel', 'label', 'level', 'model', 'signal', 'quarrel', 'equip', 'compel', 'expel', 'propel', 'patrol', 'transfer', 'confer', 'deter', 'omit', 'submit', 'emit', 'upset', 'forget', 'begin'])

function doubles(v: string): boolean {
  if (DOUBLE.has(v)) return true
  // short monosyllables ending consonant-vowel-consonant: stop, plan, chat, hug (not w, x, y)
  return /^[^aeiou]*[aeiou][^aeiouwxy]$/.test(v) && v.length <= 4
}

export function pastOf(v: string): string {
  if (IRREGULAR[v]) return IRREGULAR[v]![0]
  if (v.endsWith('e')) return `${v}d`
  if (/[^aeiou]y$/.test(v)) return `${v.slice(0, -1)}ied`
  if (doubles(v)) return `${v}${v.at(-1)}ed`
  return `${v}ed`
}
export function participleOf(v: string): string {
  return IRREGULAR[v]?.[1] ?? pastOf(v)
}
/** Third person singular: has, does, goes, watches, tries, plays. */
export function thirdOf(v: string): string {
  if (v === 'be') return 'is'
  if (v === 'have') return 'has'
  if (/(s|sh|ch|x|z|o)$/.test(v)) return `${v}es`
  if (/[^aeiou]y$/.test(v)) return `${v.slice(0, -1)}ies`
  return `${v}s`
}

/** The English subject for a target-language pronoun (ella → she, usted → you (formal)). */
const PRONOUN_EN: Record<string, string> = {
  yo: 'I', tú: 'you', él: 'he', ella: 'she', usted: 'you (formal)', nosotros: 'we', nosotras: 'we', vosotros: 'you all', vosotras: 'you all', ellos: 'they', ellas: 'they', ustedes: 'you all',
  je: 'I', tu: 'you', il: 'he', elle: 'she', on: 'we', nous: 'we', vous: 'you (all)', ils: 'they', elles: 'they',
  io: 'I', lui: 'he', lei: 'she', Lei: 'you (formal)', noi: 'we', voi: 'you all', loro: 'they',
  eu: 'I', ele: 'he', ela: 'she', você: 'you', nós: 'we', vós: 'you all', eles: 'they', elas: 'they', vocês: 'you all',
}
const PERSON_EN = ['I', 'you', 'he', 'we', 'you all', 'they']
export function pronounEnglish(pronoun: string, person: number): string {
  return PRONOUN_EN[pronoun] ?? PRONOUN_EN[pronoun.toLowerCase()] ?? PERSON_EN[person] ?? 'you'
}

type Kind = 'first' | 'third' | 'other'
const kindOf = (subject: string): Kind => (subject === 'I' ? 'first' : subject === 'he' || subject === 'she' || subject === 'it' ? 'third' : 'other')

function present(v: string, k: Kind): string {
  if (v === 'be') return k === 'first' ? 'am' : k === 'third' ? 'is' : 'are'
  return k === 'third' ? thirdOf(v) : v
}
function past(v: string, k: Kind, subjunctive = false): string {
  if (v === 'be') return subjunctive ? 'were' : k === 'other' ? 'were' : 'was'
  return pastOf(v)
}
const haveFor = (k: Kind) => (k === 'third' ? 'has' : 'have')

/** "to have breakfast" → { head: 'have', tail: 'breakfast' }; "can" → be able to; "must" → have to. */
export function parseGloss(gloss: string): { head: string; tail: string; modal?: 'can' | 'must' } | undefined {
  const g = gloss
    .replace(/\([^)]*\)/g, ' ')
    .split(/[;,]/)[0]!
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  if (g === 'can' || g === 'to be able' || g === 'to be able to') return { head: 'be', tail: 'able to', modal: 'can' }
  if (g === 'must' || g === 'to have to') return { head: 'have', tail: 'to', modal: 'must' }
  const m = /^to ([a-z]+)(?: (.+))?$/.exec(g)
  if (!m) return undefined
  return { head: m[1]!, tail: m[2] ?? '' }
}

/**
 * "you have", "she went", "we will eat", "(that) they have had". `tense` is the conjugator's key
 * (pres, pret, impf, fut, cond, perf, pluperf…); undefined for tenses without a short English match.
 */
export function englishHint(gloss: string, subject: string, tense: string): string | undefined {
  const p = parseGloss(gloss)
  if (!p) return undefined
  const k = kindOf(subject)
  const { head: v, tail } = p
  const t = (s: string) => (tail ? `${s} ${tail}` : s)
  const pp = participleOf(v)
  if (p.modal && (tense === 'pres' || tense === 'pret' || tense === 'cond' || tense === 'subjPres')) {
    const word = p.modal === 'can' ? (tense === 'pres' || tense === 'subjPres' ? 'can' : 'could') : tense === 'pres' || tense === 'subjPres' ? 'must' : tense === 'cond' ? 'should' : 'had to'
    return `${tense === 'subjPres' ? '(that) ' : ''}${subject} ${word}`
  }
  switch (tense) {
    case 'pres':
      return `${subject} ${t(present(v, k))}`
    case 'pret':
      return `${subject} ${t(past(v, k))}`
    case 'impf':
      return `${subject} used to ${t(v)}`
    case 'fut':
      return `${subject} will ${t(v)}`
    case 'cond':
      return `${subject} would ${t(v)}`
    case 'perf':
      return `${subject} ${haveFor(k)} ${t(pp)}`
    case 'pluperf':
    case 'mqp':
    case 'pretPerf':
      return `${subject} had ${t(pp)}`
    case 'futPerf':
      return `${subject} will have ${t(pp)}`
    case 'condPerf':
      return `${subject} would have ${t(pp)}`
    case 'subjPres':
      return `(that) ${subject} ${t(present(v, k))}`
    case 'subjImpf':
    case 'subjImpfSe':
      return `(if) ${subject} ${t(past(v, k, true))}`
    case 'subjPerf':
      return `(that) ${subject} ${haveFor(k)} ${t(pp)}`
    case 'subjPluperf':
      return `(if) ${subject} had ${t(pp)}`
    case 'subjFut':
      return `(when) ${subject} ${t(present(v, k))}`
    case 'subjFutPerf':
      return `(when) ${subject} ${haveFor(k)} ${t(pp)}`
    default:
      return undefined
  }
}
