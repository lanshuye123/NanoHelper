import { canonicalizeIndices, cross, gcd3, reduceIndices } from '@/core/math/vec'
import { dSpacing, gLength, type Lattice } from '@/core/lattice/cell'

export type Triple = [number, number, number]

export interface PlaneInZone {
  hkl: Triple
  d: number
  g: number
  /** Angle of the reciprocal vector relative to the first basis vector, in degrees. */
  angle: number
}

/**
 * Zone axis (direction of the intersection line) of two planes.
 *
 *   [u v w] = (h1 k1 l1) × (h2 k2 l2)
 *
 * Returns null when the two planes are parallel (cross product is zero).
 */
export function zoneAxisFromPlanes(hkl1: readonly number[], hkl2: readonly number[]): Triple | null {
  const c = cross(hkl1 as Triple, hkl2 as Triple)
  if (c[0] === 0 && c[1] === 0 && c[2] === 0) return null
  return canonicalizeIndices(reduceIndices(c))
}

/** Weiss zone law: hu + kv + lw = 0. */
export function isInZone(hkl: readonly number[], zone: readonly number[]): boolean {
  return hkl[0] * zone[0] + hkl[1] * zone[1] + hkl[2] * zone[2] === 0
}

/** Centering-based reflection conditions (systematic absences from the Bravais lattice). */
export function centeringAllows(hkl: readonly number[], latticeType: string): boolean {
  const [h, k, l] = hkl
  switch (latticeType.toUpperCase()) {
    case 'I':
      return (h + k + l) % 2 === 0
    case 'F':
      return (h % 2 === 0 && k % 2 === 0 && l % 2 === 0) || (h % 2 !== 0 && k % 2 !== 0 && l % 2 !== 0)
    case 'C':
      return (h + k) % 2 === 0
    case 'A':
      return (k + l) % 2 === 0
    case 'B':
      return (h + l) % 2 === 0
    case 'R':
      // Obverse setting: -h + k + l = 3n
      return ((-h + k + l) % 3 + 3) % 3 === 0
    default:
      return true
  }
}

/**
 * All planes belonging to a zone within |h|, |k|, |l| <= maxIndex.
 * Sorted by decreasing d-spacing (i.e. increasing |g|).
 */
export function planesInZone(
  lattice: Lattice,
  zone: readonly number[],
  options: { maxIndex?: number; applyCentering?: boolean; latticeType?: string; includeFriedel?: boolean } = {},
): PlaneInZone[] {
  const { maxIndex = 8, applyCentering = false, latticeType = 'P' } = options
  const out: PlaneInZone[] = []
  const seen = new Set<string>()
  for (let h = -maxIndex; h <= maxIndex; h++) {
    for (let k = -maxIndex; k <= maxIndex; k++) {
      for (let l = -maxIndex; l <= maxIndex; l++) {
        if (h === 0 && k === 0 && l === 0) continue
        if (!isInZone([h, k, l], zone)) continue
        if (applyCentering && !centeringAllows([h, k, l], latticeType)) continue
        const key = `${h},${k},${l}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({
          hkl: [h, k, l],
          d: dSpacing(lattice, [h, k, l]),
          g: gLength(lattice, [h, k, l]),
          angle: 0,
        })
      }
    }
  }
  out.sort((a, b) => b.d - a.d || a.hkl[0] - b.hkl[0] || a.hkl[1] - b.hkl[1] || a.hkl[2] - b.hkl[2])
  return out
}

/** Reduce a (possibly non-primitive) zone axis and validate it. */
export function normalizeZone(uvw: readonly number[]): Triple {
  const rounded = uvw.map((v) => Math.round(v)) as Triple
  if (rounded.every((v) => v === 0)) throw new Error('带轴指数不能全为 0')
  return canonicalizeIndices(reduceIndices(rounded))
}

/** Two shortest independent integer vectors perpendicular to a zone axis. */
export function integerZoneBasis(zone: readonly number[]): [Triple, Triple] {
  const [u, v, w] = zone
  let b1: Triple
  let b2: Triple
  if (w !== 0) {
    b1 = [w, 0, -u]
    b2 = [0, w, -v]
  } else if (v !== 0) {
    b1 = [v, -u, 0]
    b2 = [0, 0, 1]
  } else if (u !== 0) {
    b1 = [0, 1, 0]
    b2 = [0, 0, 1]
  } else {
    throw new Error('带轴指数不能全为 0')
  }
  // Reduce obvious common factors; the Gauss reduction below fixes the rest.
  return [reduceIndices(b1), reduceIndices(b2)]
}

/** Integer determinant of a 3×3 matrix, used to sanity-check unimodular transforms. */
export function tripleDet(a: Triple, b: Triple, c: Triple): number {
  return (
    a[0] * (b[1] * c[2] - b[2] * c[1]) -
    a[1] * (b[0] * c[2] - b[2] * c[0]) +
    a[2] * (b[0] * c[1] - b[1] * c[0])
  )
}

/** Great common divisor of a zone axis (used for diagnostics). */
export function zoneGcd(zone: readonly number[]): number {
  return gcd3(zone[0], zone[1], zone[2])
}
