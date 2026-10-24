import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const files = readdirSync('src/views')
  .filter((name) => name.endsWith('View.vue'))
  .map((name) => `src/views/${name}`)
  .filter((path) => readFileSync(path, 'utf8').includes('<ToolPage'))

describe('tool page state coverage', () => {
  it('every interactive tool page persists its inputs', () => {
    const offenders = files.filter((path) => {
      const source = readFileSync(path, 'utf8')
      if (source.includes(':show-state-actions="false"')) return false
      return !/useToolDraft|useToolRecord/.test(source)
    })
    expect(offenders).toEqual([])
  })

  it('every interactive tool page exposes reset and clear actions', () => {
    const offenders = files.filter((path) => {
      const source = readFileSync(path, 'utf8')
      if (source.includes(':show-state-actions="false"')) return false
      return !source.includes('@reset=') || !source.includes('@clear=')
    })
    expect(offenders).toEqual([])
  })
})
