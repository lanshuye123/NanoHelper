import { describe, expect, it } from 'vitest'
import {
  angleBetweenVectors,
  buildLattice,
  dSpacing,
  directionAngle,
  planeAngle,
  reciprocalVector,
  directVector,
} from '@/core/lattice/cell'
import { normalizeZone, planesInZone, zoneAxisFromPlanes } from '@/core/lattice/zone'
import { buildPlaneBasis, generateNet } from '@/core/lattice/planeNet'

const cubic = { a: 5.431, b: 5.431, c: 5.431, alpha: 90, beta: 90, gamma: 90 }
const tetragonal = { a: 3.7845, b: 3.7845, c: 9.5143, alpha: 90, beta: 90, gamma: 90 }
const hexagonal = { a: 3.2094, b: 3.2094, c: 5.2409, alpha: 90, beta: 90, gamma: 120 }

describe('lattice metric', () => {
  it('computes the volume of a cubic cell', () => {
    const lattice = buildLattice(cubic)
    expect(lattice.volume).toBeCloseTo(5.431 ** 3, 6)
  })

  it('gives the Si (111) and (220) d-spacings', () => {
    const lattice = buildLattice(cubic)
    expect(dSpacing(lattice, [1, 1, 1])).toBeCloseTo(3.13556, 4)
    expect(dSpacing(lattice, [2, 2, 0])).toBeCloseTo(1.92011, 4)
    expect(dSpacing(lattice, [4, 0, 0])).toBeCloseTo(1.35775, 4)
  })

  it('gives the anatase (101) d-spacing', () => {
    const lattice = buildLattice(tetragonal)
    expect(dSpacing(lattice, [1, 0, 1])).toBeCloseTo(3.516, 2)
  })

  it('gives the Mg (002) d-spacing', () => {
    const lattice = buildLattice(hexagonal)
    expect(dSpacing(lattice, [0, 0, 2])).toBeCloseTo(2.62045, 4)
  })

  it('reproduces the cubic (100)-(111) angle', () => {
    const lattice = buildLattice(cubic)
    expect(planeAngle(lattice, [1, 0, 0], [1, 1, 1])).toBeCloseTo(54.7356, 3)
    expect(directionAngle(lattice, [1, 0, 0], [1, 1, 1])).toBeCloseTo(54.7356, 3)
  })

  it('keeps reciprocal and direct vectors orthogonal', () => {
    const lattice = buildLattice({ a: 4.5, b: 5.2, c: 6.1, alpha: 78, beta: 95, gamma: 110 })
    const g = reciprocalVector(lattice, [2, -1, 3])
    const r = directVector(lattice, [1, 2, -1])
    expect(g[0] * r[0] + g[1] * r[1] + g[2] * r[2]).toBeCloseTo(2 * 1 + -1 * 2 + 3 * -1, 10)
  })

  it('normalizes and reduces zone axes', () => {
    expect(normalizeZone([4, 2, 2])).toEqual([2, 1, 1])
    expect(zoneAxisFromPlanes([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1])
    expect(zoneAxisFromPlanes([1, 0, 0], [1, 0, 0])).toBeNull()
  })

  it('lists planes in a zone and respects the Weiss law', () => {
    const lattice = buildLattice(cubic)
    const planes = planesInZone(lattice, [1, 1, 0], { maxIndex: 2 })
    expect(planes.length).toBeGreaterThan(0)
    for (const p of planes) {
      expect(p.hkl[0] * 1 + p.hkl[1] * 1 + p.hkl[2] * 0).toBe(0)
    }
    expect(planes.map((p) => p.hkl).some((hkl) => hkl.join(',') === '0,0,2')).toBe(true)
  })

  it('builds a reduced 2D reciprocal basis for [110]', () => {
    const lattice = buildLattice(cubic)
    const basis = buildPlaneBasis(lattice, [1, 1, 0])
    expect(basis.det).not.toBe(0)
    expect(basis.angleDeg).toBeCloseTo(90, 6)
    const lengths = [basis.len1, basis.len2].sort((a, b) => a - b)
    expect(lengths[0]).toBeCloseTo(1 / 5.431, 6)
    expect(lengths[1]).toBeCloseTo(Math.SQRT2 / 5.431, 6)
    const net = generateNet(lattice, basis, { maxG: 0.6 })
    expect(net.some((p) => p.isCenter)).toBe(true)
    expect(net.some((p) => p.hkl.join(',') === '0,0,2')).toBe(true)
  })

  it('handles the [421] zone from the course notes', () => {
    const lattice = buildLattice(cubic)
    const basis = buildPlaneBasis(lattice, [4, 2, 1])
    for (const b of [basis.b1, basis.b2]) {
      expect(b[0] * 4 + b[1] * 2 + b[2] * 1).toBe(0)
    }
    expect(basis.det).not.toBe(0)
  })

  it('handles the [102] zone with a zero index', () => {
    const lattice = buildLattice(cubic)
    const basis = buildPlaneBasis(lattice, [1, 0, 2])
    for (const b of [basis.b1, basis.b2]) {
      expect(b[0] * 1 + b[2] * 2).toBe(0)
    }
  })

  it('computes angles robustly', () => {
    expect(angleBetweenVectors([1, 0, 0], [0, 1, 0])).toBeCloseTo(90, 10)
  })
})
