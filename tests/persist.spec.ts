import { describe, expect, it, beforeEach } from 'vitest'
import {
  formatSavedAt,
  mergeDefaults,
  readStored,
  removeStored,
  toolStorageKey,
  writeStored,
} from '@/utils/persist'

describe('persistence helpers', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('merges defaults without accepting mistyped fields', () => {
    const defaults = {
      wavelength: 1.54056,
      anode: 'Cu',
      useKa2: true,
      cell: { a: 5.431, b: 5.431, c: 5.431 },
      peaks: [1, 2, 3],
    }
    const merged = mergeDefaults(defaults, {
      wavelength: 'oops',
      anode: 'Mo',
      cell: { a: 4.0 },
      peaks: [4, 5],
    })
    expect(merged.wavelength).toBe(1.54056)
    expect(merged.anode).toBe('Mo')
    expect(merged.cell.a).toBe(4)
    expect(merged.cell.b).toBe(5.431)
    expect(merged.peaks).toEqual([4, 5])
  })

  it('round-trips a versioned envelope', () => {
    const key = toolStorageKey('test-tool')
    expect(writeStored(key, 1, { a: 1, b: 'x' })).toBe(true)
    const stored = readStored<{ a: number; b: string }>(key, 1)
    expect(stored?.data).toEqual({ a: 1, b: 'x' })
    expect(stored?.savedAt).toBeTypeOf('number')
    expect(readStored(key, 2)).toBeNull()
    removeStored(key)
    expect(readStored(key, 1)).toBeNull()
  })

  it('ignores corrupted JSON instead of throwing', () => {
    const key = toolStorageKey('broken-tool')
    window.localStorage.setItem(key, '{not-json')
    expect(readStored(key, 1)).toBeNull()
  })

  it('formats a save time for the header', () => {
    expect(formatSavedAt(null)).toBe('')
    expect(formatSavedAt(Date.now())).toMatch(/\d{2}:\d{2}/)
  })
})
