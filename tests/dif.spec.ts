import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseDif, blockX, exportDif } from '@/core/io/dif'

const fixture = readFileSync('tests/fixtures/DEMO06.dif', 'utf8')

describe('Jade DIF parser', () => {
  it('parses the DEMO06 header and all six blocks', () => {
    const dif = parseDif(fixture)
    expect(dif.date).toBe('10/20/26')
    expect(dif.time).toBe('10:16')
    expect(dif.mode).toBe('FIT')
    expect(dif.title).toContain('Red Paint Pigment')
    expect(dif.blocks).toHaveLength(6)
    expect(dif.blocks.map((b) => b.name)).toEqual([
      'Raw Pattern',
      'Background',
      'Fitted Profile 1',
      'Fitted Profile 2',
      'Fitted Profile 3',
      'Overall Profile',
    ])
    expect(dif.blocks.map((b) => b.role)).toEqual([
      'raw',
      'background',
      'fitted',
      'fitted',
      'fitted',
      'overall',
    ])
  })

  it('reads the declared number of points and correct ranges', () => {
    const dif = parseDif(fixture)
    expect(dif.blocks[0].points).toBe(2901)
    expect(dif.blocks[0].valuesRead).toBe(2901)
    expect(dif.blocks[1].points).toBe(2901)
    expect(dif.blocks[2].points).toBe(298)
    expect(dif.blocks[3].points).toBe(303)
    expect(dif.blocks[4].points).toBe(112)
    expect(dif.blocks[2].start).toBeCloseTo(23.18, 6)
    expect(dif.blocks[2].end).toBeCloseTo(29.12, 6)
  })

  it('generates the X axis from start/step', () => {
    const dif = parseDif(fixture)
    const x = blockX(dif.blocks[0])
    expect(x[0]).toBeCloseTo(20, 8)
    expect(x[1]).toBeCloseTo(20.02, 8)
    expect(x[x.length - 1]).toBeCloseTo(78, 6)
  })

  it('detects radiation metadata', () => {
    const dif = parseDif(fixture)
    expect(dif.blocks[0].anode).toBe('Cu')
    expect(dif.blocks[0].wavelength).toBeCloseTo(1.54056, 6)
  })

  it('exports a wide Origin table with diff and fitted profiles', () => {
    const dif = parseDif(fixture)
    const result = exportDif(dif, { format: 'wide', includeHeader: false, delimiter: ',' })
    const lines = result.content.trim().split('\n')
    expect(lines[0].split(',')).toEqual(['X', 'Raw', 'Background', 'Overall', 'Diff', 'Fit1', 'Fit2', 'Fit3'])
    expect(lines).toHaveLength(2902)
    expect(result.gridSize).toBe(2901)
    expect(result.rFactor).toBeGreaterThan(0)
  })

  it('produces a difference curve with the right sign', () => {
    const dif = parseDif(fixture)
    const result = exportDif(dif, { format: 'wide', includeHeader: false })
    const raw = dif.blocks[0].y
    const overall = dif.blocks[5].y
    const lines = result.content.trim().split('\n')
    const cells = lines[100].split(/\s+/)
    expect(Number(cells[4])).toBeCloseTo(raw[100] - overall[100], 3)
  })

  it('exports a stacked table without NaN', () => {
    const dif = parseDif(fixture)
    const result = exportDif(dif, { format: 'stacked', includeHeader: false })
    expect(result.content).not.toContain('NaN')
    expect(result.content).toContain('# Background')
  })
})

describe('DIF variants', () => {
  it('parses a file whose first line is already a parameter line', () => {
    const values = Array.from({ length: 101 }, (_, i) => String(100 + i)).join(' ')
    const text = `20 0.02 4 Cu 1.54056 22 101 (Raw Pattern)\n${values}\n`
    const dif = parseDif(text)
    expect(dif.blocks).toHaveLength(1)
    expect(dif.blocks[0].points).toBe(101)
    expect(dif.blocks[0].valuesRead).toBe(101)
    expect(dif.title).toBeUndefined()
  })

  it('inverts the X/Y mapping on export when a recipe is supplied', () => {
    const dif = parseDif(fixture)
    const inverseMapping = { xScale: 2, xOffset: 10, yScale: 3, yOffset: 5 }
    const result = exportDif(dif, { format: 'single', includeHeader: false, inverseMapping })
    const first = result.content.trim().split('\n')[0].split(/\s+/)
    expect(Number(first[0])).toBeCloseTo((dif.blocks[0].start - 10) / 2, 6)
  })
})
