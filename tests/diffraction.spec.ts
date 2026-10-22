import { describe, expect, it } from 'vitest'
import { simulateXrd, scherrerSize, williamsonHall, laueRotations } from '@/core/diffraction/xrd'
import { simulateSaed, cameraConstantFromRd, dFromRadius } from '@/core/diffraction/saed'
import { loadSpaceGroup } from '@/core/data/spacegroups'
import { STRUCTURE_PRESETS, presetToStructure } from '@/data/presets'
import { buildXy } from '@/core/io/xy'
import { electronWavelength } from '@/core/diffraction/scattering'

const siPreset = STRUCTURE_PRESETS.find((p) => p.id === 'si')!
const si = presetToStructure(siPreset)
const anatase = presetToStructure(STRUCTURE_PRESETS.find((p) => p.id === 'anatase')!)

describe('XRD simulation', () => {
  it('places Si (111), (220), (311) and (400) at the expected 2θ', async () => {
    const group = await loadSpaceGroup(227)
    expect(group).toBeTruthy()
    const pattern = simulateXrd(si, group!.ops.map((o) => o.r), {
      wavelength: 1.54056,
      twoThetaMin: 20,
      twoThetaMax: 80,
      step: 0.02,
      fwhm: 0.1,
      ka2: false,
      profile: 'gaussian',
    })
    const find = (h: number, k: number, l: number) =>
      pattern.reflections.find((r) => r.hkl.join(',') === [h, k, l].join(','))
    expect(find(1, 1, 1)?.twoTheta).toBeCloseTo(28.44, 1)
    expect(find(2, 2, 0)?.twoTheta).toBeCloseTo(47.3, 1)
    expect(find(3, 1, 1)?.twoTheta).toBeCloseTo(56.12, 1)
    expect(find(4, 0, 0)?.twoTheta).toBeCloseTo(69.13, 1)
    expect(find(1, 1, 1)?.multiplicity).toBe(8)
    expect(find(2, 0, 0)).toBeUndefined()
  })

  it('produces an exportable Jade XY', async () => {
    const group = await loadSpaceGroup(227)
    const pattern = simulateXrd(si, group!.ops.map((o) => o.r), {
      wavelength: 1.54056,
      twoThetaMin: 20,
      twoThetaMax: 80,
      step: 0.02,
      fwhm: 0.1,
      ka2: true,
      scaleTo: 10000,
    })
    const text = buildXy({ x: pattern.x, y: pattern.y, meta: { xLabel: '2θ', xUnit: '°', yLabel: 'Counts', yUnit: 'counts' } })
    expect(text.split('\r\n').filter(Boolean).length).toBe(pattern.x.length)
    expect(Math.max(...pattern.y)).toBeCloseTo(10000, 3)
  })

  it('gives anatase (101) near 25.3°', async () => {
    const group = await loadSpaceGroup(141)
    const pattern = simulateXrd(anatase, group!.ops.map((o) => o.r), {
      wavelength: 1.54056,
      twoThetaMin: 20,
      twoThetaMax: 60,
      step: 0.02,
      fwhm: 0.1,
    })
    const r101 = pattern.reflections.find((r) => r.hkl.join(',') === '1,0,1')
    expect(r101?.twoTheta).toBeCloseTo(25.3, 1)
    expect(r101?.d).toBeCloseTo(3.516, 2)
  })

  it('adds Friedel inversion to the Laue class', () => {
    const rotations = laueRotations([[[1, 0, 0], [0, 1, 0], [0, 0, 1]]])
    expect(rotations).toHaveLength(2)
  })
})

describe('SAED simulation', () => {
  it('places Si [110] spots at R = Lλ·g', () => {
    const pattern = simulateSaed(si, { zoneAxis: [1, 1, 0], voltageKv: 200, cameraLengthMm: 800, maxG: 0.8 })
    expect(pattern.spots.length).toBeGreaterThan(4)
    expect(pattern.spots.some((s) => s.isCenter)).toBe(true)
    expect(pattern.cameraConstant).toBeCloseTo(electronWavelength(200) * 800, 8)
    const g004 = pattern.spots.find((s) => s.hkl.join(',') === '0,0,4')
    expect(g004).toBeTruthy()
    expect(g004!.g).toBeCloseTo(4 / 5.431, 8)
    expect(g004!.rx).toBeCloseTo(pattern.cameraConstant * g004!.x, 8)
  })

  it('omits reflections outside the zone', () => {
    const pattern = simulateSaed(si, { zoneAxis: [1, 1, 0], voltageKv: 200, cameraLengthMm: 800, maxG: 0.8 })
    expect(pattern.spots.some((s) => s.hkl.join(',') === '1,1,1')).toBe(false)
  })

  it('handles the [111] zone and exposes basis geometry', () => {
    const pattern = simulateSaed(si, { zoneAxis: [1, 1, 1], voltageKv: 200, cameraLengthMm: 800, maxG: 0.8 })
    expect(pattern.spots.length).toBeGreaterThan(4)
    expect(pattern.basis.angleDeg).toBeGreaterThan(0)
    expect(pattern.basis.angleDeg).toBeLessThan(180)
  })

  it('calibrates a camera constant from R and d', () => {
    const cam = cameraConstantFromRd(10, 2.5)
    expect(cam).toBe(25)
    expect(dFromRadius(10, cam)).toBeCloseTo(2.5, 10)
  })
})

describe('peak analysis', () => {
  it('computes a Scherrer size', () => {
    // 1° FWHM at 25° with Cu Kα should give a few nanometres.
    const size = scherrerSize(0.1, 25, 1.54056)
    expect(size).toBeGreaterThan(50)
    expect(size).toBeLessThan(200)
  })

  it('recovers a Williamson–Hall size and strain', () => {
    const wavelength = 1.54056
    const k = 0.9
    const D = 20 // nm
    const strain = 0.001
    const peaks = [25, 38, 48, 55, 62].map((twoTheta) => {
      const theta = (twoTheta * Math.PI) / 360
      const beta = (k * wavelength) / (D * 10 * Math.cos(theta)) + 4 * strain * Math.tan(theta)
      const fwhm = (beta * 180) / Math.PI
      return { twoTheta, fwhm }
    })
    const result = williamsonHall(peaks, wavelength, k)
    expect(result).not.toBeNull()
    expect(result!.sizeNm).toBeCloseTo(20, 1)
    expect(result!.strain).toBeCloseTo(0.001, 5)
    expect(result!.r2).toBeCloseTo(1, 5)
  })
})
