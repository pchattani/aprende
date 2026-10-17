/**
 * Zod schemas for every content file. The content is authored in YAML under
 * `content/<lang>/` and validated both at build time (scripts/check-content.ts)
 * and in tests. Types are inferred from the schemas so that the engine and the
 * UI share one definition.
 */
import { z } from 'zod'
import { ART_KINDS, WEAR_SLOTS, WARDROBE_KINDS, WARDROBE_COLOURS } from './artKinds'

export const LevelId = z.enum(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'])
export type LevelId = z.infer<typeof LevelId>
export const LEVEL_ORDER: LevelId[] = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']

export const PartOfSpeech = z.enum([
  'noun', 'verb', 'adj', 'adv', 'prep', 'conj', 'pron', 'det', 'num', 'interj', 'phrase',
  // Cantonese: measure words (個, 隻, 本) and sentence-final / aspect particles (呀, 咗, 緊)
  'classifier', 'particle',
])
export type PartOfSpeech = z.infer<typeof PartOfSpeech>

export const Gender = z.enum(['m', 'f', 'mf'])

/** A pair of target-language text and source-language gloss, with accepted alternatives. */
export const Pair = z.object({
  es: z.string().min(1),
  en: z.string().min(1),
  /** Alternative accepted answers when translating into Spanish. */
  altEs: z.array(z.string()).default([]),
  /** Alternative accepted answers when translating into English. */
  altEn: z.array(z.string()).default([]),
})
export type Pair = z.infer<typeof Pair>

// ---------------------------------------------------------------------------
// pack.yaml
export const PackSchema = z.object({
  id: z.string(),
  name: z.string(),
  nativeName: z.string(),
  locale: z.string(),
  sourceLanguage: z.string(),
  variety: z.object({
    default: z.string(),
    label: z.string(),
    alternatives: z.array(z.object({ code: z.string(), label: z.string() })).default([]),
  }),
  tts: z.object({ lang: z.string(), preferredVoices: z.array(z.string()).default([]) }),
  /** Speech-recognition locale (defaults to the TTS language). */
  stt: z.string().optional(),
  /** Path segment under the site (`''` for the root course, `cantonese` → /aprende/cantonese/). */
  slug: z.string().default(''),
  flag: z.string().default('🌍'),
  features: z
    .object({
      /** Verb conjugation tables and conjugate exercises. */
      conjugation: z.boolean().default(true),
      /** Grammatical gender on nouns (articles, agreement). */
      gender: z.boolean().default(true),
      /** Romanisation shown above the script (Cantonese Jyutping). */
      romanization: z.enum(['none', 'jyutping']).default('none'),
      /** Measure words on nouns and a classifier trainer. */
      classifiers: z.boolean().default(false),
    })
    .default({ conjugation: true, gender: true, romanization: 'none', classifiers: false }),
  /** Characters offered on the helper row under text boxes. */
  specialChars: z.array(z.string()).default([]),
})
export type Pack = z.infer<typeof PackSchema>

// ---------------------------------------------------------------------------
// ui.yaml: interface text in the target language
const Line = z.object({ es: z.string(), en: z.string() })
export const UiSchema = z.object({
  appName: z.string(),
  tagline: z.string(),
  welcome: z.object({ title: z.string(), intro: z.string(), firstStop: z.string() }),
  greetings: z.object({ morning: z.string(), afternoon: z.string(), evening: z.string() }),
  feedback: z.object({ correct: z.string(), almost: z.string(), goalDone: z.string() }),
  stampEarned: z.string(),
  spicyName: z.string(),
  games: z.object({ name: z.string(), memory: z.string(), rapid: z.string(), win: z.string() }),
  dogsPage: z.string(),
  quizGreat: z.string(),
  whatDoesItMean: z.string(),
  badgeName: z.string(),
  typePlaceholder: z.string(),
  voiceTest: z.string(),
  voiceHelp: z.string(),
  pronunciationIntro: z.string(),
  cheers: z.array(Line).min(3),
  quests: z.record(z.string(), z.string()),
  dogLines: z.object({ leo: z.array(z.string()).min(3), bonchita: z.array(z.string()).min(3), luna: z.array(z.string()).min(3) }),
  unitStickers: z.record(z.string(), z.string()).default({}),
  /** In-lesson game feel: what the companion dog says, and the streak banners. `{n}` is the count. */
  game: z
    .object({
      /** The companion dog's reaction to a right answer. */
      correct: z.array(z.string()).min(1).default(['Nice!', 'Yes!', 'Great!', 'Woof!']),
      almost: z.array(z.string()).min(1).default(['Almost!', 'So close!']),
      wrong: z.array(z.string()).min(1).default(['Nearly!', 'Next time!', 'Keep going!']),
      /** Streak banners at 3, 5 and 10 answers in a row. */
      combo: z.array(z.string()).length(3).default(['On a roll!', 'Unstoppable!', 'Amazing!']),
      inARow: z.string().includes('{n}').default('{n} in a row'),
      halfway: z.string().default('Halfway!'),
      lastOne: z.string().default('Last one!'),
      letsGo: z.string().default("Let's go!"),
    })
    .prefault({}),
  /** The coins of the game, named after the country's money (pesos, reais, euros, 蚊). `plural` defaults to `name`. */
  currency: z.object({ name: z.string(), plural: z.string().optional(), symbol: z.string() }).default({ name: 'coin', plural: 'coins', symbol: '¢' }),
})
export type Ui = z.infer<typeof UiSchema>

// ---------------------------------------------------------------------------
// journey.yaml: regions (one per level) and stops (one per unit, in order), souvenirs
export const WearSlot = z.enum(WEAR_SLOTS)
/** An illustration kind from src/engine/artKinds.ts (drawn by SouvenirArt). */
export const ArtKind = z.enum(ART_KINDS)
const HexColour = z.string().regex(/^#[0-9a-f]{6}$/i, 'colour like #d4483c')
export const JourneySchema = z.object({
  regions: z.array(
    z.object({
      level: z.enum(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']),
      name: z.string(),
      es: z.string(),
      stops: z.array(z.object({ name: z.string(), emoji: z.string(), es: z.string(), en: z.string(), fact: Line.optional() })).min(1),
    }),
  ),
  souvenirs: z.array(
    z.object({
      id: z.string().regex(/^[a-z0-9-]+$/),
      level: z.enum(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']),
      emoji: z.string(),
      /** What SouvenirArt draws, and its main colour. */
      art: ArtKind,
      color: HexColour.optional(),
      es: z.string(),
      en: z.string(),
      blurb: z.string(),
      slot: WearSlot.optional(),
    }),
  ),
})
export type JourneyFile = z.infer<typeof JourneySchema>

// ---------------------------------------------------------------------------
// wardrobe.yaml: target-language names of the coloured accessories (src/engine/wardrobe.ts).
// Each kind's name holds {colour} where the colour word goes; `form` picks the colour form
// that agrees with the noun (ms/fs/mp/fp: masculine/feminine, singular/plural).
export const ColourForm = z.enum(['ms', 'fs', 'mp', 'fp'])
export type ColourForm = z.infer<typeof ColourForm>
const ColourWord = z.union([z.string().min(1), z.object({ ms: z.string().min(1), fs: z.string().min(1), mp: z.string().min(1), fp: z.string().min(1) })])
const kindIds = WARDROBE_KINDS.map((k) => k.kind)
export const WardrobeSchema = z.object({
  kinds: z.record(z.string(), z.object({ name: z.string().includes('{colour}'), form: ColourForm.default('ms') })).superRefine((m, ctx) => {
    for (const k of kindIds) if (!m[k]) ctx.addIssue({ code: 'custom', message: `missing wardrobe kind ${k}` })
    for (const k of Object.keys(m)) if (!kindIds.includes(k as (typeof kindIds)[number])) ctx.addIssue({ code: 'custom', message: `unknown wardrobe kind ${k}` })
  }),
  colours: z.record(z.string(), ColourWord).superRefine((m, ctx) => {
    for (const c of WARDROBE_COLOURS) if (!m[c.id]) ctx.addIssue({ code: 'custom', message: `missing wardrobe colour ${c.id}` })
  }),
})
export type WardrobeFile = z.infer<typeof WardrobeSchema>

// ---------------------------------------------------------------------------
// syllabus.yaml
export const UnitMeta = z.object({
  id: z.string().regex(/^[a-c][12]\.u\d{2}$/, 'unit id like a1.u01'),
  title: z.string(),
  subtitle: z.string().default(''),
  canDo: z.array(z.string()).default([]),
  grammar: z.array(z.string()).default([]),
  /** Unit content file exists (sentences/dialogues authored). */
  authored: z.boolean().default(false),
})
export type UnitMeta = z.infer<typeof UnitMeta>

export const LevelMeta = z.object({
  id: LevelId,
  title: z.string(),
  name: z.string(),
  description: z.string(),
  canDo: z.array(z.string()).default([]),
  wordTarget: z.number().int().positive(),
  units: z.array(UnitMeta),
})
export type LevelMeta = z.infer<typeof LevelMeta>

export const SyllabusSchema = z.object({ levels: z.array(LevelMeta) })
export type Syllabus = z.infer<typeof SyllabusSchema>

// ---------------------------------------------------------------------------
// grammar/<level>.yaml : list of notes
export const GrammarNote = z.object({
  id: z.string().regex(/^g\.[a-z0-9-]+$/, 'grammar id like g.ser-present'),
  level: LevelId,
  title: z.string(),
  summary: z.string(),
  /** Markdown-ish explanation (headings ###, bullets, tables, **bold**, *italic*). */
  explanation: z.string(),
  examples: z.array(Pair).default([]),
  pitfalls: z.array(z.string()).default([]),
  /** Notes on Latin American or other variety differences. */
  variant: z.string().optional(),
  related: z.array(z.string()).default([]),
  /** Pattern sentences used to drill this point in review sessions. */
  drills: z.array(Pair).default([]),
})
export type GrammarNote = z.infer<typeof GrammarNote>
export const GrammarFileSchema = z.array(GrammarNote)

// ---------------------------------------------------------------------------
// vocab/<level>.yaml : list of lemmas
export const VocabEntry = z.object({
  id: z.string().regex(/^w\.[\p{Ll}0-9-]+(\.[a-z]+)?$/u, 'word id like w.casa or w.banco.n'),
  lemma: z.string(),
  pos: PartOfSpeech,
  gender: Gender.optional(),
  /** Irregular plural (nouns) or feminine form (adjectives) overrides. */
  plural: z.string().optional(),
  feminine: z.string().optional(),
  en: z.array(z.string()).min(1),
  level: LevelId,
  unit: z.string().optional(),
  /** Semantic field (directions, food, family, body…) used to pick plausible distractors. */
  topic: z.string().regex(/^[a-z][a-z0-9-]*$/).optional(),
  /** Corpus frequency rank (lower = more frequent). */
  rank: z.number().int().positive().optional(),
  example: Pair.optional(),
  /** Explicit surface forms for words the inflector cannot derive (el: [el, la, los, las]). */
  forms: z.array(z.string()).optional(),
  variant: z.record(z.string(), z.string()).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  /** Cantonese: Jyutping of the lemma, syllables separated by spaces (nei5 hou2). */
  jp: z.string().regex(/^[a-z]+[1-6]( [a-z]+[1-6])*$/).optional(),
  /** Cantonese: the measure word this noun takes (隻 for 狗). */
  cl: z.string().optional(),
})
export type VocabEntry = z.infer<typeof VocabEntry>
export const VocabFileSchema = z.array(VocabEntry)

// ---------------------------------------------------------------------------
// units/<level>/<unit>.yaml
export const ExerciseKind = z.enum([
  'choiceEs', // see Spanish, pick English
  'choiceEn', // see English, pick Spanish
  'wordBank', // tiles -> Spanish sentence
  'typeEs', // English -> type Spanish
  'typeEn', // Spanish -> type English
  'listen', // hear Spanish, pick meaning
  'dictation', // hear Spanish, type it
  'match', // pairs
  'fillBlank', // choose the missing word
  'conjugate', // type the verb form
  'transform', // rewrite sentence (tense/person/negation)
  'findError', // tap the wrong word, type the fix
  'speak', // read aloud, STT
  'order', // reorder scrambled words (grammar focus)
  'reply', // read a question/line, pick the natural reply
  'orderText', // put the sentences of a mini-text in order
])
export type ExerciseKind = z.infer<typeof ExerciseKind>

export const Sentence = Pair.extend({
  id: z.string().optional(),
  /** Grammar point ids this sentence exercises. */
  grammar: z.array(z.string()).default([]),
  /** Vocabulary ids this sentence is primarily about (for SRS linkage). */
  vocab: z.array(z.string()).default([]),
  /** Restrict exercise kinds for this sentence. */
  kinds: z.array(ExerciseKind).optional(),
  /** For transform exercises: instruction + answer. */
  transform: z
    .object({ instruction: z.string(), answer: z.string(), alt: z.array(z.string()).default([]), /** English of the transformed sentence (shown after answering). */ en: z.string().optional() })
    .optional(),
  /** For findError: the incorrect version and explanation. */
  error: z.object({ wrong: z.string(), explain: z.string(), grammar: z.string().optional() }).optional(),
  /** Literal / cultural note. */
  note: z.string().optional(),
  /** Latin American (or other regional) way of saying it, shown as a note. */
  variant: z.string().optional(),
  /** Cantonese: Jyutping override when automatic romanisation would pick the wrong reading. */
  jp: z.string().optional(),
})
export type Sentence = z.infer<typeof Sentence>

/** A short question → answer pair (or statement → reaction) for conversational practice. */
export const Exchange = z.object({
  q: Pair,
  a: Pair,
  /** Other natural replies accepted (Spanish). */
  alt: z.array(z.string()).default([]),
  grammar: z.array(z.string()).default([]),
  vocab: z.array(z.string()).default([]),
})
export type Exchange = z.infer<typeof Exchange>

/** A 2–4 sentence mini-text (message, note, caption, announcement) in Spanish with translation. */
export const MiniText = z.object({
  title: z.string().optional(),
  /** Sentences in order (each its own string) so they can be scrambled, dictated or translated. */
  es: z.array(z.string()).min(2).max(5),
  en: z.array(z.string()).min(2).max(5),
  grammar: z.array(z.string()).default([]),
  vocab: z.array(z.string()).default([]),
})
export type MiniText = z.infer<typeof MiniText>

export const DialogueLine = z.object({ speaker: z.string(), es: z.string(), en: z.string() })
export const Question = z.object({
  q: z.string(),
  options: z.array(z.string()).min(2),
  answer: z.number().int().nonnegative(),
  explain: z.string().optional(),
})
export type Question = z.infer<typeof Question>

export const Dialogue = z.object({
  id: z.string(),
  title: z.string(),
  context: z.string().optional(),
  lines: z.array(DialogueLine).min(2),
  questions: z.array(Question).default([]),
})
export type Dialogue = z.infer<typeof Dialogue>

export const Lesson = z.object({
  id: z.string().regex(/^[a-c][12]\.u\d{2}\.l\d$/, 'lesson id like a1.u01.l1'),
  title: z.string(),
  /** Grammar note shown before the exercises (first time). */
  teach: z.array(z.string()).default([]),
  /** New vocabulary introduced in this lesson. */
  vocab: z.array(z.string()).default([]),
  sentences: z.array(Sentence).min(4),
  /** Question → answer pairs: the learner answers the question or reacts to the line. */
  exchanges: z.array(Exchange).default([]),
  /** Mini-texts of 2–4 sentences, used for ordering, dictation and reading in context. */
  texts: z.array(MiniText).default([]),
  /** Optional tip shown at the start (plain text). */
  tip: z.string().optional(),
  /** Opt-in "modo picante" sentences: cheeky, flirty, PG-13, reusing the lesson's grammar. Off by default. */
  spicy: z.array(Sentence).default([]),
})
export type Lesson = z.infer<typeof Lesson>

export const UnitSchema = z.object({
  id: z.string().regex(/^[a-c][12]\.u\d{2}$/),
  title: z.string(),
  lessons: z.array(Lesson).min(1),
  dialogues: z.array(Dialogue).default([]),
})
export type Unit = z.infer<typeof UnitSchema>

// ---------------------------------------------------------------------------
// readers/<level>/<id>.yaml
/**
 * A glossary entry. In YAML flow style an unquoted gloss with commas ({ es: x, en: trip, excursion })
 * parses as en: "trip" plus an empty key "excursion"; those keys are folded back into the gloss.
 */
const GlossEntry = z.preprocess((v) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return v
  const o = v as Record<string, unknown>
  const extra = Object.keys(o).filter((k) => k !== 'es' && k !== 'en' && (o[k] === null || o[k] === undefined))
  return extra.length ? { es: o.es, en: [String(o.en), ...extra].join(', ') } : v
}, z.object({ es: z.string(), en: z.string() }))

export const Reader = z.object({
  id: z.string(),
  level: LevelId,
  title: z.string(),
  kind: z.enum(['text', 'dialogue', 'literature']),
  author: z.string().optional(),
  source: z.string().optional(),
  intro: z.string().optional(),
  paragraphs: z.array(Pair).min(1),
  questions: z.array(Question).default([]),
  glossary: z.array(GlossEntry).default([]),
  /** Words allowed beyond the level's vocabulary (names, cognates) for the i+1 check. */
  allow: z.array(z.string()).default([]),
})
export type Reader = z.infer<typeof Reader>

// ---------------------------------------------------------------------------
// phonology/*.yaml
export const PhonologyLesson = z.object({
  id: z.string(),
  title: z.string(),
  explanation: z.string(),
  items: z.array(z.object({ es: z.string(), ipa: z.string().optional(), tip: z.string().optional() })).default([]),
  minimalPairs: z.array(z.tuple([z.string(), z.string()])).default([]),
  practice: z.array(z.string()).default([]),
})
export type PhonologyLesson = z.infer<typeof PhonologyLesson>
export const PhonologyFileSchema = z.object({ lessons: z.array(PhonologyLesson) })

// ---------------------------------------------------------------------------
// exams/<level>.yaml
export const ExamSchema = z.object({
  level: LevelId,
  title: z.string(),
  passScore: z.number().min(0).max(1).default(0.8),
  reading: z.object({ text: z.string(), questions: z.array(Question).min(3) }),
  listening: z.object({ dictation: z.array(z.string()).min(3), questions: z.array(z.object({ audio: z.string(), options: z.array(z.string()), answer: z.number().int() })).default([]) }),
  grammar: z.array(z.object({ prompt: z.string(), options: z.array(z.string()).min(2), answer: z.number().int(), explain: z.string().optional() })).min(5),
  writing: z.object({ prompt: z.string(), minWords: z.number().int(), modelAnswer: z.string(), checklist: z.array(z.string()).min(3) }),
  speaking: z.array(z.string()).min(3),
})
export type Exam = z.infer<typeof ExamSchema>

// ---------------------------------------------------------------------------
// errors/common-errors.yaml
export const ErrorRule = z.object({
  id: z.string(),
  /** JavaScript regex source, applied case-insensitively to normalized text with word boundaries respected by the author. */
  pattern: z.string(),
  message: z.string(),
  grammar: z.string().optional(),
  example: z.object({ wrong: z.string(), right: z.string() }).optional(),
  level: LevelId.default('a1'),
})
export type ErrorRule = z.infer<typeof ErrorRule>
export const ErrorsFileSchema = z.object({ rules: z.array(ErrorRule) })

// ---------------------------------------------------------------------------
// verbs/irregular.yaml
const Six = z.array(z.string()).length(6)
export const IrregularVerb = z.object({
  lemma: z.string(),
  /** Stem change in stressed syllables: e>ie, o>ue, e>i, u>ue, i>ie. */
  stemChange: z.enum(['e>ie', 'o>ue', 'e>i', 'u>ue', 'i>ie']).optional(),
  /** -ir verbs with e>i / o>u in gerund and 3rd person preterite / subjunctive nosotros/vosotros. */
  irVowelRaise: z.enum(['e>i', 'o>u']).optional(),
  /** Irregular first-person present (tengo, hago, conozco); drives present subjunctive. */
  yo: z.string().optional(),
  /** Full present override. */
  pres: Six.optional(),
  /** Strong preterite stem (tuv, hic, dij...); takes unstressed endings. */
  pretStem: z.string().optional(),
  /** Full preterite override. */
  pret: Six.optional(),
  impf: Six.optional(),
  /** Future/conditional stem (tendr, har, dir). */
  futStem: z.string().optional(),
  subjPres: Six.optional(),
  /** Affirmative tú imperative (ten, haz, di, pon). */
  impTu: z.string().optional(),
  /** Full affirmative imperative override (index 0 unused). */
  impAff: z.array(z.string()).length(6).optional(),
  /** -iar/-uar verbs whose i/u is stressed in strong forms: envío, continúo, prohíbo, reúno. */
  stressHiatus: z.boolean().optional(),
  participle: z.string().optional(),
  gerund: z.string().optional(),
  /** Verbs like 'conocer' (c>zc), 'seguir' (gu>g), 'coger' (g>j): handled by orthography unless listed. */
  note: z.string().optional(),
})
export type IrregularVerb = z.infer<typeof IrregularVerb>
export const VerbsFileSchema = z.object({ verbs: z.array(IrregularVerb) })
