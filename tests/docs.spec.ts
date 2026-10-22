import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DOCS } from '@/docs/manifest'

describe('documentation manifest', () => {
  it('has a unique route for every entry', () => {
    const keys = DOCS.map((d) => `${d.section}/${d.slug}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('has an existing markdown file for every entry', () => {
    for (const doc of DOCS) {
      const path = `docs/${doc.file}`
      expect(existsSync(path), `missing ${path}`).toBe(true)
      const content = readFileSync(path, 'utf8')
      expect(content.startsWith('# '), `${doc.file} should start with an h1`).toBe(true)
      expect(content.length).toBeGreaterThan(400)
      expect(content).not.toContain('文档内容正在完善')
    }
  })

  it('resolves relative markdown links', () => {
    for (const doc of DOCS) {
      const content = readFileSync(`docs/${doc.file}`, 'utf8')
      const links = [...content.matchAll(/\]\((\.{0,2}\/?[^)#\s]+\.md)\)/g)].map((m) => m[1])
      for (const link of links) {
        const base = doc.file.includes('/') ? doc.file.slice(0, doc.file.lastIndexOf('/') + 1) : ''
        const parts = (base + link).split('/')
        const resolved: string[] = []
        for (const part of parts) {
          if (part === '..') resolved.pop()
          else if (part !== '.') resolved.push(part)
        }
        expect(existsSync(`docs/${resolved.join('/')}`), `${doc.file} -> ${link}`).toBe(true)
      }
    }
  })
})
