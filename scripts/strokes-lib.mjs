// Stroke-order data for the characters lessons teach to write (`write:` in content/<lang>/units/**).
// The data comes from hanzi-writer-data (Make Me a Hanzi, Arphic Public License) and is bundled per
// course as src/lang/<lang>/data/strokes.json, so the app never fetches it at run time (offline PWA).
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { load } from 'js-yaml'

export const ROOT = new URL('..', import.meta.url).pathname
/** Where the bundled stroke data of a course lives. */
export const strokesPath = (lang, root = ROOT) => join(root, 'src', 'lang', lang, 'data', 'strokes.json')

function listYaml(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) out.push(...listYaml(p))
    else if (/\.ya?ml$/.test(f)) out.push(p)
  }
  return out.sort()
}

/** Every `write` character of a course's units, with the lessons that teach it. */
export function collectWriteChars(contentDir) {
  const chars = new Map()
  for (const p of listYaml(join(contentDir, 'units'))) {
    let unit
    try {
      unit = load(readFileSync(p, 'utf8'))
    } catch {
      continue // a broken file is reported by the schema check
    }
    for (const lesson of unit?.lessons ?? []) {
      for (const c of Array.isArray(lesson?.write) ? lesson.write : []) {
        if (typeof c !== 'string') continue
        chars.set(c, [...(chars.get(c) ?? []), String(lesson.id)])
      }
    }
  }
  return chars
}

const require = createRequire(import.meta.url)
let dataDir
/** Stroke outlines and medians of one character from hanzi-writer-data, or undefined when the dataset lacks it. */
export function datasetEntry(char) {
  dataDir ??= join(require.resolve('hanzi-writer-data/package.json'), '..')
  const p = join(dataDir, `${char}.json`)
  if (!/^\p{Script=Han}$/u.test(char) || !existsSync(p)) return undefined
  const { strokes, medians } = JSON.parse(readFileSync(p, 'utf8'))
  return { strokes, medians }
}

/** The license of the stroke data, kept next to every bundle. */
export function datasetLicense() {
  dataDir ??= join(require.resolve('hanzi-writer-data/package.json'), '..')
  return readFileSync(join(dataDir, 'ARPHICPL.TXT'), 'utf8')
}

/**
 * Problems with the `write` characters of a course: each must be one Han character with stroke data in the bundle.
 * `bundle` is the parsed strokes.json (undefined when the course has none).
 */
export function writeCharIssues(chars, bundle) {
  const issues = []
  for (const [c, lessons] of chars) {
    const where = lessons.join(', ')
    if (!/^\p{Script=Han}$/u.test(c)) issues.push(`${where}: write "${c}" is not a single Han character`)
    else if (!bundle?.[c]?.strokes?.length) issues.push(`${where}: write ${c} has no stroke data (${datasetEntry(c) ? 'run npm run strokes' : 'not in hanzi-writer-data'})`)
  }
  return issues
}
