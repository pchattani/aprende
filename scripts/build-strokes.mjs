// Bundles stroke-order data for the characters each course teaches to write:
//   content/<lang>/units/**  `write: [火, 水]`  →  src/lang/<lang>/data/strokes.json (+ the data's license)
// Only those characters are kept, so the bundle stays small. Runs before every build and content check:
//   npm run strokes
import { existsSync, readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { ROOT, strokesPath, collectWriteChars, datasetEntry, datasetLicense } from './strokes-lib.mjs'

const writeIfChanged = (p, text) => {
  if (existsSync(p) && readFileSync(p, 'utf8') === text) return false
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, text)
  return true
}

for (const lang of readdirSync(join(ROOT, 'content'))) {
  if (!existsSync(join(ROOT, 'content', lang, 'pack.yaml')) || !existsSync(join(ROOT, 'src', 'lang', lang))) continue
  const out = strokesPath(lang)
  const license = join(dirname(out), 'strokes.LICENSE.txt')
  const chars = [...collectWriteChars(join(ROOT, 'content', lang)).keys()].sort()
  if (!chars.length) {
    // nothing to write in this course: no bundle
    for (const p of [out, license]) if (existsSync(p)) rmSync(p)
    continue
  }
  const data = {}
  const missing = []
  for (const c of chars) {
    const entry = datasetEntry(c)
    if (entry) data[c] = entry
    else missing.push(c)
  }
  const json = JSON.stringify(data)
  const changed = writeIfChanged(out, json + '\n')
  writeIfChanged(license, `Stroke data in strokes.json: hanzi-writer-data (https://github.com/chanind/hanzi-writer-data),\nderived from Make Me a Hanzi and the Arphic PL KaitiM / UKai fonts. License:\n\n${datasetLicense()}`)
  console.log(`strokes ${lang}: ${Object.keys(data).length} characters, ${(json.length / 1024).toFixed(1)} KB${changed ? ' (updated)' : ''}${missing.length ? `; no data for ${missing.join(' ')}` : ''}`)
}
