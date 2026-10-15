/** Shared helpers for content scripts (Node side: YAML via js-yaml, no Vite). */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import { load } from 'js-yaml'

export const ROOT = new URL('..', import.meta.url).pathname
/** Course being checked: VITE_LANG, or `--lang=yue`, default Spanish. */
export const LANG = process.argv.find((a) => a.startsWith('--lang='))?.slice(7) ?? process.env.VITE_LANG ?? 'es'
export const CONTENT = join(ROOT, 'content', LANG)

export function readYaml(path: string): unknown {
  return load(readFileSync(path, 'utf8'), { filename: path })
}

export function listYaml(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) out.push(...listYaml(p))
    else if (/\.ya?ml$/.test(f)) out.push(p)
  }
  return out.sort()
}

export function unitIdFromPath(p: string): string {
  const level = basename(join(p, '..'))
  return `${level}.${basename(p).replace(/\.ya?ml$/, '')}`
}
