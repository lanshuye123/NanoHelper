import { describe, expect, it } from 'vitest'
import { buildLattice } from '@/core/lattice/cell'
import { structureFactor, reflectionMultiplicity } from '@/core/crystallography/structure'
import { electronWavelength, scatteringFactor, ANODES, getAnode } from '@/core/diffraction/scattering'
import { STRUCTURE_PRESETS, presetToStructure } from '@/data/presets'

const nacl = presetToStructure(STRUCTURE_PRESETS.find((p) => p.id === 'nacl')!)
const si = presetToStructure(STRUCTURE_PRESETS.find((p) => p.id === 'si')!)
const naclLattice = buildLattice(nacl.cell)
const siLattice = buildLattice(si.cell)

describe('atomic scattering factors', () => {
  it('reproduces f0(0) = Z', () => {
    expect(scatteringFactor('Si', 0)).toBeCloseTo(14, 2)
    expect(scatteringFactor('O', 0)).toBeCloseTo(8, 2)
    expect(scatteringFactor('Na', 0)).toBeCloseTo(11, 1)
  })

  it('decreases with sinθ/λ', () => {
    expect(scatteringFactor('Si', 0.5)).toBeLessThan(scatteringFactor('Si', 0))
    expect(scatteringFactor('Si', 1.0)).toBeLessThan(scatteringFactor('Si', 0.5))
  })

  it('computes the relativistic electron wavelength', () => {
    expect(electronWavelength(200)).toBeCloseTo(0.02508, 5)
    expect(electronWavelength(100)).toBeCloseTo(0.03701, 5)
    expect(electronWavelength(300)).toBeCloseTo(0.01969, 5)
  })

  it('offers standard Cu Kα wavelengths', () => {
    expect(getAnode('Cu').ka1).toBeCloseTo(1.54056, 6)
    expect(ANODES.length).toBeGreaterThan(3)
  })
})

describe('structure factor', () => {
  it('satisfies the NaCl extinction rules', () => {
    const f200 = structureFactor(naclLattice, nacl.atoms, [2, 0, 0])
    const f111 = structureFactor(naclLattice, nacl.atoms, [1, 1, 1])
    const f110 = structureFactor(naclLattice, nacl.atoms, [1, 1, 0])
    expect(f200.absF).toBeGreaterThan(f111.absF)
    expect(f111.absF).toBeGreaterThan(0)
    expect(f110.absF).toBeLessThan(1e-6)
    expect(f110.absent).toBe(true)
  })

  it('satisfies the diamond glide rules for Si', () => {
    const f111 = structureFactor(siLattice, si.atoms, [1, 1, 1])
    const f200 = structureFactor(siLattice, si.atoms, [2, 0, 0])
    const f220 = structureFactor(siLattice, si.atoms, [2, 2, 0])
    const f222 = structureFactor(siLattice, si.atoms, [2, 2, 2])
    expect(f111.absF).toBeGreaterThan(0)
    expect(f200.absent).toBe(true)
    expect(f220.absF).toBeGreaterThan(0)
    expect(f222.absent).toBe(true)
  })

  it('gives Friedel-equivalent intensities', () => {
    const a = structureFactor(siLattice, si.atoms, [3, 1, 1])
    const b = structureFactor(siLattice, si.atoms, [-3, -1, -1])
    expect(a.f2).toBeCloseTo(b.f2, 8)
  })

  it('counts powder multiplicity from the Laue class', () => {
    const inversion = [
      [-1, 0, 0],
      [0, -1, 0],
      [0, 0, -1],
    ]
    const identity = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]
    expect(reflectionMultiplicity([1, 1, 1], [identity, inversion])).toBe(2)
    expect(reflectionMultiplicity([2, 0, 0], [identity])).toBe(1)
  })
})
