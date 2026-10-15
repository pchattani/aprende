// Type-check the app against every sister-course language pack that exists (tsconfig.<code>.json).
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
for (const code of ['yue', 'pt', 'it']) {
  if (!existsSync(`src/lang/${code}/index.ts`) || !existsSync(`content/${code}/pack.yaml`)) continue
  console.log(`typecheck ${code}`)
  execSync(`npx tsc -p tsconfig.${code}.json --noEmit`, { stdio: 'inherit' })
}
