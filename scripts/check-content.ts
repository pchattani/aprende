/**
 * Validates every content file against the schemas and cross-checks ids,
 * coverage and minimum sizes. Exit code 1 on any error.
 *
 *   npm run content:check
 */
import { join, relative } from 'node:path'
import type { z } from 'zod'
import { existsSync } from 'node:fs'
import {
  PackSchema, SyllabusSchema, GrammarFileSchema, VocabFileSchema, UnitSchema, Reader, PhonologyFileSchema,
  ExamSchema, ErrorsFileSchema, VerbsFileSchema, LEVEL_ORDER, type GrammarNote, type VocabEntry, type LevelId,
} from '../src/engine/schema'
import { buildDictionary, lookup } from '../src/lang/es/inflect'
import { tokenize } from '../src/lang/es/tokenize'
import { conjugate } from '../src/lang/es/conjugator'
import { CONTENT, ROOT, readYaml, listYaml, unitIdFromPath } from './content-lib'

const MIN_LESSONS_PER_UNIT = 3
const MIN_SENTENCES_PER_LESSON = 8
const MAX_UNKNOWN_RATIO_READER = 0.06
const MAX_UNKNOWN_RATIO_LITERATURE = 0.12
const MAX_UNKNOWN_RATIO_UNIT = 0.1

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

// ---- pack, syllabus
parse(PackSchema, join(CONTENT, 'pack.yaml'))
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

// ---- verbs
const verbsData = parse(VerbsFileSchema, join(CONTENT, 'verbs', 'irregular.yaml'))
const verbs = new Map((verbsData?.verbs ?? []).map((v) => [v.lemma, v]))
for (const v of verbs.values()) {
  try {
    conjugate(v.lemma, verbs)
  } catch (e) {
    err(`verbs: ${v.lemma}: ${(e as Error).message}`)
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
    if (e.pos === 'noun' && !e.gender) err(`${rel(p)}: noun ${e.id} needs a gender`)
    if (e.unit && !unitLevel.has(e.unit)) err(`${rel(p)}: ${e.id} references unknown unit ${e.unit}`)
    if (e.unit && unitLevel.get(e.unit) !== e.level) err(`${rel(p)}: ${e.id} level ${e.level} does not match unit ${e.unit}`)
  }
}

// dictionary per level (cumulative)
const dictByLevel = new Map<LevelId, Map<string, VocabEntry[]>>()
for (const lvl of LEVEL_ORDER) {
  const max = LEVEL_ORDER.indexOf(lvl)
  const entries = [...vocab.values()].filter((v) => LEVEL_ORDER.indexOf(v.level) <= max)
  dictByLevel.set(lvl, buildDictionary(entries, verbs))
}
const ALWAYS_KNOWN = new Set(['y', 'e', 'o', 'u', 'a', 'de', 'en', 'el', 'la', 'los', 'las', 'un', 'una', 'que', 'no', 'se', 'me', 'te', 'le', 'lo', 'es', 'por', 'para', 'con', 'su', 'mi', 'tu', 'al', 'del', 'tan', 'buen', 'ti', 'mí', 'sí', 'cada', 'fin', 'conmigo', 'contigo', 'ni', 'qué', 'cómo', 'quién', 'cuál', 'dónde', 'cuándo', 'cuánto', 'cuánta', 'cuántos', 'cuántas', 'tal', 'ya', 'más', 'menos', 'muy', 'bien', 'así', 'aquí', 'allí', 'ahí'])
function unknownWords(text: string, level: LevelId, allow: Set<string>): string[] {
  const dict = dictByLevel.get(level)!
  const out: string[] = []
  for (const t of tokenize(text)) {
    if (t.kind !== 'word') continue
    const w = t.text.toLowerCase()
    if (lookup(dict, w) || ALWAYS_KNOWN.has(w) || allow.has(w)) continue
    if (/^[A-ZÁÉÍÓÚÑ]/.test(t.text)) continue // proper nouns / sentence starts are checked lowercased above; capitalised unknowns pass
    out.push(w)
  }
  return out
}

// ---- units
const unitVocabUse = new Set<string>()
for (const p of listYaml(join(CONTENT, 'units'))) {
  const unit = parse(UnitSchema, p)
  if (!unit) continue
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
    }
    for (const x of l.exchanges) {
      for (const g of x.grammar) if (!grammar.has(g)) err(`${rel(p)}: exchange "${x.q.es}" tags unknown grammar ${g}`)
      for (const v of x.vocab) if (!vocab.has(v)) err(`${rel(p)}: exchange "${x.q.es}" tags unknown vocab ${v}`)
      for (const t of [x.q.es, x.a.es]) {
        tokens += tokenize(t).filter((tk) => tk.kind === 'word').length
        unknown.push(...unknownWords(t, level, allow))
      }
    }
    for (const t of l.texts) {
      if (t.es.length !== t.en.length) err(`${rel(p)}: ${l.id} mini-text "${t.es[0]}" has ${t.es.length} Spanish and ${t.en.length} English sentences`)
      for (const g of t.grammar) if (!grammar.has(g)) err(`${rel(p)}: mini-text "${t.es[0]}" tags unknown grammar ${g}`)
      for (const v of t.vocab) if (!vocab.has(v)) err(`${rel(p)}: mini-text "${t.es[0]}" tags unknown vocab ${v}`)
      for (const sent of t.es) {
        tokens += tokenize(sent).filter((tk) => tk.kind === 'word').length
        unknown.push(...unknownWords(sent, level, allow))
      }
    }
    if (l.exchanges.length < 3 || l.texts.length < 1) warn(`${rel(p)}: ${l.id} has ${l.exchanges.length} exchanges and ${l.texts.length} mini-texts (aim for ≥3 and ≥1 for variety)`)
  })
  for (const d of unit.dialogues) {
    for (const q of d.questions) if (q.answer >= q.options.length) err(`${rel(p)}: dialogue ${d.id} question answer index out of range`)
    for (const line of d.lines) {
      tokens += tokenize(line.es).filter((t) => t.kind === 'word').length
      unknown.push(...unknownWords(line.es, level, allow))
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
for (const v of vocab.values()) {
  if (LEVEL_ORDER.indexOf(v.level) <= LEVEL_ORDER.indexOf('b1') && !unitVocabUse.has(v.id) && !v.tags.includes('passive')) {
    warn(`vocab: ${v.id} (${v.level}) is never introduced by a lesson`)
  }
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

report()
process.exit(errors.length ? 1 : 0)

function report() {
  for (const w of warnings) console.log(`warn  ${w}`)
  for (const e of errors) console.log(`ERROR ${e}`)
  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`)
}
