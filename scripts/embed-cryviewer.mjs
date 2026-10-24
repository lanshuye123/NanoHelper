#!/usr/bin/env node
/**
 * Copy the CrystalViewer production build into public/crystal-viewer/ and
 * rewrite absolute asset URLs so the app works under any Vite base path and
 * inside an iframe.
 *
 * Usage:
 *   node scripts/embed-cryviewer.mjs [path-to-CryViewer/dist]
 *   CRYVIEWER_DIST=/path/to/CryViewer/dist npm run embed:cryviewer
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = resolve(process.argv[2] || process.env.CRYVIEWER_DIST || '../CryViewer/dist')
const target = resolve('public/crystal-viewer')

if (!existsSync(source)) {
  console.error(`CrystalViewer dist not found: ${source}`)
  console.error('Build it first: (cd /path/to/CryViewer && npm run build)')
  process.exit(1)
}

rmSync(target, { recursive: true, force: true })
cpSync(source, target, { recursive: true })

const indexPath = resolve(target, 'index.html')
let html = readFileSync(indexPath, 'utf8')
html = html
  .replace(/href="\/favicon\.ico"/g, 'href="./favicon.ico"')
  .replace(/src="\/assets\//g, 'src="./assets/')
  .replace(/href="\/assets\//g, 'href="./assets/')
writeFileSync(indexPath, html)

// The CrystalViewer CNAME points at crystal.jamaccao.cn, not this site.
rmSync(resolve(target, 'CNAME'), { force: true })

console.log(`Embedded CrystalViewer from ${source}`)
console.log(`  → ${target}`)
console.log('  index.html asset paths rewritten to ./assets/')
