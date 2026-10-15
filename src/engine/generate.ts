/**
 * Builds the exercise sequence for a lesson or a review session from content
 * plus learner state. Deterministic for a given seed.
 */
import type { Lesson, Sentence, VocabEntry, ExerciseKind, IrregularVerb, Exchange, MiniText } from './schema'
import type { Exercise, Stage, ChoiceExercise, WordBankExercise, TypeExercise, MatchExercise, FindErrorExercise, ItemKind, PinRow } from './types'
import { kindsFor } from './ladder'
import { Rng, hashString } from './random'
import { words as wordsOf, stripAccents } from '../lang/es/normalize'
import { conjugate, TENSE_LABELS, PERSONS, type Tense } from '../lang/es/conjugator'
import { inflections } from '../lang/es/inflect'

export interface GenContext {
  vocab: Map<string, VocabEntry>
  /** Vocabulary pool for distractors (same level or below). */
  pool: VocabEntry[]
  verbs: ReadonlyMap<string, IrregularVerb>
  /** Stage per item id; undefined = never seen. */
  stageOf: (id: string) => Stage | undefined
  /** Speech recognition available -> allow 'speak' exercises. */
  speech: boolean
  /** How many speaking exercises to aim for per session (needs `speech`). Default 'some'. */
  speaking?: 'some' | 'lots'
  /** How many times an item has been reviewed (0 = never); used to vary repeat sessions. */
  seenOf?: (id: string) => number
  /** Dictionary lookup of a surface form (for same-part-of-speech distractors). */
  lookup?: (form: string) => VocabEntry[] | undefined
}

export interface GenOptions {
  seed?: number
  /** Exact number of exercises (the generator never returns more). */
  count?: number
  /** Extra sentences to draw on when the lesson's own run out (unit dialogue lines, earlier lessons). Never typed, only heard or read. */
  extra?: { s: Sentence; id: string }[]
  /** Item ids used in the previous session: they come last so a replay feels fresh. */
  avoid?: ReadonlySet<string>
  /** Opt-in "modo picante" sentences for this lesson (1–2 are mixed in; the count stays exact). */
  spicy?: { s: Sentence; id: string }[]
}

export function sentenceId(lessonId: string, index: number, s: Sentence): string {
  return s.id ?? `s.${lessonId}.${index + 1}`
}
export function exchangeId(lessonId: string, index: number): string {
  return `x.${lessonId}.${index + 1}`
}
export function textId(lessonId: string, index: number): string {
  return `t.${lessonId}.${index + 1}`
}
export function spicyId(lessonId: string, index: number): string {
  return `p.${lessonId}.${index + 1}`
}

/** Both-language summary of a sentence, shown after answering. */
export function reviewOf(s: { es: string; en: string }): { es: string; en: string } {
  return { es: s.es, en: s.en }
}
/** Both-language summary of a word (nouns get their article). */
export function reviewOfWord(v: VocabEntry): { es: string; en: string } {
  const art = v.pos === 'noun' && v.gender ? (v.gender === 'f' ? 'la ' : 'el ') : ''
  return { es: art + v.lemma, en: v.en.slice(0, 2).join(', ') }
}
function reviewOfExchange(x: Exchange): { es: string; en: string } {
  return { es: `${x.q.es} — ${x.a.es}`, en: `${x.q.en} — ${x.a.en}` }
}

/** An exchange reviewed as a sentence: the reply is the item, the question is context. */
export function exchangeAsSentence(x: Exchange): Sentence {
  return { es: x.a.es, en: x.a.en, altEs: x.alt, altEn: [], grammar: x.grammar, vocab: x.vocab, note: `In reply to: ${x.q.es}` }
}
/** A mini-text reviewed as a sentence: listening, meaning and ordering only (no retyping of whole texts). */
export function textAsSentence(t: MiniText): Sentence {
  return { es: t.es.join(' '), en: t.en.join(' '), altEs: [], altEn: [], grammar: t.grammar, vocab: t.vocab, kinds: ['listen', 'choiceEs', 'typeEn'] }
}

/** Reply exercise: read (or hear) a line, pick the natural reply among replies from other exchanges. */
export function replyExercise(x: Exchange, id: string, lesson: Lesson, rng: Rng): ChoiceExercise {
  const others = rng.sample(lesson.exchanges.filter((o) => o.a.es !== x.a.es), 3).map((o) => o.a.es)
  for (const s of rng.shuffle(lesson.sentences)) {
    if (others.length >= 3) break
    if (s.es !== x.a.es && !others.includes(s.es)) others.push(s.es)
  }
  const options = rng.shuffle([x.a.es, ...others.slice(0, 3)])
  return { kind: 'reply', items: [id, ...x.vocab], grammar: x.grammar, prompt: x.q.es, audio: x.q.es, options, answer: options.indexOf(x.a.es), translation: `${x.q.en} — ${x.a.en}`, review: reviewOfExchange(x) }
}
/** Typed reply: the question in Spanish, the expected reply given in English. */
export function replyTyped(x: Exchange, id: string): TypeExercise {
  return { kind: 'typeEs', items: [id, ...x.vocab], grammar: x.grammar, prompt: x.q.es, audio: x.q.es, hint: `Reply in Spanish: “${x.a.en}”`, answers: [x.a.es, ...x.alt], translation: x.a.en, review: reviewOfExchange(x) }
}
/** Spoken reply: hear the question, answer aloud. */
export function replyAloud(x: Exchange, id: string): TypeExercise {
  return { kind: 'speak', variant: 'reply', items: [id, ...x.vocab], grammar: x.grammar, prompt: x.q.es, audio: x.q.es, hint: `Answer aloud: “${x.a.en}”`, answers: [x.a.es, ...x.alt], translation: x.a.en, review: reviewOfExchange(x) }
}
/** Listen and repeat a new word. */
export function repeatAfterMe(v: VocabEntry): TypeExercise {
  return { kind: 'speak', variant: 'repeat', items: [v.id], grammar: [], prompt: v.lemma, audio: v.lemma, answers: [v.lemma, ...(v.forms ?? [])], translation: v.en[0], review: reviewOfWord(v) }
}
/** Order the sentences of a mini-text. */
export function orderTextExercise(t: MiniText, id: string, rng: Rng): WordBankExercise {
  let tiles = rng.shuffle(t.es)
  if (tiles.join('|') === t.es.join('|') && t.es.length > 1) tiles = [...t.es].reverse()
  return { kind: 'orderText', items: [id, ...t.vocab], grammar: t.grammar, prompt: t.title ? `Put the sentences in order: ${t.title}` : 'Put the sentences in order', tiles, answers: [t.es.join(' ')], translation: t.en.join(' '), review: { es: t.es.join(' '), en: t.en.join(' ') } }
}

const GRAMMAR_TIP_KINDS = new Set<ExerciseKind>(['fillBlank', 'conjugate', 'typeEs', 'wordBank', 'order'])

/** Key that identifies what an exercise practises, for adjacency checks. */
function practiceKey(e: Exercise): string {
  return e.items[0] ?? e.review?.es ?? `${e.kind}:${'prompt' in e ? e.prompt : ''}`
}

/** Reorder so that no two neighbouring exercises practise the same item (single pass, stable where possible). */
export function deAdjacent(list: Exercise[]): Exercise[] {
  const out = [...list]
  for (let i = 1; i < out.length; i++) {
    if (practiceKey(out[i]!) !== practiceKey(out[i - 1]!)) continue
    const j = out.findIndex((e, k) => k > i && practiceKey(e) !== practiceKey(out[i - 1]!) && (k + 1 >= out.length || practiceKey(out[i]!) !== practiceKey(out[k + 1]!)))
    if (j > i) [out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** Lesson generator: introduce new words, then drill sentences at the learner's stage. Returns exactly `count` exercises when the content allows. */
export function generateLesson(lesson: Lesson, ctx: GenContext, opts: GenOptions = {}): Exercise[] {
  const rng = new Rng(opts.seed ?? hashString(lesson.id + Date.now()))
  const target = opts.count ?? 12
  const avoid = opts.avoid ?? new Set<string>()
  const penalty = (id: string) => (avoid.has(id) ? 1 : 0)
  const seen = ctx.seenOf ?? (() => 0)
  const out: Exercise[] = []
  const vocabEntries = lesson.vocab.map((id) => ctx.vocab.get(id)).filter((v): v is VocabEntry => Boolean(v))
  const newWords = vocabEntries.filter((v) => (ctx.stageOf(v.id) ?? 0) === 0)
  const lessonWordSet = new Set(vocabEntries.map((v) => v.lemma.toLowerCase()))
  const speakMax = ctx.speech ? (ctx.speaking === 'lots' ? 3 : 2) : 0
  let speakCount = 0
  const speakOk = () => speakCount < speakMax
  const noteSpeak = (e: Exercise | undefined) => {
    if (e?.kind === 'speak') speakCount++
    return e
  }

  // 1. Words: match in groups of up to 5, single choices for the rest; the block never exceeds half the session.
  const wordCap = Math.floor(target / 2)
  const maxMatch = Math.min(2, Math.floor(target / 6))
  const maxChoice = Math.min(3, Math.floor(target / 4))
  const wordQueue = rng.shuffle(newWords.length ? newWords : vocabEntries)
  let matches = 0
  while (wordQueue.length >= 4 && matches < maxMatch && out.length < wordCap) {
    const group = wordQueue.splice(0, Math.min(5, wordQueue.length))
    out.push(matchExercise(group))
    matches++
  }
  for (const v of wordQueue.slice(0, maxChoice)) {
    if (out.length >= wordCap) break
    if (speakOk() && ctx.speaking === 'lots' && (ctx.stageOf(v.id) ?? 0) === 0 && rng.next() < 0.4) out.push(noteSpeak(repeatAfterMe(v))!)
    else out.push(wordChoice(v, ctx, rng, rng.next() < 0.5 ? 'choiceEs' : 'choiceEn', lesson))
  }

  // 2. Sentences: least practised first (previous session's items last, then stage, then times seen), each used at most once.
  const sentences = lesson.sentences.map((s, i) => ({ s, id: sentenceId(lesson.id, i, s), stage: ctx.stageOf(sentenceId(lesson.id, i, s)) ?? 0 }))
  const ordered = rng.shuffle(sentences).sort((a, b) => penalty(a.id) - penalty(b.id) || a.stage - b.stage || seen(a.id) - seen(b.id))
  const replyCount = Math.min(lesson.exchanges.length, target >= 12 ? 3 : 2)
  const textCount = lesson.texts.length && target >= 9 ? 1 : 0
  const spicyCount = opts.spicy?.length ? Math.min(opts.spicy.length, target >= 12 ? 2 : 1) : 0
  const slots = Math.max(0, target - out.length - replyCount - textCount - spicyCount)
  const taught = new Set<string>()
  const used = new Set<string>()
  const addSentence = (s: Sentence, id: string, stage: Stage) => {
    const ex = noteSpeak(sentenceExercise(s, id, stage, lesson, ctx, rng, lessonWordSet, speakOk() ? [] : ['speak'], opts.extra?.map((x) => x.s)))
    if (!ex) return false
    const tip = [...lesson.teach, ...s.grammar].find((g) => !taught.has(g) && lesson.teach.includes(g))
    if (tip && GRAMMAR_TIP_KINDS.has(ex.kind)) {
      ex.teach = tip
      taught.add(tip)
    }
    used.add(id)
    out.push(ex)
    return true
  }
  for (const { s, id, stage } of ordered.slice(0, slots)) addSentence(s, id, stage)

  // 3. Conversation and text: replies to questions and one mini-text, least practised first.
  const exchanges = rng.shuffle(lesson.exchanges.map((x, i) => ({ x, i, id: exchangeId(lesson.id, i) }))).sort((a, b) => penalty(a.id) - penalty(b.id) || seen(a.id) - seen(b.id)).slice(0, replyCount)
  for (const { x, id } of exchanges) {
    const stage = ctx.stageOf(id) ?? 0
    used.add(id)
    if (stage >= 1 && speakOk() && rng.next() < (ctx.speaking === 'lots' ? 0.6 : 0.35)) out.push(noteSpeak(replyAloud(x, id))!)
    else out.push(stage >= 2 ? replyTyped(x, id) : replyExercise(x, id, lesson, rng))
  }
  if (textCount) {
    const t = rng.shuffle(lesson.texts.map((t, i) => ({ t, id: textId(lesson.id, i) }))).sort((a, b) => penalty(a.id) - penalty(b.id) || seen(a.id) - seen(b.id))[0]!
    used.add(t.id)
    out.push(orderTextExercise(t.t, t.id, rng))
  }
  // 3b. Modo picante: a pinch of cheeky sentences, drilled like any other.
  for (const { s, id } of rng.shuffle(opts.spicy ?? []).sort((a, b) => penalty(a.id) - penalty(b.id) || seen(a.id) - seen(b.id)).slice(0, spicyCount)) {
    addSentence(s, id, ctx.stageOf(id) ?? 0)
  }

  // 4. Still short: fresh lesson sentences first, then extra sentences (heard or read, never retyped).
  for (const { s, id, stage } of ordered) {
    if (out.length >= target) break
    if (used.has(id)) continue
    addSentence(s, id, stage)
  }
  const extras = rng.shuffle(opts.extra ?? []).sort((a, b) => penalty(a.id) - penalty(b.id))
  for (const { s, id } of extras) {
    if (out.length >= target) break
    if (used.has(id)) continue
    used.add(id)
    const others = sentenceDistractors(s, lesson, rng, extras.map((x) => x.s))
    if (others.length < 3) continue
    const options = rng.shuffle([s.en, ...others])
    const kind = rng.next() < 0.5 ? 'listen' : 'choiceEs'
    out.push({ kind, items: [], grammar: s.grammar, prompt: kind === 'listen' ? 'What did you hear?' : s.es, audio: s.es, options, answer: options.indexOf(s.en), translation: s.en, review: reviewOf(s) } satisfies ChoiceExercise)
  }
  // 5. Exact length, matching first, the rest mixed, and never the same item twice in a row.
  const capped = out.slice(0, target)
  const head = capped[0]?.kind === 'match' ? capped.slice(0, 1) : []
  const rest = rng.shuffle(capped.slice(head.length))
  return deAdjacent([...head, ...rest])
}

/** Review generator: one exercise per card (word or sentence), kind by stage. */
export function generateReview(
  cards: { id: string; kind: ItemKind; stage: Stage }[],
  lookup: { word: (id: string) => VocabEntry | undefined; sentence: (id: string) => { s: Sentence; lesson: Lesson } | undefined },
  ctx: GenContext,
  seed = Date.now(),
): Exercise[] {
  const rng = new Rng(seed)
  const out: Exercise[] = []
  const wordCards = cards.filter((c) => c.kind === 'word')
  // group stage-0/1 words into match exercises
  const low = wordCards.filter((c) => c.stage <= 1)
  const matchable = low.map((c) => lookup.word(c.id)).filter((v): v is VocabEntry => Boolean(v))
  while (matchable.length >= 4) out.push(matchExercise(matchable.splice(0, 5)))
  const matched = new Set(out.flatMap((e) => e.items))
  const speakMax = ctx.speech ? (ctx.speaking === 'lots' ? 4 : 2) : 0
  let speaks = 0
  for (const c of wordCards) {
    if (matched.has(c.id)) continue
    const v = lookup.word(c.id)
    if (!v) continue
    const kinds = kindsFor('word', c.stage).filter((k) => k !== 'match' && (speaks < speakMax || k !== 'speak'))
    const kind = rng.pick(kinds)
    if (kind === 'speak') speaks++
    out.push(wordExercise(v, kind, ctx, rng))
  }
  for (const c of cards.filter((x) => x.kind === 'sentence')) {
    const found = lookup.sentence(c.id)
    if (!found) continue
    const ex = sentenceExercise(found.s, c.id, c.stage, found.lesson, ctx, rng, new Set(), speaks < speakMax ? [] : ['speak'])
    if (ex) {
      if (ex.kind === 'speak') speaks++
      out.push(ex)
    }
  }
  return deAdjacent(rng.shuffle(out))
}

/**
 * Pinned practice: the item's own kinds plus, when a single word was missed, a
 * focused fill-in-the-blank whose options include the learner's wrong form.
 */
export function generatePinned(
  pins: PinRow[],
  lookup: { word: (id: string) => VocabEntry | undefined; sentence: (id: string) => { s: Sentence; lesson: Lesson } | undefined },
  ctx: GenContext,
  seed = Date.now(),
): Exercise[] {
  const rng = new Rng(seed)
  const out: Exercise[] = []
  const otherEn = pins.map((p) => p.en)
  for (const pin of pins) {
    const made: Exercise[] = []
    if (pin.id.startsWith('w.')) {
      const v = lookup.word(pin.id)
      if (v) {
        made.push(wordExercise(v, 'choiceEn', ctx, rng))
        made.push(wordExercise(v, v.example ? 'fillBlank' : 'typeEs', ctx, rng))
      }
    } else if (/^[sxt]\./.test(pin.id)) {
      const found = lookup.sentence(pin.id)
      if (found) {
        const { s, lesson } = found
        if (pin.missed) made.push(focusedFillBlank(s, pin.id, pin.missed, ctx, rng, lesson))
        const prod = sentenceExercise(s, pin.id, pin.missed ? 1 : 2, lesson, ctx, rng, new Set(), ['speak', 'findError', 'transform'])
        if (prod) made.push(prod)
      }
    }
    if (!made.length) {
      // item-less: build from the pinned text itself
      const others = rng.sample([...new Set(otherEn.filter((e) => e !== pin.en))], 3)
      while (others.length < 3) others.push(rng.pick(ctx.pool).en[0]!)
      const options = rng.shuffle([pin.en, ...others])
      made.push({ kind: 'listen', items: [], grammar: [], prompt: 'What did you hear?', audio: pin.es, options, answer: options.indexOf(pin.en), translation: pin.en, review: { es: pin.es, en: pin.en } } satisfies ChoiceExercise)
      made.push({ kind: 'typeEs', items: [], grammar: [], prompt: pin.en, answers: [pin.es], translation: pin.en, review: { es: pin.es, en: pin.en } } satisfies TypeExercise)
    }
    out.push(...made.slice(0, 2))
  }
  return deAdjacent(rng.shuffle(out)).slice(0, 16)
}

/** Fill-in-the-blank whose blank is exactly the missed word; the learner's wrong form is among the options. */
export function focusedFillBlank(s: Sentence, id: string, missed: { given: string; expected: string }, ctx: GenContext, rng: Rng, lesson?: Lesson): ChoiceExercise {
  const ws = wordsOf(s.es)
  const target = ws.find((w) => stripAccents(w) === stripAccents(missed.expected.toLowerCase()))
  if (!target) return fillBlankFromSentence(s, id, s.grammar, ctx, rng, new Set(), lesson, s.vocab)
  const wrong = missed.given.toLowerCase()
  const distract = new Set<string>()
  if (wrong && wrong !== target) distract.add(wrong)
  const entries = ctx.lookup?.(target) ?? []
  for (const v of entries) for (const f of inflections(v, ctx.verbs)) if (f !== target && !f.includes(' ') && distract.size < 3) distract.add(f)
  for (const w of rng.shuffle((lesson?.sentences ?? []).flatMap((o) => wordsOf(o.es)))) {
    if (distract.size >= 2) break
    if (w !== target && !ws.includes(w) && w.length > 2) distract.add(w)
  }
  const opts = rng.shuffle([target, ...[...distract].slice(0, 2)])
  return { kind: 'fillBlank', items: [id, ...s.vocab], grammar: s.grammar, prompt: replaceWord(s.es, target, '____'), options: opts, answer: opts.indexOf(target), translation: s.en, review: reviewOf(s) }
}

// ---------------------------------------------------------------------------
// word exercises

function matchExercise(group: VocabEntry[]): MatchExercise {
  return {
    kind: 'match',
    items: group.map((v) => v.id),
    grammar: [],
    pairs: group.map((v) => ({ left: v.lemma, right: v.en[0]! })),
    review: { es: group.map((v) => v.lemma).join(' · '), en: group.map((v) => v.en[0]).join(' · ') },
  }
}

function glossKey(g: string): string {
  return g.toLowerCase().replace(/\(.*?\)/g, '').replace(/^to /, '').replace(/^(the|a|an) /, '').trim()
}
function glossOverlap(a: VocabEntry, b: VocabEntry): boolean {
  const A = new Set(a.en.map(glossKey))
  return b.en.some((g) => A.has(glossKey(g)))
}

/**
 * Distractors that are plausible: words from the same lesson first, then the same
 * unit, the same topic, the same part of speech (and gender) at the level, and only
 * then anything else. Never the same lemma or a word with an overlapping meaning,
 * and no two options with the same gloss.
 */
export function distractorWords(v: VocabEntry, ctx: GenContext, rng: Rng, n: number, lesson?: Lesson): VocabEntry[] {
  const picked: VocabEntry[] = []
  const glosses = new Set([glossKey(v.en[0]!)])
  const ok = (p: VocabEntry) => p.id !== v.id && p.lemma.toLowerCase() !== v.lemma.toLowerCase() && !glossOverlap(p, v) && !picked.includes(p) && !glosses.has(glossKey(p.en[0]!))
  const lessonWords = lesson ? lesson.vocab.map((id) => ctx.vocab.get(id)).filter((x): x is VocabEntry => Boolean(x)) : []
  const samePos = (p: VocabEntry) => p.pos === v.pos
  const tiers: (() => VocabEntry[])[] = [
    () => lessonWords.filter(samePos),
    () => (v.unit ? ctx.pool.filter((p) => p.unit === v.unit && samePos(p)) : []),
    () => (v.topic ? ctx.pool.filter((p) => p.topic === v.topic && samePos(p)) : []),
    () => ctx.pool.filter((p) => samePos(p) && p.level === v.level && (v.pos !== 'noun' || p.gender === v.gender)),
    () => ctx.pool.filter((p) => samePos(p) && p.level === v.level),
    () => ctx.pool.filter(samePos),
    () => ctx.pool,
  ]
  for (const tier of tiers) {
    if (picked.length >= n) break
    for (const p of rng.shuffle(tier())) {
      if (picked.length >= n) break
      if (!ok(p)) continue
      picked.push(p)
      glosses.add(glossKey(p.en[0]!))
    }
  }
  return picked
}

function wordChoice(v: VocabEntry, ctx: GenContext, rng: Rng, kind: 'choiceEs' | 'choiceEn' | 'listen', lesson?: Lesson): ChoiceExercise {
  const ds = distractorWords(v, ctx, rng, 3, lesson)
  const es = kind === 'choiceEn' ? false : true
  const correct = es ? v.en[0]! : v.lemma
  const options = rng.shuffle([correct, ...ds.map((d) => (es ? d.en[0]! : d.lemma))])
  return {
    kind,
    items: [v.id],
    grammar: [],
    prompt: es ? v.lemma : v.en[0]!,
    audio: kind === 'listen' ? v.lemma : undefined,
    options,
    answer: options.indexOf(correct),
    translation: es ? v.en[0] : v.lemma,
    review: reviewOfWord(v),
  }
}

function wordExercise(v: VocabEntry, kind: ExerciseKind, ctx: GenContext, rng: Rng): Exercise {
  switch (kind) {
    case 'choiceEs':
    case 'choiceEn':
    case 'listen':
      return wordChoice(v, ctx, rng, kind)
    case 'fillBlank': {
      if (v.example) return fillBlankFromSentence(v.example, v.id, [], ctx, rng, new Set([v.lemma.toLowerCase()]))
      return wordChoice(v, ctx, rng, 'choiceEn')
    }
    case 'dictation':
      return { kind: 'dictation', items: [v.id], grammar: [], prompt: 'Type what you hear', audio: v.lemma, answers: [v.lemma], translation: v.en[0], review: reviewOfWord(v) } satisfies TypeExercise
    case 'speak':
      return { kind: 'speak', items: [v.id], grammar: [], prompt: v.lemma, answers: [v.lemma], translation: v.en[0], review: reviewOfWord(v) } satisfies TypeExercise
    default:
      return { kind: 'typeEs', items: [v.id], grammar: [], prompt: v.en.join(' / '), answers: [v.lemma, ...(v.forms ?? [])], hint: posHint(v), translation: v.lemma, review: reviewOfWord(v) } satisfies TypeExercise
  }
}

function posHint(v: VocabEntry): string | undefined {
  if (v.pos === 'noun' && v.gender) return v.gender === 'm' ? 'masculine noun' : v.gender === 'f' ? 'feminine noun' : 'noun'
  if (v.pos === 'verb') return 'verb (infinitive)'
  return undefined
}

// ---------------------------------------------------------------------------
// sentence exercises

/** English meanings of other sentences: related ones (shared vocab or grammar) first, then the lesson, then extras. */
function sentenceDistractors(s: Sentence, lesson: Lesson, rng: Rng, extra: Sentence[] = []): string[] {
  const out: string[] = []
  const seen = new Set([s.en.toLowerCase()])
  const add = (list: Sentence[]) => {
    for (const o of rng.shuffle(list)) {
      if (out.length >= 3) return
      const k = o.en.toLowerCase()
      if (o.es === s.es || seen.has(k)) continue
      seen.add(k)
      out.push(o.en)
    }
  }
  const shares = (o: Sentence) => o.vocab.some((v) => s.vocab.includes(v)) || o.grammar.some((g) => s.grammar.includes(g))
  add(lesson.sentences.filter((o) => o !== s && shares(o)))
  add(lesson.sentences.filter((o) => o !== s))
  add(extra)
  return out
}

function sentenceExercise(s: Sentence, id: string, stage: Stage, lesson: Lesson, ctx: GenContext, rng: Rng, lessonWords: Set<string>, exclude: ExerciseKind[] = [], extra: Sentence[] = []): Exercise | undefined {
  let kinds = kindsFor('sentence', stage).filter((k) => !exclude.includes(k))
  if (s.kinds) kinds = kinds.filter((k) => s.kinds!.includes(k))
  if (!ctx.speech) kinds = kinds.filter((k) => k !== 'speak')
  if (!s.transform) kinds = kinds.filter((k) => k !== 'transform')
  if (!s.error) kinds = kinds.filter((k) => k !== 'findError')
  if (wordsOf(s.es).length < 3) kinds = kinds.filter((k) => k !== 'wordBank' && k !== 'order')
  if (kinds.length === 0) kinds = ['typeEs']
  // grammar-focused lessons: prefer conjugate when a verb from the lesson is in the sentence
  const verbInfo = findVerbForm(s.es, lesson, ctx)
  if (verbInfo && stage >= 1 && !exclude.includes('conjugate') && rng.next() < 0.35) kinds = ['conjugate']
  const kind = rng.pick(kinds)
  const base = { items: [id, ...s.vocab], grammar: s.grammar, review: reviewOf(s) }
  switch (kind) {
    case 'choiceEs':
    case 'listen': {
      const others = sentenceDistractors(s, lesson, rng, extra)
      while (others.length < 3) others.push(rng.pick(ctx.pool).en[0]!)
      const options = rng.shuffle([s.en, ...others])
      return { ...base, kind, prompt: kind === 'listen' ? 'What did you hear?' : s.es, audio: s.es, options, answer: options.indexOf(s.en), translation: s.en } satisfies ChoiceExercise
    }
    case 'wordBank': {
      const ws = wordsOf(s.es)
      const otherWords = lesson.sentences.flatMap((o) => wordsOf(o.es)).filter((w) => !ws.includes(w))
      const distract = rng.sample([...new Set(otherWords)], 2)
      return { ...base, kind, prompt: s.en, tiles: rng.shuffle([...ws, ...distract]), answers: [s.es, ...s.altEs], translation: s.en } satisfies WordBankExercise
    }
    case 'order': {
      const ws = wordsOf(s.es)
      return { ...base, kind, prompt: 'Put the words in order', tiles: rng.shuffle(ws), answers: [s.es, ...s.altEs], translation: s.en } satisfies WordBankExercise
    }
    case 'typeEn':
      return { ...base, kind, prompt: s.es, audio: s.es, answers: [s.en, ...s.altEn], translation: s.es } satisfies TypeExercise
    case 'dictation':
      return { ...base, kind, prompt: 'Type what you hear', audio: s.es, answers: [s.es, ...s.altEs], translation: s.en } satisfies TypeExercise
    case 'speak':
      return { ...base, kind, prompt: s.es, answers: [s.es, ...s.altEs], translation: s.en } satisfies TypeExercise
    case 'fillBlank':
      return fillBlankFromSentence(s, id, s.grammar, ctx, rng, lessonWords, lesson, s.vocab)
    case 'conjugate': {
      const info = verbInfo ?? findVerbForm(s.es, lesson, ctx, true)
      if (!info) return { ...base, kind: 'typeEs', prompt: s.en, answers: [s.es, ...s.altEs], translation: s.en } satisfies TypeExercise
      const blanked = replaceWord(s.es, info.form, '____')
      return { ...base, kind, prompt: blanked, hint: `${info.lemma} · ${TENSE_LABELS[info.tense].en.toLowerCase()} · ${PERSONS[info.person]}`, answers: [info.form], translation: s.en } satisfies TypeExercise
    }
    case 'transform':
      return { ...base, kind, prompt: s.es, hint: s.transform!.instruction, answers: [s.transform!.answer, ...s.transform!.alt], translation: s.en, review: { es: s.transform!.answer, en: s.transform!.en ?? `${s.en} → ${s.transform!.instruction}` } } satisfies TypeExercise
    case 'findError':
      return { ...base, kind, prompt: 'Find the mistake and write the correct sentence', wrong: s.error!.wrong, answers: [s.es, ...s.altEs], explain: s.error!.explain, grammar: s.error!.grammar ? [s.error!.grammar, ...s.grammar] : s.grammar } satisfies FindErrorExercise
    default:
      return { ...base, kind: 'typeEs', prompt: s.en, answers: [s.es, ...s.altEs], translation: s.en } satisfies TypeExercise
  }
}

function replaceWord(sentence: string, word: string, repl: string): string {
  const re = new RegExp(`(^|[^\\p{L}])${escapeRe(word)}(?=$|[^\\p{L}])`, 'iu')
  return sentence.replace(re, (_m, pre: string) => pre + repl)
}
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface VerbInfo {
  form: string
  lemma: string
  tense: Tense
  person: number
}

const SKIP_TENSES = new Set<Tense>(['impNeg', 'impAff'])

/** Find a conjugated verb in the sentence whose lemma is lesson vocabulary (or any vocab verb when `any`). */
function findVerbForm(es: string, lesson: Lesson, ctx: GenContext, any = false): VerbInfo | undefined {
  const ws = wordsOf(es)
  const verbIds = any ? [...ctx.vocab.values()].filter((v) => v.pos === 'verb').map((v) => v.id) : lesson.vocab
  for (const id of verbIds) {
    const v = ctx.vocab.get(id)
    if (!v || v.pos !== 'verb') continue
    const lemma = v.lemma.toLowerCase().replace(/se$/, '')
    let c
    try {
      c = conjugate(lemma, ctx.verbs)
    } catch {
      continue
    }
    for (const [tense, forms] of Object.entries(c.forms) as [Tense, (string | null)[]][]) {
      if (SKIP_TENSES.has(tense)) continue
      for (let p = 0; p < 6; p++) {
        const f = forms[p]
        if (!f || f.includes(' ')) continue
        if (f === c.infinitive) continue
        if (ws.includes(f)) return { form: f, lemma, tense, person: p }
      }
    }
  }
  return undefined
}

function fillBlankFromSentence(s: { es: string; en: string }, id: string, grammar: string[], ctx: GenContext, rng: Rng, lessonWords: Set<string>, lesson?: Lesson, vocabIds: string[] = []): ChoiceExercise {
  const ws = wordsOf(s.es)
  // choose the blank: a tagged vocab word form, else a lesson word, else the longest word
  let target: string | undefined
  let distractors: string[] = []
  for (const vid of vocabIds) {
    const v = ctx.vocab.get(vid)
    if (!v) continue
    const forms = new Set(inflections(v, ctx.verbs))
    const hit = ws.find((w) => forms.has(w))
    if (hit) {
      target = hit
      // distractors: other forms of the same word (agreement / conjugation practice)
      distractors = [...forms].filter((f) => f !== hit && !f.includes(' ')).slice(0, 12)
      break
    }
  }
  if (!target) {
    const lessonHit = ws.filter((w) => lessonWords.has(w) && w.length > 2)
    target = lessonHit.length ? rng.pick(lessonHit) : ws.reduce((a, b) => (b.length > a.length ? b : a), ws[0]!)
  }
  if (distractors.length < 2) {
    // same part of speech as the blank, from the dictionary, then other words of the lesson
    const entries = ctx.lookup?.(target) ?? []
    const pos = entries[0]?.pos
    const samePos = pos ? ctx.pool.filter((p) => p.pos === pos && !ws.includes(p.lemma.toLowerCase()) && !entries.some((e) => e.id === p.id)).map((p) => p.lemma.toLowerCase()) : []
    const otherWords = (lesson?.sentences ?? []).flatMap((o) => wordsOf(o.es)).filter((w) => !ws.includes(w) && w.length > 2)
    distractors = [...new Set([...distractors, ...rng.sample(samePos, 4), ...otherWords])]
  }
  if (distractors.length < 2) distractors.push(...rng.sample(ctx.pool, 3).map((p) => p.lemma))
  const opts = rng.shuffle([target, ...rng.sample(distractors.filter((d) => d !== target), 2)])
  return {
    kind: 'fillBlank',
    items: [id, ...vocabIds],
    grammar,
    prompt: replaceWord(s.es, target, '____'),
    options: opts,
    answer: opts.indexOf(target),
    translation: s.en,
    review: reviewOf(s),
  }
}
