/**
 * Builds the Cantonese pronunciation tables bundled with the app from the
 * rime-cantonese dictionaries (CanCLID, CC BY 4.0):
 *
 *   src/lang/yue/data/chars.json  character → Jyutping readings, most common first
 *   src/lang/yue/data/words.json  multi-character words that occur in the course → Jyutping
 *
 * Only characters seen in rime's word list or in the course content are kept, and
 * only words that actually occur in content/yue, so the bundle stays small.
 *
 *   npm run yue:data            (downloads the dictionaries to node_modules/.cache/rime)
 *   RIME_DIR=path npm run yue:data
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { listYaml, ROOT } from './content-lib'

const FILES = ['jyut6ping3.chars.dict.yaml', 'jyut6ping3.words.dict.yaml']
const dir = process.env.RIME_DIR ?? join(ROOT, 'node_modules', '.cache', 'rime')
if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
for (const f of FILES) {
  const p = join(dir, f)
  if (!existsSync(p)) execFileSync('curl', ['-sSfL', '-o', p, `https://raw.githubusercontent.com/rime/rime-cantonese/main/${f}`], { stdio: 'inherit' })
}
const body = (f: string) => {
  const t = readFileSync(join(dir, f), 'utf8')
  return t.slice(t.indexOf('\n...\n') + 5).split('\n')
}
const HAN = /\p{Script=Han}/u

// ---- every Han character used anywhere in the course (all YAML under content/yue)
const contentText = listYaml(join(ROOT, 'content', 'yue')).map((p) => readFileSync(p, 'utf8')).join('\n')
const contentChars = new Set([...contentText].filter((c) => HAN.test(c)))

// ---- words: rime word list
const words = new Map<string, string>()
const wordChars = new Set<string>()
for (const line of body('jyut6ping3.words.dict.yaml')) {
  const [w, jp] = line.split('\t')
  if (!w || !jp || w.length < 2 || !/^[a-z1-6 ]+$/.test(jp)) continue
  if (!words.has(w)) words.set(w, jp)
  for (const c of w) wordChars.add(c)
}

// ---- characters: readings ordered by weight (no weight = the main reading)
const readings = new Map<string, { jp: string; w: number }[]>()
for (const line of body('jyut6ping3.chars.dict.yaml')) {
  const [c, jp, wt] = line.split('\t')
  if (!c || !jp || [...c].length !== 1) continue
  const w = wt === undefined ? 100 : Number(wt.replace('%', '')) || 0
  const list = readings.get(c) ?? []
  if (!list.some((r) => r.jp === jp)) list.push({ jp, w })
  readings.set(c, list)
}
const chars: Record<string, string[]> = {}
for (const [c, list] of [...readings.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
  if (!wordChars.has(c) && !contentChars.has(c)) continue
  chars[c] = list.sort((a, b) => b.w - a.w).map((r) => r.jp)
}

// ---- words that occur in the course text
const usedWords: Record<string, string> = {}
for (const [w, jp] of words) if (contentText.includes(w)) usedWords[w] = jp

const out = join(ROOT, 'src', 'lang', 'yue', 'data')
writeFileSync(join(out, 'chars.json'), JSON.stringify(chars))
writeFileSync(join(out, 'words.json'), JSON.stringify(usedWords))
const missing = [...contentChars].filter((c) => !chars[c])
console.log(`chars: ${Object.keys(chars).length} · words used by the course: ${Object.keys(usedWords).length} · content characters without a reading: ${missing.length}${missing.length ? ` (${missing.slice(0, 30).join('')})` : ''}`)
