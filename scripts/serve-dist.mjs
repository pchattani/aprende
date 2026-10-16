// A tiny static server for the built site, the way GitHub Pages serves it: dist/ at /aprende/.
//   node scripts/serve-dist.mjs [--port 4173]      (npm run serve:dist)
// Just files: a directory serves its index.html, anything missing is a 404 (no SPA fallback;
// the hub and the courses use hash routes). `/` redirects to /aprende/ for convenience.
import { createServer } from 'node:http'
import { createReadStream, statSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'

const BASE = '/aprende/'
const ROOT = resolve(process.env.DIST_DIR ?? 'dist')
const portArg = process.argv.indexOf('--port')
const PORT = Number(portArg > 0 ? process.argv[portArg + 1] : process.env.PORT ?? 4173)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.wasm': 'application/wasm',
}

const isFile = (p) => {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}
const isDir = (p) => {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  let path
  try {
    path = decodeURIComponent(url.pathname)
  } catch {
    res.writeHead(400).end('Bad request')
    return
  }
  if (path === '/' || path === BASE.slice(0, -1)) {
    res.writeHead(301, { Location: BASE + url.search }).end()
    return
  }
  if (!path.startsWith(BASE)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found')
    return
  }
  let file = normalize(join(ROOT, path.slice(BASE.length)))
  if (file !== ROOT && !file.startsWith(ROOT + sep)) {
    res.writeHead(403).end('Forbidden')
    return
  }
  if (isDir(file)) {
    // Like GitHub Pages: /aprende/spanish → /aprende/spanish/
    if (!path.endsWith('/')) {
      res.writeHead(301, { Location: `${path}/${url.search}` }).end()
      return
    }
    file = join(file, 'index.html')
  }
  if (!isFile(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found')
    return
  }
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    // Service workers and HTML must always be revalidated; hashed assets could be cached, but tests want fresh files.
    'Cache-Control': 'no-cache',
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(file).pipe(res)
})

server.listen(PORT, () => console.log(`Serving ${ROOT} at http://localhost:${PORT}${BASE}`))
