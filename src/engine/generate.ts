/**
 * Builds the exercise sequence for a lesson or a review session from content
 * plus learner state. Deterministic for a given seed.
 */
import type { Lesson, Sentence, VocabEntry, ExerciseKind, IrregularVerb } from './schema'
import type { Exercise, Stage, ChoiceExercise, WordBankExercise, TypeExercise, MatchExercise, FindErrorExercise, ItemKind } from './types'
import { kindsFor } from './ladder'
import { Rng, hashString } from './random'
import { words as wordsOf } from '../lang/es/normalize'
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
}

export interface GenOptions {
  seed?: number
  /** Target number of exercises. */
  count?: number
}

export function sentenceId(lessonId: string, index: number, s: Sentence): string {
  return s.id ?? `s.${lessonId}.${index + 1}`
}

const GRAMMAR_TIP_KINDS = new Set<ExerciseKind>(['fillBlank', 'conjugate', 'typeEs', 'wordBank', 'order'])

/** Lesson generator: introduce new words, then drill sentences at the learner's stage. */
export function generateLesson(lesson: Lesson, ctx: GenContext, opts: GenOptions = {}): Exercise[] {
  const rng = new Rng(opts.seed ?? hashString(lesson.id + Date.now()))
  const target = opts.count ?? 14
  const out: Exercise[] = []
  const vocabEntries = lesson.vocab.map((id) => ctx.vocab.get(id)).filter((v): v is VocabEntry => Boolean(v))
  const newWords = vocabEntries.filter((v) => (ctx.stageOf(v.id) ?? 0) === 0)
  const lessonWordSet = new Set(vocabEntries.map((v) => v.lemma.toLowerCase()))

  // 1. Words: match in groups of 5, single choices for the rest (cap total word exercises).
  const wordQueue = rng.shuffle(newWords.length ? newWords : vocabEntries)
  while (wordQueue.length >= 4 && out.filter((e) => e.kind === 'match').length < 2) {
    const group = wordQueue.splice(0, Math.min(5, wordQueue.length))
    out.push(matchExercise(group))
  }
  for (const v of wordQueue.slice(0, 3)) out.push(wordChoice(v, ctx, rng, rng.next() < 0.5 ? 'choiceEs' : 'choiceEn'))

  // 2. Sentences: weight toward lower stage; include every sentence once if it fits.
  const sentences = lesson.sentences.map((s, i) => ({ s, id: sentenceId(lesson.id, i, s), stage: ctx.stageOf(sentenceId(lesson.id, i, s)) ?? 0 }))
  const ordered = rng.shuffle(sentences).sort((a, b) => a.stage - b.stage)
  const slots = Math.max(6, target - out.length)
  const chosen = ordered.slice(0, slots)
  const taught = new Set<string>()
  for (const { s, id, stage } of chosen) {
    const ex = sentenceExercise(s, id, stage, lesson, ctx, rng, lessonWordSet)
    if (!ex) continue
    const tip = [...lesson.teach, ...s.grammar].find((g) => !taught.has(g) && lesson.teach.includes(g))
    if (tip && GRAMMAR_TIP_KINDS.has(ex.kind)) {
      ex.teach = tip
      taught.add(tip)
    }
    out.push(ex)
  }
  // 3. If short, add second exercises for sentences with a different kind.
  let i = 0
  while (out.length < target && i < chosen.length) {
    const { s, id, stage } = chosen[i]!
    const ex = sentenceExercise(s, id, Math.min(3, stage + 1) as Stage, lesson, ctx, rng, lessonWordSet, out.filter((e) => e.items.includes(id)).map((e) => e.kind))
    if (ex) out.push(ex)
    i++
  }
  // interleave: keep the first match early, then shuffle lightly so words and sentences mix
  const head = out.slice(0, 1)
  const rest = rng.shuffle(out.slice(1))
  return [...head, ...rest]
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
  for (const c of wordCards) {
    if (matched.has(c.id)) continue
    const v = lookup.word(c.id)
    if (!v) continue
    const kinds = kindsFor('word', c.stage).filter((k) => k !== 'match' && (ctx.speech || k !== 'speak'))
    const kind = rng.pick(kinds)
    out.push(wordExercise(v, kind, ctx, rng))
  }
  for (const c of cards.filter((x) => x.kind === 'sentence')) {
    const found = lookup.sentence(c.id)
    if (!found) continue
    const ex = sentenceExercise(found.s, c.id, c.stage, found.lesson, ctx, rng, new Set())
    if (ex) out.push(ex)
  }
  return rng.shuffle(out)
}

// ---------------------------------------------------------------------------
// word exercises

function matchExercise(group: VocabEntry[]): MatchExercise {
  return {
    kind: 'match',
    items: group.map((v) => v.id),
    grammar: [],
    pairs: group.map((v) => ({ left: v.lemma, right: v.en[0]! })),
  }
}

function distractorWords(v: VocabEntry, ctx: GenContext, rng: Rng, n: number): VocabEntry[] {
  const same = ctx.pool.filter((p) => p.id !== v.id && p.pos === v.pos && p.en[0] !== v.en[0] && p.lemma !== v.lemma)
  const any = ctx.pool.filter((p) => p.id !== v.id && p.en[0] !== v.en[0] && p.lemma !== v.lemma)
  const picked = rng.sample(same, n)
  if (picked.length < n) picked.push(...rng.sample(any.filter((a) => !picked.includes(a)), n - picked.length))
  return picked
}

function wordChoice(v: VocabEntry, ctx: GenContext, rng: Rng, kind: 'choiceEs' | 'choiceEn' | 'listen'): ChoiceExercise {
  const ds = distractorWords(v, ctx, rng, 3)
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
      return { kind: 'dictation', items: [v.id], grammar: [], prompt: 'Type what you hear', audio: v.lemma, answers: [v.lemma], translation: v.en[0] } satisfies TypeExercise
    case 'speak':
      return { kind: 'speak', items: [v.id], grammar: [], prompt: v.lemma, answers: [v.lemma], translation: v.en[0] } satisfies TypeExercise
    default:
      return { kind: 'typeEs', items: [v.id], grammar: [], prompt: v.en.join(' / '), answers: [v.lemma, ...(v.forms ?? [])], hint: posHint(v), translation: v.lemma } satisfies TypeExercise
  }
}

function posHint(v: VocabEntry): string | undefined {
  if (v.pos === 'noun' && v.gender) return v.gender === 'm' ? 'masculine noun' : v.gender === 'f' ? 'feminine noun' : 'noun'
  if (v.pos === 'verb') return 'verb (infinitive)'
  return undefined
}

// ---------------------------------------------------------------------------
// sentence exercises

function sentenceExercise(s: Sentence, id: string, stage: Stage, lesson: Lesson, ctx: GenContext, rng: Rng, lessonWords: Set<string>, exclude: ExerciseKind[] = []): Exercise | undefined {
  let kinds = kindsFor('sentence', stage).filter((k) => !exclude.includes(k))
  if (s.kinds) kinds = kinds.filter((k) => s.kinds!.includes(k))
  if (!ctx.speech) kinds = kinds.filter((k) => k !== 'speak')
  if (!s.transform) kinds = kinds.filter((k) => k !== 'transform')
  if (!s.error) kinds = kinds.filter((k) => k !== 'findError')
  if (wordsOf(s.es).length < 3) kinds = kinds.filter((k) => k !== 'wordBank' && k !== 'order')
  if (kinds.length === 0) kinds = ['typeEs']
  // grammar-focused lessons: prefer conjugate when a verb from the lesson is in the sentence
  const verbInfo = findVerbForm(s.es, lesson, ctx)
  if (verbInfo && stage >= 1 && rng.next() < 0.35) kinds = ['conjugate']
  const kind = rng.pick(kinds)
  const base = { items: [id, ...s.vocab], grammar: s.grammar }
  switch (kind) {
    case 'choiceEs':
    case 'listen': {
      const others = rng.sample(lesson.sentences.filter((o) => o.en !== s.en), 3).map((o) => o.en)
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
      return { ...base, kind, prompt: s.es, hint: s.transform!.instruction, answers: [s.transform!.answer, ...s.transform!.alt], translation: s.en } satisfies TypeExercise
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
    const hit = ws.find((w) => forms.has(w) && w !== v.lemma.toLowerCase() ? true : forms.has(w))
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
    const otherWords = (lesson?.sentences ?? []).flatMap((o) => wordsOf(o.es)).filter((w) => !ws.includes(w) && w.length > 2)
    distractors = [...new Set([...distractors, ...otherWords])]
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
  }
}
