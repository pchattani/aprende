/** Prints content volume per level. */
import { join } from 'node:path'
import { SyllabusSchema, GrammarFileSchema, VocabFileSchema, UnitSchema, Reader, LEVEL_ORDER, type LevelId } from '../src/engine/schema'
import { CONTENT, readYaml, listYaml, unitIdFromPath } from './content-lib'

const syllabus = SyllabusSchema.parse(readYaml(join(CONTENT, 'syllabus.yaml')))
const stats = new Map<LevelId, { units: number; authored: number; lessons: number; sentences: number; dialogues: number; vocab: number; grammar: number; readers: number }>()
for (const l of LEVEL_ORDER) stats.set(l, { units: 0, authored: 0, lessons: 0, sentences: 0, dialogues: 0, vocab: 0, grammar: 0, readers: 0 })
for (const lvl of syllabus.levels) {
  const s = stats.get(lvl.id)!
  s.units = lvl.units.length
  s.authored = lvl.units.filter((u) => u.authored).length
}
for (const p of listYaml(join(CONTENT, 'grammar'))) for (const n of GrammarFileSchema.parse(readYaml(p))) stats.get(n.level)!.grammar++
for (const p of listYaml(join(CONTENT, 'vocab'))) for (const e of VocabFileSchema.parse(readYaml(p))) stats.get(e.level)!.vocab++
for (const p of listYaml(join(CONTENT, 'units'))) {
  const u = UnitSchema.parse(readYaml(p))
  const s = stats.get(unitIdFromPath(p).split('.')[0] as LevelId)!
  s.lessons += u.lessons.length
  s.sentences += u.lessons.reduce((n, l) => n + l.sentences.length, 0)
  s.dialogues += u.dialogues.length
}
for (const p of listYaml(join(CONTENT, 'readers'))) stats.get(Reader.parse(readYaml(p)).level)!.readers++

const rows = [...stats.entries()].map(([level, s]) => ({ level, ...s }))
console.table(rows)
const tot = rows.reduce((a, r) => ({ sentences: a.sentences + r.sentences, vocab: a.vocab + r.vocab, grammar: a.grammar + r.grammar, lessons: a.lessons + r.lessons }), { sentences: 0, vocab: 0, grammar: 0, lessons: 0 })
console.log(`Total: ${tot.lessons} lessons, ${tot.sentences} sentences, ${tot.vocab} lemmas, ${tot.grammar} grammar notes`)
