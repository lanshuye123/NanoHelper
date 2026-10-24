import { describe, expect, it } from 'vitest'
import {
  cellVolume,
  densityFromAtoms,
  formulaFromAtoms,
  formulaUnitsFromDensity,
  packingFactor,
  parseFormula,
} from '@/core/crystallography/cellMetrics'
import {
  fourToThreeIndex,
  fourToThreeDirection,
  threeToFourDirection,
  generalPositionAmplitude,
  isValidFourIndex,
  isSystematicallyAbsent,
  planeIntercepts,
  threeToFourIndex,
  weissLaw,
} from '@/core/crystallography/indices'
import { buildLattice, dSpacing } from '@/core/lattice/cell'
import { loadSpaceGroup, toSymOps } from '@/core/data/spacegroups'
import { refineLattice, braggTwoTheta, nelsonRiley } from '@/core/crystallography/refine'
import {
  electronState,
  cameraConstant,
  rayleighResolution,
  coherenceLength,
  aberrationDiscs,
  ctfCurve,
  scherzerDefocus,
} from '@/core/micro/tem'
import { indexSaedPattern } from '@/core/micro/saedIndex'

describe('formula and cell metrics', () => {
  it('parses simple and parenthesised formulas', () => {
    expect(parseFormula('TiO2').mass).toBeCloseTo(79.865, 2)
    expect(parseFormula('Ca(OH)2').mass).toBeCloseTo(74.092, 2)
    expect(parseFormula('CuSO4·5H2O').mass).toBeCloseTo(249.68, 1)
    expect(parseFormula('Al2(SO4)3').mass).toBeCloseTo(342.15, 1)
  })

  it('computes cell volume and density', () => {
    const cell = { a: 5.431, b: 5.431, c: 5.431, alpha: 90, beta: 90, gamma: 90 }
    expect(cellVolume(cell)).toBeCloseTo(160.2, 1)
    const si = Array.from({ length: 8 }, () => ({ element: 'Si', x: 0, y: 0, z: 0 }))
    expect(densityFromAtoms(si, cellVolume(cell))).toBeCloseTo(2.329, 2)
    expect(formulaUnitsFromDensity(2.329, cellVolume(cell), 28.0855)).toBeCloseTo(8, 1)
  })

  it('knows packing factors', () => {
    expect(packingFactor('fcc').apf).toBeCloseTo(0.74048, 4)
    expect(packingFactor('bcc').apf).toBeCloseTo(0.68017, 4)
    expect(packingFactor('diamond').apf).toBeCloseTo(0.34009, 4)
    expect(packingFactor('hcp').apf).toBeCloseTo(0.74048, 4)
  })
})

describe('indices and extinction', () => {
  it('converts between three and four indices', () => {
    expect(threeToFourIndex([1, 0, 0])).toEqual([1, 0, -1, 0])
    expect(fourToThreeIndex([1, 0, -1, 0])).toEqual([1, 0, 0])
    expect(isValidFourIndex([1, 1, -2, 3])).toBe(true)
    expect(isValidFourIndex([1, 0, 0, 0])).toBe(false)
    expect(threeToFourDirection([1, 0, 0])).toEqual([2, -1, -1, 0])
    expect(fourToThreeDirection([2, -1, -1, 0])).toEqual([1, 0, 0])
  })

  it('reduces the cell contents to an empirical formula', () => {
    const si = Array.from({ length: 8 }, () => ({ element: 'Si', x: 0, y: 0, z: 0 }))
    expect(formulaFromAtoms(si).formula).toBe('Si')
    const nacl = [
      ...Array.from({ length: 4 }, () => ({ element: 'Na', x: 0, y: 0, z: 0 })),
      ...Array.from({ length: 4 }, () => ({ element: 'Cl', x: 0, y: 0, z: 0 })),
    ]
    expect(formulaFromAtoms(nacl).formula).toBe('ClNa')
  })

  it('computes plane intercepts and the Weiss law', () => {
    const cell = { a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 }
    const intercepts = planeIntercepts(cell, [1, 2, 0])
    expect(intercepts.fractional[0]).toBeCloseTo(1)
    expect(intercepts.fractional[1]).toBeCloseTo(0.5)
    expect(intercepts.fractional[2]).toBe(Infinity)
    expect(weissLaw([1, 1, 0], [1, -1, 0])).toBe(0)
  })

  it('finds F-centering absences in Fm-3m', async () => {
    const group = await loadSpaceGroup(225)
    expect(group).not.toBeNull()
    const ops = toSymOps(group!)
    expect(isSystematicallyAbsent(ops, [1, 0, 0])).toBe(true)
    expect(isSystematicallyAbsent(ops, [1, 1, 0])).toBe(true)
    expect(isSystematicallyAbsent(ops, [1, 1, 1])).toBe(false)
    expect(isSystematicallyAbsent(ops, [2, 0, 0])).toBe(false)
    expect(generalPositionAmplitude(ops, [1, 1, 1]).amplitude).toBeGreaterThan(0.1)
  })
})

describe('lattice refinement', () => {
  it('recovers a cubic lattice parameter and zero shift', () => {
    const truth = { a: 5.431, b: 5.431, c: 5.431, alpha: 90, beta: 90, gamma: 90 }
    const lattice = buildLattice(truth)
    const wavelength = 1.54056
    const zero = 0.08
    const hkls: Array<[number, number, number]> = [
      [1, 1, 1],
      [2, 2, 0],
      [3, 1, 1],
      [4, 0, 0],
      [3, 3, 1],
      [4, 2, 2],
    ]
    const peaks = hkls.map((hkl) => ({
      twoTheta: braggTwoTheta(dSpacing(lattice, hkl), wavelength) + zero,
      h: hkl[0],
      k: hkl[1],
      l: hkl[2],
    }))
    const result = refineLattice(
      peaks,
      { ...truth, a: 5.4, b: 5.4, c: 5.4 },
      {
        wavelength,
        flags: { a: true, b: true, c: true, alpha: false, beta: false, gamma: false, zero: true },
      },
    )
    expect(result.cell.a).toBeCloseTo(5.431, 4)
    expect(result.zero).toBeCloseTo(0.08, 3)
    expect(result.rmsDeg).toBeLessThan(1e-5)
    expect(result.peaks.length).toBe(6)
    const nr = nelsonRiley(result.peaks, result.cell, { zero: result.zero, wavelength })
    expect(nr).not.toBeNull()
    expect(nr!.intercept).toBeCloseTo(5.431, 3)
  })
})

describe('TEM parameters', () => {
  it('computes relativistic wavelength and camera constant', () => {
    expect(electronState(200).wavelength).toBeCloseTo(0.02508, 4)
    expect(electronState(100).wavelength).toBeCloseTo(0.03701, 4)
    expect(electronState(300).wavelength).toBeCloseTo(0.01969, 4)
    expect(electronState(200).gamma).toBeCloseTo(1.3914, 3)
    expect(cameraConstant(electronState(200).wavelength, 800)).toBeCloseTo(20.06, 1)
  })

  it('computes a CTF with a finite first zero', () => {
    const lambda = electronState(200).wavelength
    const cs = 0.5 * 1e7 // 0.5 mm in Å
    const defocus = scherzerDefocus(cs, lambda)
    const result = ctfCurve({
      wavelengthAngstrom: lambda,
      csAngstrom: cs,
      defocusAngstrom: defocus,
      maxU: 2,
      points: 2000,
    })
    expect(defocus).toBeLessThan(0)
    expect(result.firstZero).toBeGreaterThan(0.2)
    expect(result.firstZero).toBeLessThan(1)
    expect(result.pointResolution).toBeGreaterThan(1)
    expect(result.scherzerResolution).toBeGreaterThan(1)
    expect(result.ctf[0]).toBe(0)
  })

  it('computes resolution, coherence and aberrations', () => {
    expect(rayleighResolution(0.02508, 0.01)).toBeCloseTo(1.53, 1)
    expect(coherenceLength(200, 1)).toBeGreaterThan(500)
    const discs = aberrationDiscs({ Cs: 0.5, Cc: 1.2, betaRad: 0.01, energySpread: 1, energy: 200000, defocus: 10 })
    expect(discs.spherical).toBeCloseTo(5e-7, 12)
    expect(discs.astigmatic).toBeCloseTo(0.1, 6)
  })
})

describe('SAED indexing', () => {
  it('indexes a simple-cubic 45-degree pair', () => {
    const lattice = buildLattice({ a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 })
    const d1 = dSpacing(lattice, [1, 0, 0])
    const d2 = dSpacing(lattice, [1, 1, 0])
    const candidates = indexSaedPattern(lattice, d1, d2, 45, { maxIndex: 2, dTolerance: 1e-6, angleTolerance: 1e-6 })
    expect(candidates.length).toBeGreaterThan(0)
    const first = candidates[0]
    expect(Math.abs(first.d1 - d1)).toBeLessThan(1e-6)
    expect(Math.abs(first.d2 - d2)).toBeLessThan(1e-6)
    expect(first.zone).toBeDefined()
    expect(first.zone.every((v) => Number.isInteger(v))).toBe(true)
  })
})
