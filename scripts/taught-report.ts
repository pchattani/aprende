/**
 * Taught-words gate report (src/engine/taught.ts): per lesson in syllabus order, how many sentences,
 * exchanges and mini-texts a learner who knows only the words taught so far can be shown (pass), how
 * many exchanges are asked in English instead (english), how many are left out (skip), and the untaught
 * words that block them most often. For rewriting lessons so that beginners understand them.
 *
 *   npm run taught:report                         one line per lesson (Cantonese unless VITE_LANG / --lang say otherwise)
 *   npm run taught:report -- --lesson a1.u13.l1   every item of a lesson (or of a unit: --lesson a1.u13) with its verdict
 *   npm run taught:report -- --low                only lessons below TAUGHT_MIN_ITEMS
 */
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { SyllabusSchema, VocabFileSchema, UnitSchema, type Unit, type VocabEntry } from '../src/engine/schema'
import type { TokenizeModule, LanguagePackFull } from '../src/lang/contract'
import { ROOT, readYaml, listYaml } from './content-lib'
import { taughtIndex, makeTaughtGate, gateLesson, TAUGHT_MIN, TAUGHT_MIN_ITEMS, type GateVerdict } from '../src/engine/taught'

const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : process.argv.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1)
}
const LANG = arg('--lang') ?? process.env.VITE_LANG ?? 'yue'
const CONTENT = join(ROOT, 'content', LANG)
const only = arg('--lesson')
const lowOnly = process.argv.includes('--low')

const { tokenize } = (await import(`../src/lang/${LANG}/tokenize.ts`)) as TokenizeModule
const { languagePack } = (await import(`../src/lang/${LANG}/index.ts`)) as { languagePack: LanguagePackFull }

const syllabus = SyllabusSchema.parse(readYaml(join(CONTENT, 'syllabus.yaml')))
const vocab = new Map<string, VocabEntry>()
for (const p of listYaml(join(CONTENT, 'vocab'))) for (const e of VocabFileSchema.parse(readYaml(p))) vocab.set(e.id, e)
languagePack.useVocabulary?.(vocab.values())
const units: Unit[] = listYaml(join(CONTENT, 'units')).map((p) => UnitSchema.parse(readYaml(p)))
const known = existsSync(join(CONTENT, 'known.yaml')) ? (readYaml(join(CONTENT, 'known.yaml')) as { names?: string[] }) : {}
const index = taughtIndex(syllabus.levels, units)
const lessons = new Map(units.flatMap((u) => u.lessons.map((l) => [l.id, l] as const)))

const pct = (r: number) => `${Math.round(r * 100)}%`
const fmtBlocking = (list: [string, number][], n = 8) => list.slice(0, n).map(([w, k]) => `${w}×${k}`).join(' ')
const VERDICT: Record<GateVerdict, string> = { pass: 'PASS', english: 'ENGLISH', skip: 'SKIP' }

console.log(`course: ${LANG} · taught-words gate: an item passes when ≥${pct(TAUGHT_MIN)} of its words are taught (punctuation, digits, Latin script, names and final particles not counted)`)
const totals = { lessons: 0, low: 0, pass: 0, english: 0, skip: 0 }
const allBlocking = new Map<string, number>()
let prevTaught = 0
for (const id of index.order) {
  const lesson = lessons.get(id)!
  const ids = index.at(id)
  const fresh = ids.size - prevTaught
  prevTaught = ids.size
  if (only && !(id === only || id.startsWith(`${only}.`))) continue
  const gate = makeTaughtGate(ids, vocab, tokenize, known.names ?? [])
  const r = gateLesson(lesson, gate)
  const low = r.pass + r.english < TAUGHT_MIN_ITEMS
  totals.lessons++
  totals.pass += r.pass
  totals.english += r.english
  totals.skip += r.skip
  if (low) totals.low++
  for (const [w, n] of r.blocking) allBlocking.set(w, (allBlocking.get(w) ?? 0) + n)
  if (lowOnly && !low) continue
  console.log(`${id.padEnd(10)} taught=${String(ids.size).padEnd(4)} new=${String(fresh).padEnd(3)} pass=${String(r.pass).padEnd(3)} english=${String(r.english).padEnd(3)} skip=${String(r.skip).padEnd(3)} items=${String(r.items.length).padEnd(3)}${low ? ' LOW' : '    '}  blocking: ${fmtBlocking(r.blocking) || '-'}`)
  if (only) {
    console.log(`  new words: ${lesson.vocab.map((v) => vocab.get(v)?.lemma ?? v).join(' ') || '-'}`)
    for (const it of r.items) {
      console.log(`  ${VERDICT[it.verdict].padEnd(7)} ${it.kind.padEnd(8)} ${pct(it.ratio).padStart(4)}  ${it.es}${it.untaught.length ? `   untaught: ${it.untaught.join(' ')}` : ''}`)
    }
  }
}
const items = totals.pass + totals.english + totals.skip
console.log(
  `\nsummary: ${totals.lessons} lessons · ${items} items · pass ${totals.pass} (${pct(totals.pass / (items || 1))}) · english ${totals.english} · skip ${totals.skip} (${pct(totals.skip / (items || 1))}) · ${totals.low} lessons LOW (< ${TAUGHT_MIN_ITEMS} items pass or can be asked in English)`,
)
console.log(`top blocking words: ${fmtBlocking([...allBlocking.entries()].sort((a, b) => b[1] - a[1]), 40)}`)
