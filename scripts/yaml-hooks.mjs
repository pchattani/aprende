// Node module hooks: `import x from './file.yaml'` yields the parsed YAML (as Vite does), so
// language packs can be imported by the content scripts outside Vite.
import { readFile } from 'node:fs/promises'
import { load as parseYaml } from 'js-yaml'

export async function load(url, context, nextLoad) {
  if (url.endsWith('.yaml') || url.endsWith('.yml')) {
    const src = await readFile(new URL(url), 'utf8')
    return { format: 'module', shortCircuit: true, source: `export default ${JSON.stringify(parseYaml(src))};` }
  }
  return nextLoad(url, context)
}
