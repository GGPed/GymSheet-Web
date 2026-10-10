import { readFile, access, readdir } from 'node:fs/promises'
import path from 'node:path'

const base = '/GymSheet-Web/'
const root = path.resolve('dist')
const html = await readFile(path.join(root, 'index.html'), 'utf8')
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.webmanifest'), 'utf8'))
if (manifest.start_url !== base || manifest.scope !== base) throw new Error('Invalid PWA scope/start_url')
for (const url of [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).concat(manifest.icons.map(i => i.src))) {
  if (/^(?:https?:|data:|#)/.test(url)) continue
  if (!url.startsWith(base)) throw new Error(`Asset outside Pages base: ${url}`)
  await access(path.join(root, decodeURIComponent(url.slice(base.length))))
}
await access(path.join(root, 'sw.js'))
const catalog = JSON.parse(await readFile('src/services/exerciseImages.json', 'utf8'))
const images = [...new Set([...Object.values(catalog.images).flat(), ...Object.values(catalog.aliases), catalog.compound])]
for (const image of images) await access(path.join(root, 'exercises', image))
await access(path.join(root, 'exercise-unavailable.svg'))
for (const file of await readdir(root)) if (/\.(xlsx?|gsb|sqlite|db|zip)$/i.test(file)) throw new Error(`Private data in build: ${file}`)
console.log(`Pages build valid: ${images.length} image assets, manifest, icons, service worker and base ${base}`)
