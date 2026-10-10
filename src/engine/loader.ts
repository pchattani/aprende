import { z } from 'zod'
import { conjugate, type Conjugation } from '../lang/es/verbs'
/**
 * Content loader. Small, always-needed files (syllabus, grammar notes, vocab,
 * error rules, phonology, reader index) are bundled eagerly; unit lesson files
 * and exams are loaded on demand so the main chunk stays light.
 */
import {
  PackSchema, SyllabusSchema, GrammarFileSchema, VocabFileSchema, UnitSchema, Reader as ReaderSchema,
  PhonologyFileSchema, ExamSchema, ErrorsFileSchema, LEVEL_ORDER,
  type Pack, type Syllabus, type LevelMeta, type UnitMeta, type GrammarNote, type VocabEntry, type Unit,
  type Reader, type PhonologyLesson, type Exam, type ErrorRule, type LevelId, type Lesson,
} from './schema'
import packRaw from '../../content/es/pack.yaml'
import syllabusRaw from '../../content/es/syllabus.yaml'
import synonymsRaw from '../../content/es/synonyms.yaml'
import errorsRaw from '../../content/es/errors/common-errors.yaml'
import phonologyRaw from '../../content/es/phonology/lessons.yaml'

export const pack: Pack = PackSchema.parse(packRaw)
export const syllabus: Syllabus = SyllabusSchema.parse(syllabusRaw)
export const levels: LevelMeta[] = syllabus.levels
export const errorRules: ErrorRule[] = ErrorsFileSchema.parse(errorsRaw).rules
export const phonology: PhonologyLesson[] = PhonologyFileSchema.parse(phonologyRaw).lessons
const SynonymsSchema = z.object({ groups: z.array(z.array(z.string()).min(2)), english: z.array(z.array(z.string()).min(2)).default([]) })
const synonymsFile = SynonymsSchema.parse(synonymsRaw)
/** Spanish synonym/variant groups: the curated file plus every vocabulary entry's es-419 variants. */
export function spanishSynonymGroups(): string[][] {
  const base = [...synonymsFile.groups]
  for (const v of vocab.values()) {
    const alt = v.variant?.['es-419']
    if (!alt) continue
    const forms = alt.split('/').map((x) => x.replace(/\(.*?\)/g, '').trim()).filter(Boolean)
    if (forms.length) base.push([v.lemma, ...forms])
  }
  // Verb groups (echar de menos / extrañar) are expanded to every conjugated form so that
  // "echo de menos" and "extraño" compare equal too.
  const groups: string[][] = []
  for (const g of base) {
    groups.push(g)
    if (!g.every((m) => isVerbPhrase(m))) continue
    const conj = g.map((m) => {
      const [head, ...rest] = m.trim().split(/\s+/)
      return { c: conjugate(head!), rest: rest.join(' ') }
    })
    const tenses = Object.keys(conj[0]!.c.forms) as (keyof Conjugation['forms'])[]
    for (const t of tenses) {
      for (let p = 0; p < 6; p++) {
        const row = conj.map(({ c, rest }) => {
          const f = c.forms[t]?.[p]
          return f ? (rest ? `${f} ${rest}` : f) : undefined
        })
        if (row.every(Boolean)) groups.push(row as string[])
      }
    }
    for (const part of ['participle', 'gerund'] as const) {
      groups.push(conj.map(({ c, rest }) => (rest ? `${c[part]} ${rest}` : c[part])))
    }
  }
  return groups
}
function isVerbPhrase(m: string): boolean {
  const head = m.trim().split(/\s+/)[0] ?? ''
  if (!/(ar|er|ir|arse|erse|irse)$/.test(head) || head.length < 4) return false
  const entry = [...vocab.values()].find((v) => v.lemma === m.trim() || v.lemma === head)
  return entry ? entry.pos === 'verb' || entry.pos === 'phrase' : /(ar|er|ir)$/.test(head)
}
export const englishSynonymGroups: string[][] = synonymsFile.english

export interface UnitRef extends UnitMeta {
  level: LevelId
  index: number
}
export const units: Map<string, UnitRef> = new Map()
for (const lvl of levels) {
  lvl.units.forEach((u, i) => units.set(u.id, { ...u, level: lvl.id, index: i }))
}

const grammarFiles = import.meta.glob('../../content/es/grammar/*.yaml', { eager: true, import: 'default' }) as Record<string, unknown>
export const grammar: Map<string, GrammarNote> = new Map()
for (const data of Object.values(grammarFiles)) {
  for (const note of GrammarFileSchema.parse(data)) grammar.set(note.id, note)
}

const vocabFiles = import.meta.glob('../../content/es/vocab/*.yaml', { eager: true, import: 'default' }) as Record<string, unknown>
export const vocab: Map<string, VocabEntry> = new Map()
for (const data of Object.values(vocabFiles)) {
  for (const e of VocabFileSchema.parse(data)) vocab.set(e.id, e)
}
export function vocabUpTo(level: LevelId): VocabEntry[] {
  const max = LEVEL_ORDER.indexOf(level)
  return [...vocab.values()].filter((v) => LEVEL_ORDER.indexOf(v.level) <= max)
}

const readerFiles = import.meta.glob('../../content/es/readers/*/*.yaml', { eager: true, import: 'default' }) as Record<string, unknown>
export const readers: Reader[] = Object.values(readerFiles).map((d) => ReaderSchema.parse(d))
export function readersFor(level: LevelId): Reader[] {
  return readers.filter((r) => r.level === level)
}

const unitFiles = import.meta.glob('../../content/es/units/*/*.yaml', { import: 'default' }) as Record<string, () => Promise<unknown>>
const unitCache = new Map<string, Promise<Unit>>()
function unitPath(unitId: string): string | undefined {
  const [level, u] = unitId.split('.')
  return Object.keys(unitFiles).find((p) => p.endsWith(`/units/${level}/${u}.yaml`))
}
export function unitIsAuthored(unitId: string): boolean {
  return unitPath(unitId) !== undefined
}
export function loadUnit(unitId: string): Promise<Unit> {
  let p = unitCache.get(unitId)
  if (!p) {
    const path = unitPath(unitId)
    if (!path) return Promise.reject(new Error(`Unit ${unitId} is not authored yet`))
    p = unitFiles[path]!().then((raw) => UnitSchema.parse(raw))
    unitCache.set(unitId, p)
  }
  return p
}
export async function loadLesson(lessonId: string): Promise<{ unit: Unit; lesson: Lesson }> {
  const unitId = lessonId.split('.').slice(0, 2).join('.')
  const unit = await loadUnit(unitId)
  const lesson = unit.lessons.find((l) => l.id === lessonId)
  if (!lesson) throw new Error(`Lesson ${lessonId} not found`)
  return { unit, lesson }
}

const examFiles = import.meta.glob('../../content/es/exams/*.yaml', { import: 'default' }) as Record<string, () => Promise<unknown>>
export function examExists(level: LevelId): boolean {
  return Object.keys(examFiles).some((p) => p.endsWith(`/exams/${level}.yaml`))
}
export async function loadExam(level: LevelId): Promise<Exam | undefined> {
  const path = Object.keys(examFiles).find((p) => p.endsWith(`/exams/${level}.yaml`))
  if (!path) return undefined
  return ExamSchema.parse(await examFiles[path]!())
}

/** Level of a unit or lesson id. */
export function levelOf(id: string): LevelId {
  return id.split('.')[0] as LevelId
}
export function nextLevel(level: LevelId): LevelId | undefined {
  return LEVEL_ORDER[LEVEL_ORDER.indexOf(level) + 1]
}

export const LEVEL_ORDER_LIST = LEVEL_ORDER
