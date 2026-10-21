/**
 * Validates every content file against the schemas and cross-checks ids,
 * coverage and minimum sizes. Exit code 1 on any error.
 *
 *   npm run content:check                  (Spanish)
 *   VITE_LANG=yue npm run content:check    (any course: yue, pt, it)
 */
import { join, relative } from 'node:path'
import type { z } from 'zod'
import { existsSync, readFileSync } from 'node:fs'
import {
  PackSchema, SyllabusSchema, GrammarFileSchema, VocabFileSchema, UnitSchema, Reader, PhonologyFileSchema,
  ExamSchema, ErrorsFileSchema, UiSchema, JourneySchema, WardrobeSchema, LEVEL_ORDER, type GrammarNote, type VocabEntry, type LevelId,
} from '../src/engine/schema'
import { ART_KINDS, WEAR_SLOTS, WARDROBE_KINDS, WARDROBE_COLOURS } from '../src/engine/artKinds'
import type { InflectModule, TokenizeModule, VerbsModule, LanguagePackFull } from '../src/lang/contract'
import { CONTENT, ROOT, LANG, readYaml, listYaml, unitIdFromPath } from './content-lib'

// The course's own language pack (the yaml hooks let its verb tables load outside Vite).
const { buildDictionary, lookup } = (await import(`../src/lang/${LANG}/inflect.ts`)) as InflectModule
const { tokenize } = (await import(`../src/lang/${LANG}/tokenize.ts`)) as TokenizeModule
const verbsModule = (await import(`../src/lang/${LANG}/verbs.ts`)) as VerbsModule
const { languagePack } = (await import(`../src/lang/${LANG}/index.ts`)) as {
  languagePack: LanguagePackFull & { validateText?: (t: string) => string[]; validateReading?: (lemma: string, jp: string) => string[] }
}
import { SPICY_BANNED } from './spicy-banned'
import { collectWriteChars, strokesPath, writeCharIssues, type StrokeEntry } from './strokes-lib.mjs'
import { PICTOGRAMS } from '../src/engine/pictograms'
import { taughtIndex, makeTaughtGate, gateLesson, TAUGHT_MIN_ITEMS } from '../src/engine/taught'

const MIN_LESSONS_PER_UNIT = 3
const MIN_SENTENCES_PER_LESSON = 8
const MAX_UNKNOWN_RATIO_READER = 0.06
const MAX_UNKNOWN_RATIO_LITERATURE = 0.12
const MAX_UNKNOWN_RATIO_UNIT = 0.1
const MIN_DIALOGUE_QUESTIONS = 3
const MAX_SPICY_PER_LESSON = 5
const MIN_TOPIC_WORDS = 4
const stripAcc = (w: string) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
// Each course may list its own banned words (content/<lang>/spicy-banned.yaml); Spanish uses scripts/spicy-banned.ts.
const BANNED = (existsSync(join(CONTENT, 'spicy-banned.yaml')) ? (readYaml(join(CONTENT, 'spicy-banned.yaml')) as string[]) : SPICY_BANNED).map(stripAcc)

const errors: string[] = []
const warnings: string[] = []
const err = (m: string) => errors.push(m)
const warn = (m: string) => warnings.push(m)
const rel = (p: string) => relative(ROOT, p)

function parse<S extends z.ZodTypeAny>(schema: S, path: string): z.infer<S> | undefined {
  const r = schema.safeParse(readYaml(path))
  if (!r.success) {
    for (const i of r.error.issues.slice(0, 10)) err(`${rel(path)}: ${i.path.join('.')}: ${i.message}`)
    return undefined
  }
  return r.data as z.infer<S>
}

// ---- pack, syllabus, interface text, journey
const pack = parse(PackSchema, join(CONTENT, 'pack.yaml'))
const features = pack?.features ?? { conjugation: true, gender: true, romanization: 'none', classifiers: false, taughtOnly: false }
parse(UiSchema, join(CONTENT, 'ui.yaml'))
const journey = parse(JourneySchema, join(CONTENT, 'journey.yaml'))
const syllabus = parse(SyllabusSchema, join(CONTENT, 'syllabus.yaml'))
if (!syllabus) {
  report()
  process.exit(1)
}
const unitLevel = new Map<string, LevelId>()
const grammarRefs = new Map<string, string>() // id -> where
for (const lvl of syllabus.levels) {
  for (const u of lvl.units) {
    if (!u.id.startsWith(lvl.id + '.')) err(`syllabus: unit ${u.id} listed under level ${lvl.id}`)
    if (unitLevel.has(u.id)) err(`syllabus: duplicate unit ${u.id}`)
    unitLevel.set(u.id, lvl.id)
    for (const g of u.grammar) grammarRefs.set(g, u.id)
    const file = join(CONTENT, 'units', lvl.id, u.id.split('.')[1] + '.yaml')
    if (u.authored && !existsSync(file)) err(`syllabus: ${u.id} marked authored but ${rel(file)} is missing`)
    if (!u.authored && existsSync(file)) warn(`syllabus: ${u.id} has a unit file but is not marked authored`)
  }
}

// ---- verbs (the pack parses its own irregular table)
const verbs = verbsModule.IRREGULAR
for (const lemma of verbs.keys()) {
  try {
    verbsModule.conjugateWith(lemma, verbs)
  } catch (e) {
    err(`verbs: ${lemma}: ${(e as Error).message}`)
  }
}

// ---- journey: one region per level and one stop per syllabus unit
if (journey) {
  for (const lvl of syllabus.levels) {
    const r = journey.regions.find((x) => x.level === lvl.id)
    if (!r) err(`journey: no region for ${lvl.id}`)
    else if (r.stops.length !== lvl.units.length) err(`journey: region ${lvl.id} has ${r.stops.length} stops for ${lvl.units.length} units`)
    for (const st of r?.stops ?? []) if (!st.fact) warn(`journey: stop ${st.name} (${lvl.id}) has no fact`)
  }
  const ids = new Set<string>()
  const artKinds = new Set<string>(ART_KINDS)
  const slots = new Set<string>(WEAR_SLOTS)
  for (const sv of journey.souvenirs) {
    if (ids.has(sv.id)) err(`journey: duplicate souvenir ${sv.id}`)
    ids.add(sv.id)
    // wear-* ids belong to the generated wardrobe, badge-* to the region badges
    if (/^(wear|badge)-/.test(sv.id)) err(`journey: souvenir id ${sv.id} uses a reserved prefix`)
    if (!artKinds.has(sv.art)) err(`journey: souvenir ${sv.id} has unknown art kind ${sv.art}`)
    if (sv.slot && !slots.has(sv.slot)) err(`journey: souvenir ${sv.id} has unknown slot ${sv.slot}`)
    if (sv.color && !/^#[0-9a-f]{6}$/i.test(sv.color)) err(`journey: souvenir ${sv.id} colour ${sv.color} is not #rrggbb`)
    if (!sv.es.trim() || !sv.en.trim() || !sv.blurb.trim()) err(`journey: souvenir ${sv.id} needs es, en and blurb`)
  }
  for (const lvl of LEVEL_ORDER) {
    const n = journey.souvenirs.filter((sv) => sv.level === lvl).length
    if (n < 12) warn(`journey: only ${n} souvenirs at ${lvl} (aim for 12)`)
  }
  if (journey.souvenirs.filter((sv) => sv.slot).length < 20) warn('journey: fewer than 20 wearable souvenirs')
}

// ---- wardrobe: a target-language name for every accessory in every colour
const wardrobePath = join(CONTENT, 'wardrobe.yaml')
if (!existsSync(wardrobePath)) err(`${rel(wardrobePath)} is missing`)
else {
  const wardrobe = parse(WardrobeSchema, wardrobePath)
  for (const { kind } of wardrobe ? WARDROBE_KINDS : []) {
    const k = wardrobe!.kinds[kind]
    if (!k) continue // reported by the schema
    for (const c of WARDROBE_COLOURS) {
      const word = wardrobe!.colours[c.id]
      const form = typeof word === 'string' ? word : word?.[k.form]
      if (!form?.trim()) err(`wardrobe: no ${k.form} form of ${c.id} for ${kind}`)
      const name = k.name.replace('{colour}', form ?? '')
      if (/[{}]/.test(name) || name.trim() === k.name.replace('{colour}', '').trim()) err(`wardrobe: bad name for ${kind} / ${c.id}: ${name}`)
    }
  }
}

// ---- grammar
const grammar = new Map<string, GrammarNote>()
for (const p of listYaml(join(CONTENT, 'grammar'))) {
  const notes = parse(GrammarFileSchema, p)
  if (!notes) continue
  for (const n of notes) {
    if (grammar.has(n.id)) err(`${rel(p)}: duplicate grammar id ${n.id}`)
    grammar.set(n.id, n)
  }
}
for (const [g, where] of grammarRefs) if (!grammar.has(g)) err(`grammar: ${g} referenced by ${where} has no note`)
for (const n of grammar.values()) {
  if (!grammarRefs.has(n.id)) warn(`grammar: note ${n.id} is not referenced by any unit`)
  for (const r of n.related) if (!grammar.has(r)) err(`grammar: ${n.id} relates to unknown ${r}`)
}

// ---- vocab
const vocab = new Map<string, VocabEntry>()
const lemmaPos = new Map<string, string>()
for (const p of listYaml(join(CONTENT, 'vocab'))) {
  const entries = parse(VocabFileSchema, p)
  if (!entries) continue
  for (const e of entries) {
    if (vocab.has(e.id)) err(`${rel(p)}: duplicate vocab id ${e.id}`)
    vocab.set(e.id, e)
    const key = `${e.lemma.toLowerCase()}|${e.pos}`
    if (lemmaPos.has(key)) warn(`${rel(p)}: lemma ${e.lemma} (${e.pos}) appears twice: ${lemmaPos.get(key)} and ${e.id}`)
    lemmaPos.set(key, e.id)
    if (e.pos === 'noun' && !e.gender && features.gender) err(`${rel(p)}: noun ${e.id} needs a gender`)
    if (features.romanization === 'jyutping') {
      if (!e.jp) err(`${rel(p)}: ${e.id} needs jp (Jyutping)`)
      for (const issue of languagePack.validateText?.(e.lemma) ?? []) err(`${rel(p)}: ${e.id}: ${issue}`)
      if (e.jp) for (const issue of languagePack.validateReading?.(e.lemma, e.jp) ?? []) err(`${rel(p)}: ${e.id}: ${issue}`)
    }
    if (features.classifiers && e.pos === 'noun' && !e.cl && !e.tags.includes('mass') && !e.tags.includes('name')) warn(`${rel(p)}: noun ${e.id} has no classifier (cl)`)
    if (e.unit && !unitLevel.has(e.unit)) err(`${rel(p)}: ${e.id} references unknown unit ${e.unit}`)
    if (e.unit && unitLevel.get(e.unit) !== e.level) err(`${rel(p)}: ${e.id} level ${e.level} does not match unit ${e.unit}`)
  }
}
// topics: a topic with too few words at a level cannot supply plausible distractors
{
  const byTopic = new Map<string, number>()
  for (const v of vocab.values()) if (v.topic) byTopic.set(`${v.level}:${v.topic}`, (byTopic.get(`${v.level}:${v.topic}`) ?? 0) + 1)
  for (const [k, n] of byTopic) if (n < MIN_TOPIC_WORDS) warn(`vocab: topic ${k} has only ${n} word(s) (aim for ≥${MIN_TOPIC_WORDS} so distractors come from the same field)`)
}

languagePack.useVocabulary?.(vocab.values())

// dictionary per level (cumulative)
const dictByLevel = new Map<LevelId, Map<string, VocabEntry[]>>()
for (const lvl of LEVEL_ORDER) {
  const max = LEVEL_ORDER.indexOf(lvl)
  const entries = [...vocab.values()].filter((v) => LEVEL_ORDER.indexOf(v.level) <= max)
  dictByLevel.set(lvl, buildDictionary(entries, verbs))
}
const knownFile = existsSync(join(CONTENT, 'known.yaml')) ? (readYaml(join(CONTENT, 'known.yaml')) as { always?: string[]; names?: string[] }) : {}
const ALWAYS_KNOWN = new Set([...(knownFile.always ?? []), ...(knownFile.names ?? [])].map((w) => w.toLowerCase()))
/** Romanisation / script problems in a target-language string (Cantonese: characters without a reading). */
function scriptIssues(where: string, text: string): void {
  for (const issue of languagePack.validateText?.(text) ?? []) err(`${where}: "${text.slice(0, 40)}": ${issue}`)
}
/** An authored sentence reading (Cantonese `jp`) must fit the characters; it then overrides the automatic one. */
function sentenceReading(where: string, s: { es: string; jp?: string }): void {
  if (!s.jp) return
  for (const issue of languagePack.validateReading?.(s.es, s.jp) ?? []) err(`${where}: "${s.es.slice(0, 30)}" jp: ${issue}`)
  languagePack.useSentenceReadings?.([s])
}
/** A Han segment the segmenter kept whole (a dictionary word) is known if it splits into known words. */
function splitsIntoKnown(w: string, known: (x: string) => boolean): boolean {
  const ok: boolean[] = [true, ...new Array<boolean>(w.length).fill(false)]
  for (let i = 0; i < w.length; i++) {
    if (!ok[i]) continue
    for (let j = i + 1; j <= w.length; j++) if (known(w.slice(i, j))) ok[j] = true
  }
  return ok[w.length]!
}
function unknownWords(text: string, level: LevelId, allow: Set<string>): string[] {
  const dict = dictByLevel.get(level)!
  const out: string[] = []
  for (const t of tokenize(text)) {
    if (t.kind !== 'word') continue
    const w = t.text.toLowerCase()
    if (lookup(dict, w) || ALWAYS_KNOWN.has(w) || allow.has(w)) continue
    if (/\p{Script=Han}/u.test(w) && splitsIntoKnown(w, (x) => Boolean(lookup(dict, x)) || ALWAYS_KNOWN.has(x) || allow.has(x))) continue
    if (/^\p{Lu}/u.test(t.text)) continue // proper nouns / sentence starts are checked lowercased above; capitalised unknowns pass
    out.push(w)
  }
  return out
}

// ---- units
const unitVocabUse = new Set<string>()
const parsedUnits: { unit: z.infer<typeof UnitSchema>; path: string }[] = []
for (const p of listYaml(join(CONTENT, 'units'))) {
  const unit = parse(UnitSchema, p)
  if (!unit) continue
  parsedUnits.push({ unit, path: p })
  const id = unitIdFromPath(p)
  if (unit.id !== id) err(`${rel(p)}: unit id ${unit.id} does not match path (${id})`)
  const level = unitLevel.get(unit.id)
  if (!level) {
    err(`${rel(p)}: unit ${unit.id} is not in the syllabus`)
    continue
  }
  if (unit.lessons.length < MIN_LESSONS_PER_UNIT) err(`${rel(p)}: only ${unit.lessons.length} lessons (min ${MIN_LESSONS_PER_UNIT})`)
  const seenSent = new Set<string>()
  let tokens = 0
  const unknown: string[] = []
  const allow = new Set<string>()
  unit.lessons.forEach((l, i) => {
    if (!l.id.startsWith(unit.id + '.l')) err(`${rel(p)}: lesson ${l.id} must start with ${unit.id}.l`)
    if (l.id !== `${unit.id}.l${i + 1}`) warn(`${rel(p)}: lesson ${l.id} is at position ${i + 1}`)
    if (l.sentences.length < MIN_SENTENCES_PER_LESSON) err(`${rel(p)}: ${l.id} has ${l.sentences.length} sentences (min ${MIN_SENTENCES_PER_LESSON})`)
    for (const g of l.teach) if (!grammar.has(g)) err(`${rel(p)}: ${l.id} teaches unknown grammar ${g}`)
    for (const v of l.vocab) {
      if (!vocab.has(v)) err(`${rel(p)}: ${l.id} introduces unknown vocab ${v}`)
      else unitVocabUse.add(v)
    }
    for (const s of l.sentences) {
      if (seenSent.has(s.es)) warn(`${rel(p)}: duplicate sentence "${s.es}"`)
      seenSent.add(s.es)
      for (const g of s.grammar) if (!grammar.has(g)) err(`${rel(p)}: sentence "${s.es}" tags unknown grammar ${g}`)
      for (const v of s.vocab) if (!vocab.has(v)) err(`${rel(p)}: sentence "${s.es}" tags unknown vocab ${v}`)
      if (s.altEs.includes(s.es)) warn(`${rel(p)}: "${s.es}" lists itself in altEs`)
      if (s.transform && !s.transform.answer) err(`${rel(p)}: "${s.es}" transform without answer`)
      const words = tokenize(s.es).filter((t) => t.kind === 'word')
      tokens += words.length
      unknown.push(...unknownWords(s.es, level, allow))
      for (const a of [s.es, ...s.altEs]) scriptIssues(rel(p), a)
      sentenceReading(rel(p), s)
    }
    for (const x of l.exchanges) {
      for (const g of x.grammar) if (!grammar.has(g)) err(`${rel(p)}: exchange "${x.q.es}" tags unknown grammar ${g}`)
      for (const v of x.vocab) if (!vocab.has(v)) err(`${rel(p)}: exchange "${x.q.es}" tags unknown vocab ${v}`)
      for (const t of [x.q.es, x.a.es]) {
        tokens += tokenize(t).filter((tk) => tk.kind === 'word').length
        unknown.push(...unknownWords(t, level, allow))
        scriptIssues(rel(p), t)
      }
    }
    for (const t of l.texts) {
      if (t.es.length !== t.en.length) err(`${rel(p)}: ${l.id} mini-text "${t.es[0]}" has ${t.es.length} Spanish and ${t.en.length} English sentences`)
      for (const g of t.grammar) if (!grammar.has(g)) err(`${rel(p)}: mini-text "${t.es[0]}" tags unknown grammar ${g}`)
      for (const v of t.vocab) if (!vocab.has(v)) err(`${rel(p)}: mini-text "${t.es[0]}" tags unknown vocab ${v}`)
      for (const sent of t.es) {
        tokens += tokenize(sent).filter((tk) => tk.kind === 'word').length
        unknown.push(...unknownWords(sent, level, allow))
        scriptIssues(rel(p), sent)
      }
    }
    if (l.exchanges.length < 3 || l.texts.length < 1) warn(`${rel(p)}: ${l.id} has ${l.exchanges.length} exchanges and ${l.texts.length} mini-texts (aim for ≥3 and ≥1 for variety)`)
    // modo picante: validated like sentences, plus a banned-word list and a cap
    if (l.spicy.length > MAX_SPICY_PER_LESSON) warn(`${rel(p)}: ${l.id} has ${l.spicy.length} spicy sentences (max ${MAX_SPICY_PER_LESSON})`)
    for (const s of l.spicy) {
      for (const g of s.grammar) if (!grammar.has(g)) err(`${rel(p)}: spicy "${s.es}" tags unknown grammar ${g}`)
      for (const v of s.vocab) if (!vocab.has(v)) err(`${rel(p)}: spicy "${s.es}" tags unknown vocab ${v}`)
      const text = stripAcc(`${s.es} ${s.altEs.join(' ')} ${s.en}`)
      // Chinese has no spaces between words: Han entries match anywhere; others match whole words, hyphenated words
      // counting as one (pique-nique is not nique; trailing * = prefix).
      const hit = BANNED.find((b) => (/\p{Script=Han}/u.test(b) ? text.includes(b.replace(/\*$/, '')) : new RegExp(`(^|[^\\p{L}-])${b.endsWith('*') ? b.slice(0, -1) : `${b}(?=$|[^\\p{L}-])`}`, 'u').test(text)))
      if (hit) err(`${rel(p)}: spicy "${s.es}" contains a banned word (${hit}); keep modo picante cheeky, PG-13 and kind`)
      if (seenSent.has(s.es)) warn(`${rel(p)}: spicy "${s.es}" duplicates a lesson sentence`)
      unknown.push(...unknownWords(s.es, level, allow))
      tokens += tokenize(s.es).filter((t) => t.kind === 'word').length
      scriptIssues(rel(p), s.es)
      sentenceReading(rel(p), s)
    }
  })
  for (const d of unit.dialogues) {
    for (const q of d.questions) if (q.answer >= q.options.length) err(`${rel(p)}: dialogue ${d.id} question answer index out of range`)
    if (d.questions.length < MIN_DIALOGUE_QUESTIONS) warn(`${rel(p)}: dialogue ${d.id} has ${d.questions.length} question(s) (aim for ≥${MIN_DIALOGUE_QUESTIONS}; the region quiz draws on them)`)
    for (const line of d.lines) {
      tokens += tokenize(line.es).filter((t) => t.kind === 'word').length
      unknown.push(...unknownWords(line.es, level, allow))
      scriptIssues(rel(p), line.es)
    }
  }
  const ratio = tokens ? unknown.length / tokens : 0
  if (ratio > MAX_UNKNOWN_RATIO_UNIT) {
    const counts = new Map<string, number>()
    for (const w of unknown) counts.set(w, (counts.get(w) ?? 0) + 1)
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([w, n]) => `${w}×${n}`).join(', ')
    err(`${rel(p)}: ${(ratio * 100).toFixed(1)}% of words are outside the ${level} vocabulary (max ${MAX_UNKNOWN_RATIO_UNIT * 100}%): ${top}`)
  } else if (unknown.length) {
    const uniq = [...new Set(unknown)]
    warn(`${rel(p)}: ${uniq.length} word forms outside ${level} vocabulary: ${uniq.slice(0, 20).join(', ')}${uniq.length > 20 ? '…' : ''}`)
  }
}
// ---- taught-words gate (features.taughtOnly): each lesson needs enough items a beginner can be shown or asked in English
if (features.taughtOnly) {
  const index = taughtIndex(syllabus.levels, parsedUnits.map((u) => u.unit))
  const where = new Map(parsedUnits.flatMap(({ unit, path }) => unit.lessons.map((l) => [l.id, { lesson: l, path }] as const)))
  for (const id of index.order) {
    const { lesson, path } = where.get(id)!
    const r = gateLesson(lesson, makeTaughtGate(index.at(id), vocab, tokenize, knownFile.names ?? []))
    if (r.pass + r.english < TAUGHT_MIN_ITEMS) {
      warn(`${rel(path)}: ${id} has only ${r.pass + r.english} sentences/exchanges/texts in taught words (aim for ≥${TAUGHT_MIN_ITEMS}; npm run taught:report -- --lesson ${id}); blocking: ${r.blocking.slice(0, 8).map(([w, n]) => `${w}×${n}`).join(' ')}`)
    }
  }
}
for (const v of vocab.values()) {
  if (LEVEL_ORDER.indexOf(v.level) <= LEVEL_ORDER.indexOf('b1') && !unitVocabUse.has(v.id) && !v.tags.includes('passive')) {
    warn(`vocab: ${v.id} (${v.level}) is never introduced by a lesson`)
  }
}

// ---- characters to write: each needs stroke data in the bundle (scripts/build-strokes.mjs) and a meaning
{
  const chars = collectWriteChars(CONTENT)
  const file = strokesPath(LANG)
  const bundle = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, StrokeEntry>) : undefined
  for (const issue of writeCharIssues(chars, bundle)) err(`write: ${issue}`)
  const lemmas = new Set([...vocab.values()].map((v) => v.lemma))
  for (const [c, lessons] of chars) if (!lemmas.has(c) && !PICTOGRAMS[c]) warn(`write: ${c} (${lessons.join(', ')}) has no vocabulary entry of its own, so it shows without a meaning`)
}

// ---- readers
for (const p of listYaml(join(CONTENT, 'readers'))) {
  const r = parse(Reader, p)
  if (!r) continue
  const allow = new Set([...r.allow.map((w) => w.toLowerCase()), ...r.glossary.map((g) => g.es.toLowerCase())])
  let tokens = 0
  const unknown: string[] = []
  for (const para of r.paragraphs) {
    tokens += tokenize(para.es).filter((t) => t.kind === 'word').length
    unknown.push(...unknownWords(para.es, r.level, allow))
  }
  for (const q of r.questions) if (q.answer >= q.options.length) err(`${rel(p)}: question answer index out of range`)
  const ratio = tokens ? unknown.length / tokens : 0
  const maxRatio = r.kind === 'literature' ? MAX_UNKNOWN_RATIO_LITERATURE : MAX_UNKNOWN_RATIO_READER
  if (ratio > maxRatio) {
    err(`${rel(p)}: ${(ratio * 100).toFixed(1)}% unknown words for ${r.level} (max ${maxRatio * 100}%): ${[...new Set(unknown)].slice(0, 30).join(', ')}`)
  }
}

// ---- phonology, exams, errors
if (existsSync(join(CONTENT, 'phonology', 'lessons.yaml'))) parse(PhonologyFileSchema, join(CONTENT, 'phonology', 'lessons.yaml'))
else err('phonology/lessons.yaml missing')
for (const p of listYaml(join(CONTENT, 'exams'))) {
  const ex = parse(ExamSchema, p)
  if (!ex) continue
  for (const q of [...ex.reading.questions, ...ex.grammar]) if (q.answer >= q.options.length) err(`${rel(p)}: answer index out of range in "${'q' in q ? q.q : q.prompt}"`)
}
const errorsFile = join(CONTENT, 'errors', 'common-errors.yaml')
if (existsSync(errorsFile)) {
  const rules = parse(ErrorsFileSchema, errorsFile)
  for (const r of rules?.rules ?? []) {
    try {
      new RegExp(r.pattern, 'iu')
    } catch (e) {
      err(`errors: rule ${r.id} has invalid regex: ${(e as Error).message}`)
    }
    if (r.grammar && !grammar.has(r.grammar)) err(`errors: rule ${r.id} references unknown grammar ${r.grammar}`)
  }
} else err('errors/common-errors.yaml missing')

console.log(`course: ${LANG}`)
report()
process.exit(errors.length ? 1 : 0)

function report() {
  for (const w of warnings) console.log(`warn  ${w}`)
  for (const e of errors) console.log(`ERROR ${e}`)
  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`)
}
