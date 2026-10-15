/**
 * Schema-only validation of a course's content (no language pack needed), for
 * content written before its language engine exists. The full check is
 * `npm run content:check`.
 *
 *   VITE_LANG=pt npx tsx scripts/check-schema.ts
 */
import { join, relative } from 'node:path'
import { existsSync } from 'node:fs'
import type { z } from 'zod'
import {
  PackSchema, SyllabusSchema, GrammarFileSchema, VocabFileSchema, UnitSchema, Reader, PhonologyFileSchema,
  ExamSchema, ErrorsFileSchema, UiSchema, JourneySchema,
} from '../src/engine/schema'
import { CONTENT, ROOT, LANG, readYaml, listYaml } from './content-lib'

let errors = 0
let files = 0
function parse<S extends z.ZodTypeAny>(schema: S, path: string): void {
  if (!existsSync(path)) return
  files++
  const r = schema.safeParse(readYaml(path))
  if (!r.success) {
    errors++
    for (const i of r.error.issues.slice(0, 8)) console.log(`ERROR ${relative(ROOT, path)}: ${i.path.join('.')}: ${i.message}`)
  }
}
parse(PackSchema, join(CONTENT, 'pack.yaml'))
parse(SyllabusSchema, join(CONTENT, 'syllabus.yaml'))
parse(UiSchema, join(CONTENT, 'ui.yaml'))
parse(JourneySchema, join(CONTENT, 'journey.yaml'))
parse(PhonologyFileSchema, join(CONTENT, 'phonology', 'lessons.yaml'))
parse(ErrorsFileSchema, join(CONTENT, 'errors', 'common-errors.yaml'))
for (const p of listYaml(join(CONTENT, 'grammar'))) parse(GrammarFileSchema, p)
for (const p of listYaml(join(CONTENT, 'vocab'))) parse(VocabFileSchema, p)
for (const p of listYaml(join(CONTENT, 'units'))) parse(UnitSchema, p)
for (const p of listYaml(join(CONTENT, 'readers'))) parse(Reader, p)
for (const p of listYaml(join(CONTENT, 'exams'))) parse(ExamSchema, p)
console.log(`course ${LANG}: ${files} files, ${errors} with schema errors`)
process.exit(errors ? 1 : 0)
