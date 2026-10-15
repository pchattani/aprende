// Runs a command for every live course (courses.json), with VITE_LANG set.
//   node scripts/courses.mjs "npm run content:check"
//   node scripts/courses.mjs --sisters "npx playwright test e2e/sister.spec.ts"
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
const args = process.argv.slice(2)
const sistersOnly = args[0] === '--sisters'
const cmd = sistersOnly ? args[1] : args[0]
const courses = JSON.parse(readFileSync('courses.json', 'utf8')).filter((c) => c.live && (!sistersOnly || c.id !== 'es'))
for (const c of courses) {
  console.log(`\n=== ${c.name} (${c.id}) ===`)
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, VITE_LANG: c.id } })
}
