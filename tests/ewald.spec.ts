import { describe, expect, it } from 'vitest'
import {
  buildEwaldGeometry,
  compareEwaldWavelengths,
  ewaldSagitta,
} from '@/core/diffraction/ewald'
import { buildLattice } from '@/core/lattice/cell'

const SI_CELL = { a: 5.431, b: 5.431, c: 5.431, alpha: 90, beta: 90, gamma: 90 }

describe('Ewald sphere geometry', () => {
  it('uses k = 1/λ and the limiting sphere 2/λ', () => {
    const lattice = buildLattice(SI_CELL)
    const electron = buildEwaldGeometry(lattice, {
      wavelength: 0.0250793,
      zoneAxis: [1, 1, 1],
      maxG: 0.8,
      thicknessNm: 50,
    })
    expect(electron.k).toBeCloseTo(39.8735, 4)
    expect(electron.limitingRadius).toBeCloseTo(79.747, 3)
    expect(electron.points.length).toBeGreaterThan(10)
  })

  it('splits ZOLZ and HOLZ points for [110]', () => {
    const lattice = buildLattice(SI_CELL)
    const result = buildEwaldGeometry(lattice, {
      wavelength: 0.0250793,
      zoneAxis: [1, 1, 0],
      maxG: 0.9,
      thicknessNm: 40,
    })
    expect(result.zolz.length).toBeGreaterThan(0)
    expect(result.holz.length).toBeGreaterThan(0)
    for (const point of result.zolz) expect(point.laueZone).toBe(0)
    for (const point of result.holz) expect(point.laueZone).not.toBe(0)
  })

  it('reduces to s = g²/(2k) in the ZOLZ', () => {
    const lattice = buildLattice(SI_CELL)
    const result = buildEwaldGeometry(lattice, {
      wavelength: 0.0250793,
      zoneAxis: [1, 0, 0],
      maxG: 0.7,
      thicknessNm: 30,
    })
    const point = result.zolz.find((item) => item.g > 0.1)
    expect(point).toBeDefined()
    expect(point!.excitationError).toBeCloseTo(ewaldSagitta(point!.g, result.k), 12)
  })

  it('shows the much larger X-ray curvature at the same |g|', () => {
    const g = 0.5
    const electron = compareEwaldWavelengths(g, 0.0250793, 1.54056)
    expect(electron.kB).toBeCloseTo(0.649, 3)
    expect(electron.sagittaB / electron.sagittaA).toBeGreaterThan(50)
  })
})
