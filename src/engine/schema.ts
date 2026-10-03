/**
 * Zod schemas for every content file. The content is authored in YAML under
 * `content/<lang>/` and validated both at build time (scripts/check-content.ts)
 * and in tests. Types are inferred from the schemas so that the engine and the
 * UI share one definition.
 */
import { z } from 'zod'

export const LevelId = z.enum(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'])
export type LevelId = z.infer<typeof LevelId>
export const LEVEL_ORDER: LevelId[] = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']

export const PartOfSpeech = z.enum([
  'noun', 'verb', 'adj', 'adv', 'prep', 'conj', 'pron', 'det', 'num', 'interj', 'phrase',
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
})
export type Pack = z.infer<typeof PackSchema>

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
  id: z.string().regex(/^w\.[a-z0-9ñáéíóúü-]+(\.[a-z]+)?$/, 'word id like w.casa or w.banco.n'),
  lemma: z.string(),
  pos: PartOfSpeech,
  gender: Gender.optional(),
  /** Irregular plural (nouns) or feminine form (adjectives) overrides. */
  plural: z.string().optional(),
  feminine: z.string().optional(),
  en: z.array(z.string()).min(1),
  level: LevelId,
  unit: z.string().optional(),
  /** Corpus frequency rank (lower = more frequent). */
  rank: z.number().int().positive().optional(),
  example: Pair.optional(),
  /** Explicit surface forms for words the inflector cannot derive (el: [el, la, los, las]). */
  forms: z.array(z.string()).optional(),
  variant: z.record(z.string(), z.string()).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
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
    .object({ instruction: z.string(), answer: z.string(), alt: z.array(z.string()).default([]) })
    .optional(),
  /** For findError: the incorrect version and explanation. */
  error: z.object({ wrong: z.string(), explain: z.string(), grammar: z.string().optional() }).optional(),
  /** Literal / cultural note. */
  note: z.string().optional(),
})
export type Sentence = z.infer<typeof Sentence>

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
  /** Optional tip shown at the start (plain text). */
  tip: z.string().optional(),
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
  glossary: z.array(z.object({ es: z.string(), en: z.string() })).default([]),
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
