import { cross, dot, normalize, norm, type Vec3 } from '@/core/math/vec'
import {
  directVector,
  gDot,
  reciprocalVector,
  type Lattice,
} from '@/core/lattice/cell'
import { integerZoneBasis, normalizeZone, tripleDet, type Triple } from '@/core/lattice/zone'

export interface PlaneBasis {
  zone: Triple
  /** Integer basis of the reciprocal lattice plane. */
  b1: Triple
  b2: Triple
  /** Cartesian reciprocal vectors of b1/b2 (Å⁻¹). */
  g1: Vec3
  g2: Vec3
  len1: number
  len2: number
  angleDeg: number
  /** Orthonormal in-plane axes used for plotting. */
  e1: Vec3
  e2: Vec3
  /** Plane normal (direct-space zone vector, normalized). */
  normal: Vec3
  /** Unimodular determinant (should be ±1 for a valid basis). */
  det: number
}

export interface NetPoint {
  i: number
  j: number
  hkl: Triple
  /** Cartesian coordinates in the plane (Å⁻¹), e1 along +x, e2 along +y. */
  x: number
  y: number
  g: number
  d: number
  isCenter: boolean
}

/**
 * Build a reduced basis for the reciprocal plane perpendicular to a zone axis.
 *
 * The course's manual recipe ("reciprocals → smallest integers → intercepts")
 * is equivalent to finding two integer vectors orthogonal to [uvw]; here we
 * additionally perform a 2D Lagrange–Gauss reduction so the basis is the
 * shortest possible (and the resulting pattern is easy to read).
 */
export function buildPlaneBasis(lattice: Lattice, zoneInput: readonly number[]): PlaneBasis {
  const zone = normalizeZone(zoneInput)
  const [b1raw, b2raw] = integerZoneBasis(zone)

  let a = b1raw
  let b = b2raw
  let na = gDot(lattice, a, a)
  let nb = gDot(lattice, b, b)
  if (nb < na) {
    ;[a, b] = [b, a]
    ;[na, nb] = [nb, na]
  }
  for (let iter = 0; iter < 16; iter++) {
    const mu = Math.round(gDot(lattice, a, b) / na)
    if (mu === 0) break
    b = [b[0] - mu * a[0], b[1] - mu * a[1], b[2] - mu * a[2]]
    nb = gDot(lattice, b, b)
    if (nb < na) {
      ;[a, b] = [b, a]
      ;[na, nb] = [nb, na]
    }
  }
  // Choose the acute angle between the two basis vectors.
  if (gDot(lattice, a, b) < 0) b = [-b[0], -b[1], -b[2]]

  const g1 = reciprocalVector(lattice, a)
  const g2 = reciprocalVector(lattice, b)
  const len1 = norm(g1)
  const len2 = norm(g2)
  const cos = Math.min(1, Math.max(-1, dot(g1, g2) / (len1 * len2 || 1)))
  const angleDeg = (Math.acos(cos) * 180) / Math.PI

  const normal = normalize(directVector(lattice, zone))
  const e1 = normalize(g1)
  let e2 = normalize(cross(normal, e1))
  // Make g2 point into the upper half-plane for a familiar pattern orientation.
  if (dot(g2, e2) < 0) e2 = [-e2[0], -e2[1], -e2[2]]

  return {
    zone,
    b1: a,
    b2: b,
    g1,
    g2,
    len1,
    len2,
    angleDeg,
    e1,
    e2,
    normal,
    det: tripleDet(a, b, zone),
  }
}

/**
 * Generate reciprocal-lattice points of the plane within a physical radius
 * (Å⁻¹). The (i, j) integer range is chosen from the basis lengths.
 */
export function generateNet(
  lattice: Lattice,
  basis: PlaneBasis,
  options: { maxG?: number; maxIndex?: number } = {},
): NetPoint[] {
  const { maxG = 1.2 } = options
  const minLen = Math.min(basis.len1, basis.len2) || 0.05
  const maxIndex = options.maxIndex ?? Math.min(24, Math.ceil(maxG / minLen) + 2)
  const points: NetPoint[] = []
  for (let i = -maxIndex; i <= maxIndex; i++) {
    for (let j = -maxIndex; j <= maxIndex; j++) {
      const hkl: Triple = [
        i * basis.b1[0] + j * basis.b2[0],
        i * basis.b1[1] + j * basis.b2[1],
        i * basis.b1[2] + j * basis.b2[2],
      ]
      const gVec = reciprocalVector(lattice, hkl)
      const g = norm(gVec)
      if (g > maxG) continue
      const x = dot(gVec, basis.e1)
      const y = dot(gVec, basis.e2)
      points.push({
        i,
        j,
        hkl,
        x,
        y,
        g,
        d: g === 0 ? Infinity : 1 / g,
        isCenter: g === 0,
      })
    }
  }
  points.sort((a, b) => a.g - b.g || a.hkl[0] - b.hkl[0] || a.hkl[1] - b.hkl[1])
  return points
}

/** Signed angle (degrees) from +e1 for a point in the net. */
export function netAngle(point: Pick<NetPoint, 'x' | 'y'>): number {
  const deg = (Math.atan2(point.y, point.x) * 180) / Math.PI
  return deg < 0 ? deg + 360 : deg
}

/** Format a zone axis for display. */
export function formatZone(zone: readonly number[]): string {
  return `[${zone.map((v) => (v < 0 ? `-${Math.abs(v)}` : `${v}`)).join(' ')}]`
}
