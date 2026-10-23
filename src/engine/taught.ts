/**
 * The taught-words gate (courses with `features.taughtOnly`, Cantonese): a learner who knows
 * none of the language is only shown or played target-language text to understand when at
 * least TAUGHT_MIN of its words were taught explicitly, i.e. listed in the `vocab` of the
 * lesson or of an earlier one in syllabus order. Questions whose wording is not taught yet
 * are asked in English instead, when their answer is taught.
 *
 * Pure: no Vite globs and no `@lang` imports, so the content scripts (scripts/taught-report.ts,
 * scripts/check-content.ts) share it with the app (src/engine/taughtData.ts builds it there).
 */
import type { Token } from '../lang/types'
import type { Exchange, Lesson, VocabEntry } from './schema'

/** Taught share of a text: the shape of the reader's coverage meter (engine/coverage.ts), over taught words instead of known ones. */
export interface Coverage {
  total: number
  known: number
  unknownForms: Map<string, number>
  ratio: number
}

/** Share of a text's words that must be taught for it to be shown as something to understand. */
export const TAUGHT_MIN = 0.95
/** A lesson should have at least this many sentences, exchanges and texts that pass the gate or can be asked in English (content check warning). */
export const TAUGHT_MIN_ITEMS = 4

/**
 * Cantonese sentence-final particles: they colour a sentence (softening, urging, a question's tone)
 * but carry no content a beginner needs, so they are left out of the count at the end of a clause.
 * 咩 (what?), 咋 (only) and 㖭 (too) carry meaning, and 嘅, 咗 and 緊 are grammar: those count.
 */
export const FINAL_PARTICLES: ReadonlySet<string> = new Set([...'呀啊啦喇嘞嗎呢吖喎囉㗎啫嘛噃啩哦喔咯囖'])

const HAN = /\p{Script=Han}/u

/** Lessons in syllabus order (levels, then units as the syllabus lists them, then lessons in file order) and the words each has taught by then. */
export interface TaughtIndex {
  /** Lesson ids in syllabus order. */
  order: readonly string[]
  /** Position of a lesson in `order` (-1 when unknown). */
  position(lessonId: string): number
  /** Vocabulary ids listed by this lesson or any earlier one. Unknown lessons: nothing. */
  at(lessonId: string): ReadonlySet<string>
  /** The lesson furthest along the syllabus among these ids (undefined when none is known). */
  furthest(lessonIds: Iterable<string>): string | undefined
}

export function taughtIndex(levels: readonly { units: readonly { id: string }[] }[], units: readonly { id: string; lessons: readonly { id: string; vocab: readonly string[] }[] }[]): TaughtIndex {
  const byId = new Map(units.map((u) => [u.id, u]))
  const lessons = levels.flatMap((l) => l.units.flatMap((u) => byId.get(u.id)?.lessons ?? []))
  const order = lessons.map((l) => l.id)
  const pos = new Map(order.map((id, i) => [id, i]))
  // each lesson's set is built only when asked for (a page needs one or two), not all few hundred at once:
  // they hold thousands of ids each, which is a lot of memory on a phone
  const sets = new Map<number, ReadonlySet<string>>()
  const empty: ReadonlySet<string> = new Set()
  return {
    order,
    position: (id) => pos.get(id) ?? -1,
    at(id) {
      const i = pos.get(id)
      if (i === undefined) return empty
      let set = sets.get(i)
      if (!set) {
        const acc = new Set<string>()
        for (let k = 0; k <= i; k++) for (const v of lessons[k]!.vocab) acc.add(v)
        set = acc
        if (sets.size >= 8) sets.delete(sets.keys().next().value!)
        sets.set(i, set)
      }
      return set
    },
    furthest(ids) {
      let best = -1
      for (const id of ids) best = Math.max(best, pos.get(id) ?? -1)
      return best >= 0 ? order[best] : undefined
    },
  }
}

/** What the learner has been taught at a point of the course, and how much of a text that covers. */
export interface TaughtGate {
  /** Vocabulary ids taught so far. */
  readonly ids: ReadonlySet<string>
  /** Taught share of a target-language text's countable words (punctuation, digits, Latin script, names and final particles are left out). */
  coverage(text: string): Coverage
  /** At least TAUGHT_MIN of the text is taught: it may be shown or played to be understood. */
  ok(text: string): boolean
}

/**
 * A Han word the segmenter kept whole, cut into taught words where it can be (十一 = 十 + 一,
 * 食咗飯未 = 食 + 咗 + 飯 + 未): fewest untaught characters, then fewest pieces.
 */
function splitTaught(w: string, known: (x: string) => boolean): { text: string; taught: boolean }[] {
  const chars = [...w]
  const n = chars.length
  // best[j]: [untaught characters, pieces] for chars[0..j)
  const best: [number, number][] = [[0, 0], ...new Array<[number, number]>(n).fill([Infinity, Infinity])]
  const back: number[] = new Array(n + 1).fill(1)
  for (let j = 1; j <= n; j++) {
    for (let i = 0; i < j; i++) {
      const piece = chars.slice(i, j).join('')
      const taught = known(piece)
      if (!taught && j - i > 1) continue
      const cost: [number, number] = [best[i]![0] + (taught ? 0 : 1), best[i]![1] + 1]
      if (cost[0] < best[j]![0] || (cost[0] === best[j]![0] && cost[1] < best[j]![1])) {
        best[j] = cost
        back[j] = j - i
      }
    }
  }
  const pieces: { text: string; taught: boolean }[] = []
  for (let j = n; j > 0; j -= back[j]!) {
    const text = chars.slice(j - back[j]!, j).join('')
    pieces.unshift({ text, taught: known(text) })
  }
  return pieces
}
/** Neighbouring untaught pieces as one word (幾 + 多 → 幾多). */
function mergeUntaught(pieces: { text: string; taught: boolean }[]): { text: string; taught: boolean }[] {
  return pieces.reduce<{ text: string; taught: boolean }[]>((acc, p) => {
    const last = acc.at(-1)
    if (last && !last.taught && !p.taught) last.text += p.text
    else acc.push({ ...p })
    return acc
  }, [])
}

/**
 * Build the gate from the taught vocabulary ids. `tokenize` is the course's tokenizer (the Cantonese
 * segmenter), `names` the proper nouns of known.yaml (never counted: they are explained in English).
 */
export function makeTaughtGate(ids: Iterable<string>, vocab: ReadonlyMap<string, VocabEntry>, tokenize: (text: string) => Token[], names: Iterable<string> = []): TaughtGate {
  const taughtIds = new Set(ids)
  const forms = new Set<string>()
  for (const id of taughtIds) {
    const v = vocab.get(id)
    if (!v) continue
    for (const f of [v.lemma, ...(v.forms ?? [])]) forms.add(f.replace(/\s+/g, '').toLowerCase())
  }
  // names are blanked out before segmenting (longest first), so however the segmenter would cut them they never count;
  // a taught word that contains a name (大埔墟 holds 大埔) keeps it
  const nameList = [...new Set(names)].filter((n) => n.length > 0).sort((a, b) => b.length - a.length)
  const nameWords = [...forms].filter((f) => nameList.some((n) => f !== n && f.includes(n))).sort((a, b) => b.length - a.length)
  const blankNames = (text: string): string => {
    if (!nameList.some((n) => text.includes(n))) return text
    const keep = new Array<boolean>(text.length).fill(false)
    const mark = (word: string, then: (from: number) => void) => {
      for (let i = text.indexOf(word); i >= 0; i = text.indexOf(word, i + word.length)) then(i)
    }
    for (const w of nameWords) mark(w, (i) => keep.fill(true, i, i + w.length))
    const blank = new Array<boolean>(text.length).fill(false)
    for (const n of nameList) mark(n, (i) => {
      if (!keep.slice(i, i + n.length).some(Boolean) && !blank.slice(i, i + n.length).some(Boolean)) blank.fill(true, i, i + n.length)
    })
    let out = ''
    for (let i = 0; i < text.length; i++) out += blank[i] ? (blank[i - 1] ? '' : ' 0 ') : text[i]
    return out
  }
  const isParticle = (w: string) => [...w].every((c) => FINAL_PARTICLES.has(c))
  const cache = new Map<string, Coverage>()
  const coverage = (text: string): Coverage => {
    const hit = cache.get(text)
    if (hit) return hit
    const tokens = tokenize(blankNames(text.normalize('NFC'))).filter((tk) => tk.kind !== 'space')
    let total = 0
    let known = 0
    const unknownForms = new Map<string, number>()
    tokens.forEach((tk, i) => {
      if (tk.kind !== 'word' || !HAN.test(tk.text)) return // punctuation, digits, Latin script (Leo, Ana, Jyutping)
      const w = tk.text.toLowerCase()
      // final when the clause ends here or only particles follow (呀, 㗎喎); 呢 before a word is the demonstrative
      const next = tokens[i + 1]
      const final = !next || next.kind !== 'word' || !HAN.test(next.text) || isParticle(next.text)
      if (isParticle(w) && final) return
      if (forms.has(w)) {
        total++
        known++
        return
      }
      // a word the segmenter kept whole (from its generic word list): its taught parts count, and a final particle stuck to it (點呀) does not
      const pieces = splitTaught(w, (x) => forms.has(x))
      if (final && pieces.length > 1 && isParticle(pieces.at(-1)!.text)) pieces.pop()
      if (pieces.every((p) => p.taught)) {
        total++
        known++
        return
      }
      for (const p of mergeUntaught(pieces)) {
        total++
        if (p.taught) known++
        else unknownForms.set(p.text, (unknownForms.get(p.text) ?? 0) + 1)
      }
    })
    const c = { total, known, unknownForms, ratio: total ? known / total : 1 }
    cache.set(text, c)
    return c
  }
  return { ids: taughtIds, coverage, ok: (text) => coverage(text).ratio >= TAUGHT_MIN }
}

/**
 * How an item fares at the gate: `pass` is generated as today, `english` is asked in English
 * (an exchange whose question is not taught but whose answer is), `skip` is left out.
 */
export type GateVerdict = 'pass' | 'english' | 'skip'

export function exchangeVerdict(x: Pick<Exchange, 'q' | 'a'>, gate: TaughtGate): GateVerdict {
  if (!gate.ok(x.a.es)) return 'skip'
  return gate.ok(x.q.es) ? 'pass' : 'english'
}
export function textVerdict(es: string, gate: TaughtGate): GateVerdict {
  return gate.ok(es) ? 'pass' : 'skip'
}

/** Comparable form of a short target-language answer (no punctuation or spaces), to keep accepted answers out of the distractors. */
export function answerKey(s: string): string {
  return s.normalize('NFC').replace(/[\p{P}\p{S}\s]+/gu, '').toLowerCase()
}

export interface GateItem {
  kind: 'sentence' | 'exchange' | 'text'
  /** The target-language text checked (an exchange: question — answer). */
  es: string
  verdict: GateVerdict
  /** Taught share (an exchange: of its question; of its answer when skipped). */
  ratio: number
  /** Untaught word forms that stop it from passing. */
  untaught: string[]
}
export interface LessonGate {
  lessonId: string
  items: GateItem[]
  pass: number
  english: number
  skip: number
  /** Untaught forms over the items that do not pass, most frequent first. */
  blocking: [string, number][]
}

/** Every sentence, exchange and mini-text of a lesson at the gate (for the content report and check). */
export function gateLesson(lesson: Pick<Lesson, 'id' | 'sentences' | 'exchanges' | 'texts'>, gate: TaughtGate): LessonGate {
  const items: GateItem[] = []
  const untaughtOf = (text: string) => [...gate.coverage(text).unknownForms.keys()]
  for (const s of lesson.sentences) {
    const c = gate.coverage(s.es)
    items.push({ kind: 'sentence', es: s.es, verdict: textVerdict(s.es, gate), ratio: c.ratio, untaught: [...c.unknownForms.keys()] })
  }
  for (const x of lesson.exchanges) {
    const verdict = exchangeVerdict(x, gate)
    const which = verdict === 'skip' ? x.a.es : x.q.es
    items.push({ kind: 'exchange', es: `${x.q.es} — ${x.a.es}`, verdict, ratio: gate.coverage(which).ratio, untaught: verdict === 'pass' ? [] : [...new Set([...untaughtOf(x.q.es), ...untaughtOf(x.a.es)])] })
  }
  for (const t of lesson.texts) {
    const es = t.es.join('')
    const c = gate.coverage(es)
    items.push({ kind: 'text', es, verdict: textVerdict(es, gate), ratio: c.ratio, untaught: [...c.unknownForms.keys()] })
  }
  const blocking = new Map<string, number>()
  for (const it of items) if (it.verdict !== 'pass') for (const w of it.untaught) blocking.set(w, (blocking.get(w) ?? 0) + 1)
  const count = (v: GateVerdict) => items.filter((i) => i.verdict === v).length
  return { lessonId: lesson.id, items, pass: count('pass'), english: count('english'), skip: count('skip'), blocking: [...blocking.entries()].sort((a, b) => b[1] - a[1]) }
}
