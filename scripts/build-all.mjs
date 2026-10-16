// Builds the whole site into dist/: the Pawsport hub at the root and every live course in dist/<slug>/.
//   node scripts/build-all.mjs            (npm run build:all)
// Layout (served at https://pchattani.github.io/aprende/):
//   dist/index.html, dist/assets/, dist/sw.js   the hub            → /aprende/
//   dist/<slug>/                                each course         → /aprende/<slug>/
import { readFileSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'

const courses = JSON.parse(readFileSync('courses.json', 'utf8')).filter((c) => c.live)
rmSync('dist', { recursive: true, force: true })
const run = (label, cmd, env = {}) => {
  console.log(`\n=== ${label} ===`)
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } })
}
// The hub never empties dist/ and each course only empties its own folder, so the order does not matter.
run('Pawsport hub', 'npx vite build -c vite.hub.config.ts')
for (const c of courses) run(`${c.name} (${c.id}) → dist/${c.slug}/`, 'npx vite build', { VITE_LANG: c.id })
