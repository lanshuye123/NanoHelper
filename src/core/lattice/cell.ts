import { cross, deg2rad, dot, inverse3, mulMat3Vec3, norm, type Mat3, type Vec3 } from '@/core/math/vec'

export interface CellParams {
  a: number
  b: number
  c: number
  /** degrees */
  alpha: number
  beta: number
  gamma: number
}

export interface ReciprocalParams {
  aStar: number
  bStar: number
  cStar: number
  alphaStar: number
  betaStar: number
  gammaStar: number
}

export interface Lattice {
  cell: CellParams
  G: Mat3
  Gstar: Mat3
  volume: number
  /** Direct basis vectors in a right-handed Cartesian frame (a along x, b in xy). */
  direct: [Vec3, Vec3, Vec3]
  /** Reciprocal basis vectors in the same Cartesian frame (no 2π). */
  reciprocal: [Vec3, Vec3, Vec3]
  reciprocalParams: ReciprocalParams
}

export function validateCell(cell: CellParams): string[] {
  const issues: string[] = []
  for (const key of ['a', 'b', 'c'] as const) {
    const v = cell[key]
    if (!Number.isFinite(v) || v <= 0) issues.push(`晶格常数 ${key} 必须为正数`)
  }
  for (const key of ['alpha', 'beta', 'gamma'] as const) {
    const v = cell[key]
    if (!Number.isFinite(v) || v <= 0 || v >= 180) issues.push(`晶胞角 ${key} 必须在 (0°, 180°) 内`)
  }
  return issues
}

/**
 * Build the metric tensor, volume and Cartesian basis vectors of a unit cell.
 *
 *   a along x, b in the xy plane, c completing a right-handed frame.
 *   G = [[a·a, a·b, a·c], …];  G* = G⁻¹
 */
export function buildLattice(cell: CellParams): Lattice {
  const issues = validateCell(cell)
  if (issues.length) throw new Error(issues.join('；'))

  const { a, b, c } = cell
  const alpha = deg2rad(cell.alpha)
  const beta = deg2rad(cell.beta)
  const gamma = deg2rad(cell.gamma)
  const ca = Math.cos(alpha)
  const cb = Math.cos(beta)
  const cg = Math.cos(gamma)
  const sg = Math.sin(gamma)

  const aVec: Vec3 = [a, 0, 0]
  const bVec: Vec3 = [b * cg, b * sg, 0]
  const cx = c * cb
  const cy = (c * (ca - cb * cg)) / sg
  const czSq = c * c - cx * cx - cy * cy
  const cz = Math.sqrt(Math.max(0, czSq))
  const cVec: Vec3 = [cx, cy, cz]

  const volume = Math.abs(dot(aVec, cross(bVec, cVec)))
  if (!(volume > 0)) throw new Error('晶胞体积为零，请检查晶格参数')

  const G: Mat3 = [
    [a * a, a * b * cg, a * c * cb],
    [a * b * cg, b * b, b * c * ca],
    [a * c * cb, b * c * ca, c * c],
  ]
  const Gstar = inverse3(G)

  const aStar = cross(bVec, cVec).map((v) => v / volume) as Vec3
  const bStar = cross(cVec, aVec).map((v) => v / volume) as Vec3
  const cStar = cross(aVec, bVec).map((v) => v / volume) as Vec3

  const reciprocalParams: ReciprocalParams = {
    aStar: norm(aStar),
    bStar: norm(bStar),
    cStar: norm(cStar),
    alphaStar: angleBetweenVectors(bStar, cStar),
    betaStar: angleBetweenVectors(aStar, cStar),
    gammaStar: angleBetweenVectors(aStar, bStar),
  }

  return {
    cell: { ...cell },
    G,
    Gstar,
    volume,
    direct: [aVec, bVec, cVec],
    reciprocal: [aStar, bStar, cStar],
    reciprocalParams,
  }
}

/** Angle between two vectors in degrees. */
export function angleBetweenVectors(u: Vec3, v: Vec3): number {
  const denom = norm(u) * norm(v)
  if (denom === 0) return 0
  const cos = Math.min(1, Math.max(-1, dot(u, v) / denom))
  return (Math.acos(cos) * 180) / Math.PI
}

/** Cartesian scattering vector g = h a* + k b* + l c* (units Å⁻¹). */
export function reciprocalVector(lattice: Lattice, hkl: readonly number[]): Vec3 {
  const [aStar, bStar, cStar] = lattice.reciprocal
  return [
    hkl[0] * aStar[0] + hkl[1] * bStar[0] + hkl[2] * cStar[0],
    hkl[0] * aStar[1] + hkl[1] * bStar[1] + hkl[2] * cStar[1],
    hkl[0] * aStar[2] + hkl[1] * bStar[2] + hkl[2] * cStar[2],
  ]
}

/** Cartesian direct vector r = u a + v b + w c (units Å). */
export function directVector(lattice: Lattice, uvw: readonly number[]): Vec3 {
  const [aVec, bVec, cVec] = lattice.direct
  return [
    uvw[0] * aVec[0] + uvw[1] * bVec[0] + uvw[2] * cVec[0],
    uvw[0] * aVec[1] + uvw[1] * bVec[1] + uvw[2] * cVec[1],
    uvw[0] * aVec[2] + uvw[1] * bVec[2] + uvw[2] * cVec[2],
  ]
}

export function dSpacing(lattice: Lattice, hkl: readonly number[]): number {
  const g = reciprocalVector(lattice, hkl)
  const len = norm(g)
  return len === 0 ? Infinity : 1 / len
}

/** |g| in Å⁻¹. */
export function gLength(lattice: Lattice, hkl: readonly number[]): number {
  return norm(reciprocalVector(lattice, hkl))
}

/** Angle between the normals of two planes, in degrees (0–180). */
export function planeAngle(lattice: Lattice, hkl1: readonly number[], hkl2: readonly number[]): number {
  return angleBetweenVectors(reciprocalVector(lattice, hkl1), reciprocalVector(lattice, hkl2))
}

/** Angle between two direct-space directions, in degrees (0–180). */
export function directionAngle(lattice: Lattice, uvw1: readonly number[], uvw2: readonly number[]): number {
  return angleBetweenVectors(directVector(lattice, uvw1), directVector(lattice, uvw2))
}

/** Angle between a plane and a direction, in degrees (0–90). */
export function planeDirectionAngle(
  lattice: Lattice,
  hkl: readonly number[],
  uvw: readonly number[],
): number {
  const g = reciprocalVector(lattice, hkl)
  const r = directVector(lattice, uvw)
  const denom = norm(g) * norm(r)
  if (denom === 0) return 0
  const cos = Math.min(1, Math.max(-1, Math.abs(dot(g, r)) / denom))
  return 90 - (Math.acos(cos) * 180) / Math.PI
}

/** Interplanar spacing from the metric tensor (used by tests / cross-checks). */
export function dSpacingFromMetric(lattice: Lattice, hkl: readonly number[]): number {
  const h = hkl as Vec3
  const gh = mulMat3Vec3(lattice.Gstar, h)
  const q = dot(h, gh)
  return q <= 0 ? Infinity : 1 / Math.sqrt(q)
}

/** Metric dot product of two reciprocal-space integer vectors. */
export function gDot(lattice: Lattice, h1: readonly number[], h2: readonly number[]): number {
  const v = mulMat3Vec3(lattice.Gstar, h1 as Vec3)
  return v[0] * h2[0] + v[1] * h2[1] + v[2] * h2[2]
}
