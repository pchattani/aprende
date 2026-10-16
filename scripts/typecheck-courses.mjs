// Type-check the app against every sister-course language pack that exists (tsconfig.<code>.json).
// (Spanish, the hub and the configs are checked by `tsc -b`: tsconfig.app.json, tsconfig.hub.json, tsconfig.node.json.)
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const live = new Set(JSON.parse(readFileSync('courses.json', 'utf8')).filter((c) => c.live).map((c) => c.id))
for (const code of ['yue', 'pt', 'it', 'fr']) {
  if (!live.has(code) || !existsSync(`src/lang/${code}/index.ts`)) continue
  console.log(`typecheck ${code}`)
  execSync(`npx tsc -p tsconfig.${code}.json --noEmit`, { stdio: 'inherit' })
}
