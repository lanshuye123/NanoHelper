import { describe, expect, it } from 'vitest'
import { applyPipeline, invertPipeline } from '@/core/pipeline/apply'
import { createStep } from '@/core/pipeline/steps'
import { computeJadeMapping, applyMapping, invertMapping } from '@/core/pipeline/jade'
import { validateForJade, hasErrors } from '@/core/pipeline/validate'
import { buildXy, parseTabular } from '@/core/io/xy'
import { makePattern } from '@/core/pipeline/types'

const x = new Float64Array(1000)
const y = new Float64Array(1000)
for (let i = 0; i < 1000; i++) {
  x[i] = 100 + i * 1.9
  y[i] = 50 + 10 * Math.sin(i / 20) + (i % 7) * 0.1
}

const pattern = makePattern(x, y, {
  xLabel: 'Raman shift',
  xUnit: 'cm⁻¹',
  yLabel: 'Intensity',
  yUnit: 'a.u.',
})

describe('Jade mapping', () => {
  it('maps non-diffraction data into the course-specified box', () => {
    const mapping = computeJadeMapping(pattern, { mode: 'nonDiffraction' })
    const mapped = applyMapping(pattern, mapping)
    expect(mapped.x[0]).toBeCloseTo(0, 6)
    expect(mapped.x[mapped.x.length - 1]).toBeCloseTo(100, 6)
    expect(Math.min(...mapped.y)).toBeGreaterThan(0)
    expect(Math.max(...mapped.y)).toBeCloseTo(10000, 3)
  })

  it('round-trips X and Y within floating point tolerance', () => {
    const mapping = computeJadeMapping(pattern, { mode: 'nonDiffraction' })
    const mapped = applyMapping(pattern, mapping)
    const back = invertMapping(mapped, mapping)
    for (let i = 0; i < pattern.x.length; i += 137) {
      expect(back.x[i]).toBeCloseTo(pattern.x[i], 9)
      expect(back.y[i]).toBeCloseTo(pattern.y[i], 7)
    }
  })

  it('keeps 2θ unchanged in diffraction mode', () => {
    const mapping = computeJadeMapping(pattern, { mode: 'diffraction' })
    expect(mapping.xScale).toBe(1)
    expect(mapping.xOffset).toBe(0)
  })

  it('warns when 2θ is outside the Jade range', () => {
    const wide = makePattern([0, 160], [1, 2], pattern.meta)
    const mapping = computeJadeMapping(wide, { mode: 'diffraction' })
    expect(mapping.warnings.length).toBeGreaterThan(0)
  })
})

describe('pipeline', () => {
  it('applies crop and jade mapping in order', () => {
    const steps = [
      createStep('crop', { xMin: 200, xMax: 1800 }),
      createStep('jade-map', { mode: 'nonDiffraction' }),
    ]
    const result = applyPipeline(pattern, steps)
    expect(result.issues).toHaveLength(0)
    expect(result.pattern.x.length).toBeGreaterThan(800)
    expect(result.pattern.x[0]).toBeCloseTo(0, 6)
    const resolved = result.resolved[steps[1].id]
    expect(resolved.mapping).toBeTruthy()
  })

  it('inverts only reversible steps', () => {
    const steps = [createStep('smooth', { window: 5, order: 2 }), createStep('affine', { xScale: 2, xOffset: 1, yScale: 3, yOffset: 4 })]
    const result = applyPipeline(pattern, steps)
    const inverse = invertPipeline(result.pattern, steps, result.resolved)
    expect(inverse.skipped).toContain('平滑')
    expect(inverse.pattern.x[0]).toBeCloseTo(pattern.x[0], 8)
    expect(inverse.pattern.y[10]).toBeCloseTo(result.pattern.y[10] / 3 - 4 / 3, 6)
  })

  it('flags negative and out-of-range values', () => {
    const bad = makePattern([-1, 10, 150], [1, -2, 3], pattern.meta)
    const issues = validateForJade(bad)
    expect(hasErrors(issues)).toBe(true)
    expect(issues.some((i) => i.code === 'non-positive-y')).toBe(true)
    expect(issues.some((i) => i.code === 'x-range')).toBe(true)
  })

  it('writes a CRLF two-column XY', () => {
    const text = buildXy(makePattern([10, 11, 12], [1, 2, 3], pattern.meta), { headerLines: ['test'], decimalsX: 3, decimalsY: 2 })
    const lines = text.split('\r\n').filter(Boolean)
    expect(lines[0]).toBe('# test')
    expect(lines[1].split(' ')).toHaveLength(2)
    expect(text.endsWith('\r\n')).toBe(true)
  })
})

describe('tabular parser', () => {
  it('parses a comma-separated file with a header', () => {
    const text = '# comment\n2theta,intensity\n10.0,100\n10.1,120\n'
    const table = parseTabular(text)
    expect(table.columns[0]).toEqual([10, 10.1])
    expect(table.columns[1]).toEqual([100, 120])
    expect(table.headers.length).toBeGreaterThan(0)
  })

  it('parses a whitespace XY file', () => {
    const table = parseTabular('10 100\n10.1 120\n')
    expect(table.columns[0]).toEqual([10, 10.1])
  })

  it('parses semicolon files with decimal commas', () => {
    const table = parseTabular('10,5;100,25\n10,6;120,5\n')
    expect(table.columns[0][0]).toBeCloseTo(10.5, 6)
    expect(table.columns[1][0]).toBeCloseTo(100.25, 6)
  })
})

describe('background and smoothing', () => {
  it('SNIP background stays below the peaks', async () => {
    const { snipBackground } = await import('@/core/num/background')
    const n = 400
    const xs = new Float64Array(n)
    const ys = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      xs[i] = i
      ys[i] = 100 + 500 * Math.exp(-((i - 200) ** 2) / 200)
    }
    const bg = snipBackground(ys, 50)
    expect(bg[200]).toBeLessThan(ys[200])
    expect(bg[0]).toBeLessThanOrEqual(ys[0] + 1e-6)
  })

  it('Savitzky-Golay preserves a constant', async () => {
    const { savitzkyGolay } = await import('@/core/num/smooth')
    const out = savitzkyGolay(new Float64Array(50).fill(7), 9, 2)
    for (const v of out) expect(v).toBeCloseTo(7, 10)
  })

  it('strips a Kα2 satellite', async () => {
    const { stripKalpha2, ensureUniform } = await import('@/core/num/background')
    const { x, y } = ensureUniform(
      Float64Array.from({ length: 400 }, (_, i) => 27 + i * 0.01),
      Float64Array.from({ length: 400 }, (_, i) => {
        const a = 1000 * Math.exp(-(((i * 0.01 + 27 - 28.44) / 0.08) ** 2))
        const b = 500 * Math.exp(-(((i * 0.01 + 27 - 28.51) / 0.08) ** 2))
        return 10 + a + b
      }),
    )
    const stripped = stripKalpha2(x, y, 1.54056, 1.54439, 0.5)
    const i1 = Math.round((28.44 - 27) / 0.01)
    const i2 = Math.round((28.51 - 27) / 0.01)
    expect(stripped[i2]).toBeLessThan(y[i2])
    expect(stripped[i1]).toBeGreaterThan(stripped[i2])
  })
})

describe('XY export', () => {
  it('rejects data with non-positive Y', () => {
    const bad = makePattern([10, 11], [1, 0], pattern.meta)
    expect(() => buildXy(bad)).toThrow()
  })

  it('produces exactly one line per point', () => {
    const mapped = applyMapping(pattern, computeJadeMapping(pattern, { mode: 'nonDiffraction' }))
    const text = buildXy(mapped, { decimalsX: 4, decimalsY: 2 })
    expect(text.trimEnd().split('\r\n')).toHaveLength(pattern.x.length)
  })
})

describe('scalar mapping', () => {
  it('inverts a peak position and area', () => {
    const mapping = computeJadeMapping(pattern, { mode: 'nonDiffraction' })
    const mapped = applyMapping(pattern, mapping)
    expect((mapped.x[10] - mapping.xOffset) / mapping.xScale).toBeCloseTo(pattern.x[10], 8)
  })
})

describe('numeric expressions', () => {
  it('evaluates arithmetic and functions', async () => {
    const { evaluateExpression } = await import('@/utils/expression')
    expect(evaluateExpression('1/3')).toBeCloseTo(1 / 3, 12)
    expect(evaluateExpression('sqrt(2)')).toBeCloseTo(Math.SQRT2, 12)
    expect(evaluateExpression('1e3')).toBe(1000)
    expect(evaluateExpression('2*pi')).toBeCloseTo(2 * Math.PI, 12)
    expect(evaluateExpression('sin(pi/2)')).toBeCloseTo(1, 12)
  })

  it('rejects arbitrary code', async () => {
    const { evaluateExpression } = await import('@/utils/expression')
    expect(evaluateExpression('alert(1)')).toBeNull()
    expect(evaluateExpression('1/0')).toBeNull()
    expect(evaluateExpression('window.location')).toBeNull()
  })
})

describe('number formatting', () => {
  it('keeps integer trailing zeros', async () => {
    const { formatInputNumber } = await import('@/utils/expression')
    expect(formatInputNumber(100, 0)).toBe('100')
    expect(formatInputNumber(10, 0)).toBe('10')
    expect(formatInputNumber(10.5, 6)).toBe('10.5')
    expect(formatInputNumber(0, 0)).toBe('0')
  })
})

describe('Jade preset ranges', () => {
  it('uses the fixed course ranges for non-diffraction and safe modes', () => {
    const nonDiff = computeJadeMapping(pattern, { mode: 'nonDiffraction' })
    expect(nonDiff.outputX[0]).toBeCloseTo(0, 6)
    expect(nonDiff.outputX[1]).toBeCloseTo(100, 6)
    const safe = computeJadeMapping(pattern, { mode: 'safe' })
    expect(safe.outputX[0]).toBeCloseTo(1, 6)
    expect(safe.outputX[1]).toBeCloseTo(139, 6)
    expect(safe.outputY[0]).toBeCloseTo(0.5, 6)
    expect(safe.outputY[1]).toBeCloseTo(10000, 3)
  })
})
