import { describe, expect, it } from 'vitest'
import {
  buildHistogram,
  createLineMeasurement,
  detectParticles,
  fitLognormal,
  makeCalibration,
  measurementCsv,
  summarize,
  convertNmTo,
} from '@/core/micro/particles'

describe('particle calibration and measurements', () => {
  it('converts a scale bar to nm/px', () => {
    const calibration = makeCalibration(200, 500, 'nm')
    expect(calibration.nmPerPx).toBeCloseTo(2.5, 12)
    const line = createLineMeasurement('a', 1, 0, 0, 3, 4, calibration.nmPerPx)
    expect(line.lengthPx).toBeCloseTo(5, 12)
    expect(line.sizeNm).toBeCloseTo(12.5, 12)
    expect(convertNmTo(line.sizeNm, 'um')).toBeCloseTo(0.0125, 12)
  })

  it('builds a NanoMeasure-style CSV', () => {
    const calibration = makeCalibration(100, 1, 'um')
    const m = createLineMeasurement('a', 1, 10, 10, 20, 10, calibration.nmPerPx)
    const csv = measurementCsv([m], 'nm')
    expect(csv.split('\r\n')[0]).toContain('size_nm')
    expect(csv.split('\r\n')[1]).toContain('100.000000')
  })
})

describe('particle statistics', () => {
  it('computes descriptive statistics', () => {
    const s = summarize([1, 2, 3, 4])
    expect(s.n).toBe(4)
    expect(s.mean).toBeCloseTo(2.5, 12)
    expect(s.median).toBeCloseTo(2.5, 12)
    expect(s.std).toBeCloseTo(1.290994, 5)
    expect(s.min).toBe(1)
    expect(s.max).toBe(4)
    expect(s.d50).toBeCloseTo(2.5, 12)
  })

  it('uses lower-inclusive bins (2.5 falls into 2.5–3.0)', () => {
    const hist = buildHistogram([2.5], { start: 2, width: 0.5, binCount: 2 })
    expect(hist.bins.length).toBe(2)
    expect(hist.bins[0].count).toBe(0)
    expect(hist.bins[1].count).toBe(1)
    expect(hist.bins[1].low).toBeCloseTo(2.5, 12)
    expect(hist.bins[1].high).toBeCloseTo(3, 12)
  })

  it('fits a log-normal distribution', () => {
    const fit = fitLognormal([1, 2, 4, 8])
    expect(fit).not.toBeNull()
    expect(fit!.median).toBeGreaterThan(1)
    expect(fit!.sigma).toBeGreaterThan(0)
  })
})

describe('automatic particle detection', () => {
  it('finds a dark square on a light background', () => {
    const width = 24
    const height = 24
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = (y * width + x) * 4
        const dark = x >= 8 && x < 14 && y >= 8 && y < 14
        const v = dark ? 0 : 255
        data[p] = v
        data[p + 1] = v
        data[p + 2] = v
        data[p + 3] = 255
      }
    }
    const result = detectParticles({
      width,
      height,
      data,
      threshold: 128,
      minAreaPx: 4,
      maxCircularity: 5,
    })
    expect(result.particles.length).toBe(1)
    expect(result.particles[0].areaPx).toBe(36)
    expect(result.particles[0].cx).toBeCloseTo(10.5, 6)
    expect(result.particles[0].cy).toBeCloseTo(10.5, 6)
    expect(result.particles[0].equivalentDiameterPx).toBeCloseTo(2 * Math.sqrt(36 / Math.PI), 6)
  })

  it('detects bright particles when inverted', () => {
    const width = 16
    const height = 16
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = (y * width + x) * 4
        const bright = x >= 5 && x < 9 && y >= 5 && y < 9
        const v = bright ? 255 : 0
        data[p] = v
        data[p + 1] = v
        data[p + 2] = v
        data[p + 3] = 255
      }
    }
    const result = detectParticles({
      width,
      height,
      data,
      invert: true,
      threshold: 128,
      minAreaPx: 4,
      maxCircularity: 5,
    })
    expect(result.particles.length).toBe(1)
    expect(result.particles[0].areaPx).toBe(16)
  })
})
